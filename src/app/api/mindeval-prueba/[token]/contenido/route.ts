import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { resolverPerfilCargo } from "@/lib/mindeval-perfil";
import { generarCasoTecnico } from "@/lib/mindeval-ia";
import { ITEMS_EJEMPLO } from "@/lib/mindeval-baterias";
import { ITEMS_16PF5 } from "@/lib/mindeval-16pf5";
import { ITEMS_KOSTICK } from "@/lib/mindeval-kostick";
import { ITEMS_DISC } from "@/lib/mindeval-disc";
import { ITEMS_VALANTI } from "@/lib/mindeval-valanti";
import type { EjercicioBanco, PreguntaBanco, Vacante } from "@/lib/mindeval-types";
import { sesionExpirada, todaviaNoDisponible, mensajeExpirada, mensajeNoDisponible } from "@/lib/mindeval-ventana-prueba";

// generarCasoTecnico (caso técnico abierto) llama a Claude y puede superar
// el límite por defecto de las funciones serverless de Vercel con un cold
// start -- mismo motivo que maxDuration en /api/mindeval-postular.
export const maxDuration = 60;

/**
 * Segundo paso del portal del candidato: solo entrega/genera el contenido
 * real de la prueba (y solo aquí se marca la sesión "en_curso" y se
 * consume/genera el caso técnico o el snapshot de assessment) DESPUÉS de
 * confirmar la cédula — antes de esto, GET /api/mindeval-prueba/[token] solo
 * entrega candidato_nombre + requiere_cedula, nunca las preguntas.
 *
 * Si el candidato no tiene cédula registrada (dato legado o alta manual sin
 * ella), se deja pasar sin comparar — no bloquea a alguien real por un hueco
 * de datos que no es su culpa; la capa de seguridad real sigue siendo el
 * token, esto es una capa adicional cuando el dato está disponible.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { permitido } = checkRateLimit(req, "mindeval-prueba");
  if (!permitido) return rateLimitResponse();

  const { token } = await params;

  try {
    const { cedula }: { cedula?: string } = await req.json().catch(() => ({}));

    const { data: sesion, error } = await supabaseAdmin
      .from("mindeval_sesiones_prueba")
      .select("*, mindeval_candidatos(nombre_completo, cedula)")
      .eq("token", token)
      .maybeSingle();

    if (error || !sesion) {
      return NextResponse.json({ error: "Link no válido" }, { status: 404 });
    }
    if (sesion.estado === "completada") {
      return NextResponse.json({ error: "Esta prueba ya fue completada" }, { status: 409 });
    }
    // Misma regla que GET /api/mindeval-prueba/[token], importada del mismo
    // módulo -- este endpoint es el que de verdad entrega el contenido, así
    // que vuelve a validarla en vez de confiar en que el GET ya lo hizo.
    if (sesionExpirada(sesion)) {
      return NextResponse.json({ error: mensajeExpirada(sesion) }, { status: 410 });
    }
    if (todaviaNoDisponible(sesion)) {
      return NextResponse.json({ error: mensajeNoDisponible(sesion) }, { status: 403 });
    }

    const cedulaRegistrada: string | null = sesion.mindeval_candidatos?.cedula ?? null;
    if (cedulaRegistrada && cedulaRegistrada !== (cedula ?? "").trim()) {
      return NextResponse.json({ error: "La cédula no coincide con la registrada para este candidato." }, { status: 403 });
    }

    const { data: vacante } = await supabaseAdmin.from("mindeval_vacantes").select("*").eq("id", sesion.vacante_id).single();

    // Ancla real del cronómetro (ver mindeval-sesion-iniciada-en.sql): se fija
    // la primera vez que el candidato desbloquea el contenido y nunca se
    // vuelve a mover -- el navegador calcula el tiempo restante contra esta
    // marca, no contra el momento en que se abrió/recargó la pestaña.
    const iniciadaEn: string = sesion.iniciada_en ?? new Date().toISOString();
    if (sesion.estado === "programada") {
      await supabaseAdmin.from("mindeval_sesiones_prueba").update({ estado: "en_curso", iniciada_en: iniciadaEn }).eq("id", sesion.id);
    } else if (!sesion.iniciada_en) {
      // Sesión legado que ya estaba en_curso antes de esta columna existir --
      // se fija ahora mismo en vez de dejarla en null (mejor aproximación
      // disponible, igual criterio que el backfill de created_at en
      // mindeval-seleccion-etapa8-senescyt-masivo.sql).
      await supabaseAdmin.from("mindeval_sesiones_prueba").update({ iniciada_en: iniciadaEn }).eq("id", sesion.id);
    }

    if (sesion.tipo === "tecnica") {
      const modoTecnica = (vacante as Vacante | null)?.modo_tecnica ?? "caso_abierto";

      if (modoTecnica === "banco") {
        const { data: existente } = await supabaseAdmin
          .from("mindeval_pruebas_tecnicas")
          .select("*")
          .eq("candidato_id", sesion.candidato_id)
          // De esta sesión, o de antes de que existiera la columna (I-12).
          .or(`sesion_id.eq.${sesion.id},sesion_id.is.null`)
          .eq("modo", "banco")
          .is("respuestas_banco", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let preguntasSnapshot: PreguntaBanco[];
        if (existente) {
          preguntasSnapshot = existente.preguntas_snapshot ?? [];
        } else {
          const { data: activas } = await supabaseAdmin
            .from("mindeval_banco_preguntas")
            .select("*")
            .eq("vacante_id", sesion.vacante_id)
            .eq("estado", "activa")
            .order("orden", { ascending: true });

          if (!activas || activas.length === 0) {
            return NextResponse.json(
              { error: "Esta vacante todavía no tiene preguntas técnicas activas. Contacta al reclutador." },
              { status: 409 }
            );
          }

          preguntasSnapshot = activas as PreguntaBanco[];
          const { error: insErr } = await supabaseAdmin.from("mindeval_pruebas_tecnicas").insert({
            candidato_id: sesion.candidato_id,
            // Ata el intento a la invitación que lo originó -- ver
            // supabase/mindeval-tecnicas-sesion.sql (I-12).
            sesion_id: sesion.id,
            modo: "banco",
            preguntas_snapshot: preguntasSnapshot,
            corregido_por: "ia",
          });
          if (insErr) {
            return NextResponse.json({ error: "No se pudo preparar tu prueba. Intenta de nuevo en un momento." }, { status: 500 });
          }
        }

        const preguntas = preguntasSnapshot.map((p) => ({ id: p.id, enunciado: p.enunciado, opciones: p.opciones }));

        return NextResponse.json({
          tipo: "tecnica",
          modo: "banco",
          candidato_id: sesion.candidato_id,
          candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
          iniciada_en: iniciadaEn,
          preguntas,
        });
      }

      const { data: existente } = await supabaseAdmin
        .from("mindeval_pruebas_tecnicas")
        .select("*")
        .eq("candidato_id", sesion.candidato_id)
        .or(`sesion_id.eq.${sesion.id},sesion_id.is.null`)
        .eq("modo", "caso_abierto")
        .is("respuesta_candidato", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existente) {
        return NextResponse.json({
          tipo: "tecnica",
          modo: "caso_abierto",
          candidato_id: sesion.candidato_id,
          candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
          iniciada_en: iniciadaEn,
          caso_generado: existente.caso_generado,
          criterios: existente.criterios,
        });
      }

      const perfil = await resolverPerfilCargo(supabaseAdmin, vacante as Vacante);
      const caso = await generarCasoTecnico((vacante as Vacante).titulo, perfil);
      const { error: insErr } = await supabaseAdmin.from("mindeval_pruebas_tecnicas").insert({
        candidato_id: sesion.candidato_id,
        sesion_id: sesion.id,
        modo: "caso_abierto",
        caso_generado: caso.caso_generado,
        criterios: caso.criterios,
        corregido_por: "ia",
      });
      if (insErr) {
        return NextResponse.json({ error: "No se pudo preparar tu prueba. Intenta de nuevo en un momento." }, { status: 500 });
      }

      return NextResponse.json({
        tipo: "tecnica",
        modo: "caso_abierto",
        candidato_id: sesion.candidato_id,
        candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
        iniciada_en: iniciadaEn,
        caso_generado: caso.caso_generado,
        criterios: caso.criterios,
      });
    }

    if (sesion.tipo === "assessment") {
      let snapshot = (sesion.ejercicios_snapshot as EjercicioBanco[] | null) ?? null;
      if (!snapshot) {
        const { data: activos } = await supabaseAdmin
          .from("mindeval_banco_ejercicios")
          .select("*")
          .eq("vacante_id", sesion.vacante_id)
          .eq("estado", "activa")
          .order("orden", { ascending: true });

        if (!activos || activos.length === 0) {
          return NextResponse.json(
            { error: "Esta vacante todavía no tiene ejercicios de assessment activos. Contacta al reclutador." },
            { status: 409 }
          );
        }

        snapshot = activos as EjercicioBanco[];
        const { error: updErr } = await supabaseAdmin.from("mindeval_sesiones_prueba").update({ ejercicios_snapshot: snapshot }).eq("id", sesion.id);
        if (updErr) {
          return NextResponse.json({ error: "No se pudo preparar tu prueba. Intenta de nuevo en un momento." }, { status: 500 });
        }
      }

      const ejercicios = snapshot.map((e) => ({ id: e.id, competencia: e.competencia, enunciado: e.enunciado }));

      return NextResponse.json({
        tipo: "assessment",
        candidato_id: sesion.candidato_id,
        candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
        iniciada_en: iniciadaEn,
        ejercicios,
      });
    }

    const testsActivos = (vacante as Vacante | null)?.tests_psicometricos ?? [];

    if (testsActivos.length > 0) {
      const tests: Record<string, unknown> = {};
      if (testsActivos.includes("16pf5")) {
        tests["16pf5"] = ITEMS_16PF5.map((it) => ({
          num: it.num,
          texto: it.texto,
          opciones: it.opciones.map((o) => ({ letra: o.letra, texto: o.texto })),
        }));
      }
      if (testsActivos.includes("kostick")) {
        tests["kostick"] = ITEMS_KOSTICK.map((it) => ({ num: it.num, a: it.a, b: it.b }));
      }
      if (testsActivos.includes("disc")) {
        tests["disc"] = ITEMS_DISC.map((it) => ({ num: it.num, palabras: it.palabras.map((p) => p.texto) }));
      }
      if (testsActivos.includes("valanti")) {
        tests["valanti"] = ITEMS_VALANTI.map((it) => ({ num: it.num, fraseA: it.fraseA, fraseB: it.fraseB }));
      }

      return NextResponse.json({
        tipo: "psicometrica",
        modo: "real",
        candidato_id: sesion.candidato_id,
        candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
        iniciada_en: iniciadaEn,
        tests,
      });
    }

    return NextResponse.json({
      tipo: "psicometrica",
      modo: "placeholder",
      candidato_id: sesion.candidato_id,
      candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
      iniciada_en: iniciadaEn,
      items: ITEMS_EJEMPLO,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo cargar tu prueba";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

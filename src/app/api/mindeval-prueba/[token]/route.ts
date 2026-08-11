import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { resolverPerfilCargo } from "@/lib/mindeval-perfil";
import { generarCasoTecnico, corregirCasoTecnico, corregirEjercicioAssessment } from "@/lib/mindeval-ia";
import { calificarBanco, avanzarASenescytSiAplica, calificar16PF5, calificarKostick, calificarDISC } from "@/lib/mindeval-scoring";
import { ITEMS_EJEMPLO } from "@/lib/mindeval-baterias";
import { ITEMS_16PF5 } from "@/lib/mindeval-16pf5";
import { ITEMS_KOSTICK } from "@/lib/mindeval-kostick";
import { ITEMS_DISC } from "@/lib/mindeval-disc";
import type { EjercicioBanco, PreguntaBanco, SesionPrueba, Vacante } from "@/lib/mindeval-types";

// El enlace de una prueba agendada no vive para siempre: si el candidato no
// la rinde dentro de este plazo desde la fecha programada, se considera
// expirado (evita que un correo reenviado o filtrado siga siendo válido
// meses después). El reclutador puede volver a agendarla si hace falta.
const EXPIRACION_DIAS = 7;

function sesionExpirada(sesion: { fecha_programada: string; estado: string }): boolean {
  if (sesion.estado === "completada") return false;
  const limite = new Date(sesion.fecha_programada).getTime() + EXPIRACION_DIAS * 24 * 60 * 60_000;
  return Date.now() > limite;
}

/**
 * Portal del candidato para rendir la prueba agendada — sin login, validado
 * por token (mismo criterio que /api/token/360/[token]). GET prepara/entrega
 * el contenido; POST guarda la respuesta y cierra la sesión.
 *
 * Único movimiento de etapa que esta ruta hace por sí sola: avanzar a
 * verificacion_titulo cuando psicométrica y técnica ya superaron el corte
 * de la vacante (avanzarASenescytSiAplica) — un corte numérico que el
 * reclutador ya configuró, no una decisión nueva de la IA ni del candidato.
 * Cualquier otro avance de etapa (SENESCYT, assessment, entrevista, oferta)
 * sigue siendo decisión manual del reclutador.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { permitido } = checkRateLimit(req, "mindeval-prueba");
  if (!permitido) return rateLimitResponse();

  const { token } = await params;

  const { data: sesion, error } = await supabaseAdmin
    .from("mindeval_sesiones_prueba")
    .select("*, mindeval_candidatos(nombre_completo)")
    .eq("token", token)
    .maybeSingle();

  if (error || !sesion) {
    return NextResponse.json({ error: "Link no válido" }, { status: 404 });
  }
  if (sesion.estado === "completada") {
    return NextResponse.json({ error: "Esta prueba ya fue completada" }, { status: 409 });
  }
  if (sesionExpirada(sesion)) {
    if (sesion.estado !== "expirada") {
      await supabaseAdmin.from("mindeval_sesiones_prueba").update({ estado: "expirada" }).eq("id", sesion.id);
    }
    return NextResponse.json({ error: "Este enlace ha expirado. Solicita al reclutador que te reagende la prueba." }, { status: 410 });
  }
  if (new Date(sesion.fecha_programada).getTime() > Date.now() + 30 * 60_000) {
    return NextResponse.json({ error: "Esta prueba todavía no está disponible. Vuelve a la hora agendada." }, { status: 403 });
  }

  const { data: vacante } = await supabaseAdmin.from("mindeval_vacantes").select("*").eq("id", sesion.vacante_id).single();

  if (sesion.estado === "programada") {
    await supabaseAdmin.from("mindeval_sesiones_prueba").update({ estado: "en_curso" }).eq("id", sesion.id);
  }

  if (sesion.tipo === "tecnica") {
    const modoTecnica = (vacante as Vacante | null)?.modo_tecnica ?? "caso_abierto";

    if (modoTecnica === "banco") {
      // Reutiliza el intento ya asignado a este candidato si existe (evita
      // reasignar preguntas distintas si recarga la página), o lo arma ahora
      // a partir de las preguntas activas del banco de esta vacante.
      const { data: existente } = await supabaseAdmin
        .from("mindeval_pruebas_tecnicas")
        .select("*")
        .eq("candidato_id", sesion.candidato_id)
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
        await supabaseAdmin.from("mindeval_pruebas_tecnicas").insert({
          candidato_id: sesion.candidato_id,
          modo: "banco",
          preguntas_snapshot: preguntasSnapshot,
          corregido_por: "ia",
        });
      }

      // Nunca se envía la respuesta correcta ni los puntos al candidato.
      const preguntas = preguntasSnapshot.map((p) => ({ id: p.id, enunciado: p.enunciado, opciones: p.opciones }));

      return NextResponse.json({
        tipo: "tecnica",
        modo: "banco",
        candidato_id: sesion.candidato_id,
        candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
        preguntas,
      });
    }

    // modo caso_abierto — comportamiento sin cambios.
    // Reutiliza el caso ya generado para este candidato si existe (evita
    // regenerar con IA si el candidato recarga la página), o lo genera ahora.
    const { data: existente } = await supabaseAdmin
      .from("mindeval_pruebas_tecnicas")
      .select("*")
      .eq("candidato_id", sesion.candidato_id)
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
        caso_generado: existente.caso_generado,
        criterios: existente.criterios,
      });
    }

    const perfil = await resolverPerfilCargo(supabaseAdmin, vacante as Vacante);
    const caso = await generarCasoTecnico((vacante as Vacante).titulo, perfil);
    await supabaseAdmin.from("mindeval_pruebas_tecnicas").insert({
      candidato_id: sesion.candidato_id,
      modo: "caso_abierto",
      caso_generado: caso.caso_generado,
      criterios: caso.criterios,
      corregido_por: "ia",
    });

    return NextResponse.json({
      tipo: "tecnica",
      modo: "caso_abierto",
      candidato_id: sesion.candidato_id,
      candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
      caso_generado: caso.caso_generado,
      criterios: caso.criterios,
    });
  }

  if (sesion.tipo === "assessment") {
    // Reutiliza el snapshot ya guardado en la sesión si existe (recarga
    // segura), o lo arma ahora a partir de los ejercicios activos del banco.
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
      await supabaseAdmin.from("mindeval_sesiones_prueba").update({ ejercicios_snapshot: snapshot }).eq("id", sesion.id);
    }

    // Nunca se envían los criterios de evaluación al candidato.
    const ejercicios = snapshot.map((e) => ({ id: e.id, competencia: e.competencia, enunciado: e.enunciado }));

    return NextResponse.json({
      tipo: "assessment",
      candidato_id: sesion.candidato_id,
      candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
      ejercicios,
    });
  }

  const testsActivos = (vacante as Vacante | null)?.tests_psicometricos ?? [];

  if (testsActivos.length > 0) {
    // Nunca se envía al candidato el peso de cada opción (16PF-5) ni a qué
    // factor pertenece cada elección (KOSTICK) — solo el texto necesario
    // para responder, igual que el banco de preguntas técnicas nunca envía
    // respuesta_correcta.
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

    return NextResponse.json({
      tipo: "psicometrica",
      modo: "real",
      candidato_id: sesion.candidato_id,
      candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
      tests,
    });
  }

  return NextResponse.json({
    tipo: "psicometrica",
    modo: "placeholder",
    candidato_id: sesion.candidato_id,
    candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
    items: ITEMS_EJEMPLO,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { permitido } = checkRateLimit(req, "mindeval-prueba");
  if (!permitido) return rateLimitResponse();

  const { token } = await params;
  const body = await req.json();

  const { data: sesion, error } = await supabaseAdmin
    .from("mindeval_sesiones_prueba")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error || !sesion) {
    return NextResponse.json({ error: "Link no válido" }, { status: 404 });
  }
  if (sesion.estado === "completada") {
    return NextResponse.json({ error: "Esta prueba ya fue completada" }, { status: 409 });
  }
  if (sesionExpirada(sesion)) {
    if (sesion.estado !== "expirada") {
      await supabaseAdmin.from("mindeval_sesiones_prueba").update({ estado: "expirada" }).eq("id", sesion.id);
    }
    return NextResponse.json({ error: "Este enlace ha expirado. Solicita al reclutador que te reagende la prueba." }, { status: 410 });
  }

  const s = sesion as SesionPrueba;

  const { data: vacanteCortes } = await supabaseAdmin
    .from("mindeval_vacantes")
    .select("corte_sten, corte_tecnica, tests_psicometricos")
    .eq("id", s.vacante_id)
    .single();

  if (s.tipo === "tecnica") {
    // El intento pendiente puede estar en cualquiera de los dos modos —
    // el filtro cubre ambos casos de "todavía sin calificar" a la vez.
    const { data: prueba } = await supabaseAdmin
      .from("mindeval_pruebas_tecnicas")
      .select("*")
      .eq("candidato_id", s.candidato_id)
      .or("and(modo.eq.caso_abierto,respuesta_candidato.is.null),and(modo.eq.banco,respuestas_banco.is.null)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!prueba) {
      return NextResponse.json({ error: "No se encontró la prueba asignada a esta sesión" }, { status: 404 });
    }

    if (prueba.modo === "banco") {
      const { respuestas }: { respuestas: { pregunta_id: string; opcion_elegida: string }[] } = body;
      if (!respuestas?.length) {
        return NextResponse.json({ error: "Faltan respuestas" }, { status: 400 });
      }

      const { detalle, puntaje_objetivo } = calificarBanco(prueba.preguntas_snapshot ?? [], respuestas);

      await supabaseAdmin
        .from("mindeval_pruebas_tecnicas")
        .update({ respuestas_banco: detalle, puntaje_objetivo })
        .eq("id", prueba.id);
    } else {
      const { respuesta_candidato }: { respuesta_candidato: string } = body;
      if (!respuesta_candidato?.trim()) {
        return NextResponse.json({ error: "Falta la respuesta" }, { status: 400 });
      }

      const correccion = await corregirCasoTecnico(prueba.caso_generado, prueba.criterios, respuesta_candidato);

      await supabaseAdmin
        .from("mindeval_pruebas_tecnicas")
        .update({
          respuesta_candidato,
          puntaje_analisis: correccion.puntaje_analisis,
          puntaje_estrategia: correccion.puntaje_estrategia,
          puntaje_kpis: correccion.puntaje_kpis,
          puntaje_claridad: correccion.puntaje_claridad,
        })
        .eq("id", prueba.id);
    }
  } else if (s.tipo === "assessment") {
    const { respuestas }: { respuestas: { ejercicio_id: string; respuesta: string }[] } = body;
    if (!respuestas?.length) {
      return NextResponse.json({ error: "Faltan respuestas" }, { status: 400 });
    }

    const snapshot = (s.ejercicios_snapshot ?? []) as EjercicioBanco[];
    const filas = [];
    for (const r of respuestas) {
      const ejercicio = snapshot.find((e) => e.id === r.ejercicio_id);
      if (!ejercicio) continue;
      const correccion = await corregirEjercicioAssessment(ejercicio.enunciado, ejercicio.criterios_evaluacion, r.respuesta);
      filas.push({
        candidato_id: s.candidato_id,
        sesion_id: s.id,
        ejercicio: ejercicio.enunciado,
        competencia: ejercicio.competencia,
        puntaje: correccion.puntaje,
        evaluador: "ia",
        notas: correccion.notas,
      });
    }

    await supabaseAdmin.from("mindeval_assessment_evaluaciones").insert(filas);
  } else if ((vacanteCortes?.tests_psicometricos ?? []).length > 0) {
    const testsActivos: string[] = vacanteCortes!.tests_psicometricos;
    const { sexo, respuestas16pf5, respuestasKostick, respuestasDisc }: {
      sexo?: "H" | "F";
      respuestas16pf5?: { num: number; letra: "a" | "b" | "c" }[];
      respuestasKostick?: { num: number; eleccion: "a" | "b" }[];
      respuestasDisc?: { num: number; mas: 1 | 2 | 3 | 4; menos: 1 | 2 | 3 | 4 }[];
    } = body;

    const filas: { candidato_id: string; bateria: string; sten: number; percentil: number | null; respuestas: unknown }[] = [];

    if (testsActivos.includes("16pf5")) {
      if (!sexo || !respuestas16pf5?.length) {
        return NextResponse.json({ error: "Faltan el sexo o las respuestas del 16PF-5" }, { status: 400 });
      }
      const puntajes = calificar16PF5(respuestas16pf5, sexo);
      for (const p of puntajes) {
        if (p.decatipo === null) continue;
        filas.push({
          candidato_id: s.candidato_id,
          bateria: `16pf5_${p.escala}`,
          sten: p.decatipo,
          percentil: p.percentil,
          respuestas: { sexo, puntoBruto: p.puntoBruto, respuestas: respuestas16pf5 },
        });
      }
    }

    if (testsActivos.includes("kostick")) {
      if (!respuestasKostick?.length) {
        return NextResponse.json({ error: "Faltan las respuestas del KOSTICK" }, { status: 400 });
      }
      const puntajes = calificarKostick(respuestasKostick);
      for (const p of puntajes) {
        filas.push({
          candidato_id: s.candidato_id,
          bateria: `kostick_${p.factor}`,
          sten: p.conteo,
          percentil: null,
          respuestas: { respuestas: respuestasKostick },
        });
      }
    }

    if (testsActivos.includes("disc")) {
      if (!respuestasDisc?.length) {
        return NextResponse.json({ error: "Faltan las respuestas del DISC" }, { status: 400 });
      }
      const resultado = calificarDISC(respuestasDisc);
      for (const p of resultado.puntajes) {
        filas.push({
          candidato_id: s.candidato_id,
          bateria: `disc_${p.rasgo}`,
          sten: p.segmento,
          percentil: null,
          respuestas: { puntoBruto: p.puntoBruto, patron: resultado.patron, respuestas: respuestasDisc },
        });
      }
    }

    if (!filas.length) {
      return NextResponse.json({ error: "No se pudo calificar ninguna prueba activa" }, { status: 400 });
    }

    await supabaseAdmin.from("mindeval_pruebas_psicometricas").insert(filas);
  } else {
    const { respuestas }: { respuestas: Record<string, number[]> } = body;
    if (!respuestas || !Object.keys(respuestas).length) {
      return NextResponse.json({ error: "Faltan respuestas" }, { status: 400 });
    }

    const filas = Object.entries(respuestas).map(([bateria, valores]) => {
      const promedio = valores.reduce((a, b) => a + b, 0) / valores.length; // escala 1-5
      const sten = Math.max(1, Math.min(10, Math.round(((promedio - 1) / 4) * 9) + 1));
      return {
        candidato_id: s.candidato_id,
        bateria,
        sten,
        percentil: Math.round(((sten - 1) / 9) * 100),
        respuestas: valores,
      };
    });

    await supabaseAdmin.from("mindeval_pruebas_psicometricas").insert(filas);
  }

  // No-op si la sesión era de assessment (etapa_actual ya no está en
  // psicométricas/tecnica en ese punto) o si falta el otro puntaje todavía.
  if (vacanteCortes) {
    await avanzarASenescytSiAplica(supabaseAdmin, s.candidato_id, vacanteCortes);
  }

  await supabaseAdmin
    .from("mindeval_sesiones_prueba")
    .update({ estado: "completada", completada_en: new Date().toISOString() })
    .eq("id", s.id);

  return NextResponse.json({ ok: true });
}

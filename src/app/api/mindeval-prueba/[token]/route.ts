import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { corregirCasoTecnico, corregirEjercicioAssessment } from "@/lib/mindeval-ia";
import { calificarBanco, avanzarASenescytSiAplica, calificar16PF5, calificarKostick, calificarDISC, calificarVALANTI } from "@/lib/mindeval-scoring";
import { ITEMS_EJEMPLO } from "@/lib/mindeval-baterias";
import { ITEMS_16PF5 } from "@/lib/mindeval-16pf5";
import { ITEMS_KOSTICK } from "@/lib/mindeval-kostick";
import { ITEMS_DISC } from "@/lib/mindeval-disc";
import { ITEMS_VALANTI } from "@/lib/mindeval-valanti";
import type { EjercicioBanco, SesionPrueba } from "@/lib/mindeval-types";
import { sesionExpirada, todaviaNoDisponible, mensajeExpirada, mensajeNoDisponible } from "@/lib/mindeval-ventana-prueba";
import { enviarPruebaCompletada, enviarAvisoPruebaRendida } from "@/lib/mindeval-email";

// La corrección con IA (caso técnico abierto, ejercicios de assessment) y el
// Informe Ejecutivo pueden superar el límite por defecto de las funciones
// serverless de Vercel con un cold start o una respuesta larga -- mismo
// motivo que maxDuration en /api/mindeval-postular.
export const maxDuration = 60;

/**
 * Portal del candidato para rendir la prueba agendada — sin login, validado
 * por token (mismo criterio que /api/token/360/[token]). GET solo confirma
 * que el link es válido y devuelve si hace falta confirmar cédula antes de
 * ver las preguntas — nunca entrega contenido ni genera nada por sí solo
 * (eso vive en POST /api/mindeval-prueba/[token]/contenido, que exige la
 * cédula si el candidato tiene una registrada). POST (abajo) guarda la
 * respuesta final y cierra la sesión.
 *
 * Único movimiento de etapa que esta ruta hace por sí sola: avanzar a
 * verificacion_titulo cuando psicométrica y técnica ya superaron el corte
 * de la vacante (avanzarASenescytSiAplica) — un corte numérico que el
 * reclutador ya configuró, no una decisión nueva de la IA ni del candidato.
 * Cualquier otro avance de etapa (SENESCYT, assessment, entrevista, oferta)
 * sigue siendo decisión manual del reclutador.
 */
/**
 * Qué le espera al candidato, SIN entregar una sola pregunta: cuántos
 * bloques, cuántos ítems tiene cada uno y cuánto dura en total. Alimenta la
 * pantalla de instrucciones previa (auditoría 2026-09, M-1) — antes se
 * pasaba de confirmar la cédula directo a 185 ítems, sin saber cuánto iba a
 * tomar ni qué formato tenían las preguntas.
 *
 * Va en el GET a propósito: este endpoint nunca arranca el cronómetro. Si
 * las instrucciones se mostraran después de desbloquear el contenido, leerlas
 * le comería tiempo de examen al candidato.
 *
 * La duración replica la del portal (duracionMinutos en la página) — misma
 * tabla, para que lo que se le promete sea exactamente lo que va a ver.
 */
async function composicion(sesion: { tipo: string; vacante_id: string }) {
  const bloques: { nombre: string; items: number; formato: string }[] = [];

  if (sesion.tipo === "assessment") {
    const { count } = await supabaseAdmin
      .from("mindeval_banco_ejercicios")
      .select("id", { count: "exact", head: true })
      .eq("vacante_id", sesion.vacante_id)
      .eq("estado", "activa");
    bloques.push({ nombre: "Ejercicios de Assessment Center", items: count ?? 0, formato: "Respuesta escrita a cada situación planteada" });
    return { duracion_minutos: 45, bloques };
  }

  if (sesion.tipo === "tecnica") {
    const { count } = await supabaseAdmin
      .from("mindeval_banco_preguntas")
      .select("id", { count: "exact", head: true })
      .eq("vacante_id", sesion.vacante_id)
      .eq("estado", "activa");
    if ((count ?? 0) > 0) {
      bloques.push({ nombre: "Preguntas técnicas", items: count ?? 0, formato: "Opción múltiple — una respuesta correcta por pregunta" });
      return { duracion_minutos: 40, bloques };
    }
    bloques.push({ nombre: "Caso técnico", items: 1, formato: "Respuesta abierta y desarrollada" });
    return { duracion_minutos: 90, bloques };
  }

  const { data: vacante } = await supabaseAdmin
    .from("mindeval_vacantes")
    .select("tests_psicometricos")
    .eq("id", sesion.vacante_id)
    .maybeSingle();
  const activos: string[] = vacante?.tests_psicometricos ?? [];

  if (!activos.length) {
    const items = Object.values(ITEMS_EJEMPLO).reduce((n, arr) => n + arr.length, 0);
    bloques.push({ nombre: "Cuestionario psicométrico", items, formato: "Escala de 1 a 5" });
    return { duracion_minutos: 30, bloques };
  }

  let minutos = 0;
  if (activos.includes("16pf5")) {
    bloques.push({ nombre: "16PF-5 — Factores de personalidad", items: ITEMS_16PF5.length, formato: "Elige una de tres opciones (a, b o c)" });
    minutos += 45;
  }
  if (activos.includes("kostick")) {
    bloques.push({ nombre: "KOSTICK — Estilo de trabajo", items: ITEMS_KOSTICK.length, formato: "Elige cuál de las dos frases te describe mejor" });
    minutos += 15;
  }
  if (activos.includes("disc")) {
    bloques.push({ nombre: "DISC — Comportamiento", items: ITEMS_DISC.length, formato: "De cada grupo, marca la palabra que MÁS y la que MENOS te describe" });
    minutos += 15;
  }
  if (activos.includes("valanti")) {
    bloques.push({ nombre: "VALANTI — Valores", items: ITEMS_VALANTI.length, formato: "Reparte 3 puntos entre dos frases" });
    minutos += 15;
  }
  return { duracion_minutos: minutos || 30, bloques };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { permitido } = checkRateLimit(req, "mindeval-prueba");
  if (!permitido) return rateLimitResponse();

  const { token } = await params;

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
  if (sesionExpirada(sesion)) {
    if (sesion.estado !== "expirada") {
      await supabaseAdmin.from("mindeval_sesiones_prueba").update({ estado: "expirada" }).eq("id", sesion.id);
    }
    return NextResponse.json({ error: mensajeExpirada(sesion) }, { status: 410 });
  }
  if (todaviaNoDisponible(sesion)) {
    return NextResponse.json({ error: mensajeNoDisponible(sesion) }, { status: 403 });
  }

  return NextResponse.json({
    tipo: sesion.tipo,
    candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
    requiere_cedula: !!sesion.mindeval_candidatos?.cedula,
    composicion: await composicion(sesion),
    // Si ya la había empezado, las instrucciones no vuelven a bloquearle el
    // paso: su cronómetro ya está corriendo.
    ya_iniciada: sesion.estado === "en_curso",
  });
}

/**
 * Guarda la respuesta final y cierra la sesión. Regla estricta en toda esta
 * función (auditoría 2026-09): si CUALQUIER escritura falla, se responde un
 * error accionable y la sesión NO se marca 'completada' -- antes, un error
 * de Supabase silencioso (ej. una fila que viola un CHECK) dejaba al
 * candidato ver "Prueba enviada" con el enlace ya cerrado y ningún resultado
 * guardado. Dejar el enlace vivo permite reintentar; para técnica eso es
 * seguro (el siguiente intento vuelve a encontrar la fila con
 * respuesta_candidato/respuestas_banco todavía en null). Para
 * psicométricas/assessment un reintento tras un fallo tardío (ya insertado,
 * falla solo el cierre de la sesión) podría en teoría duplicar filas -- caso
 * extremo que no bloquea este arreglo, el defecto que resuelve (resultados
 * perdidos en silencio) es muchísimo más grave y frecuente.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { permitido } = checkRateLimit(req, "mindeval-prueba");
  if (!permitido) return rateLimitResponse();

  const { token } = await params;

  try {
    const body = await req.json();

    const { data: sesion, error } = await supabaseAdmin
      .from("mindeval_sesiones_prueba")
      .select("*, mindeval_candidatos(nombre_completo, email)")
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
      return NextResponse.json({ error: mensajeExpirada(sesion) }, { status: 410 });
    }

    const s = sesion as SesionPrueba;
    const nombreCandidato = (sesion as unknown as { mindeval_candidatos?: { nombre_completo?: string } }).mindeval_candidatos?.nombre_completo ?? "el candidato";

    const { data: vacanteCortes } = await supabaseAdmin
      .from("mindeval_vacantes")
      .select("corte_sten, corte_tecnica, tests_psicometricos, titulo, empresa, contacto_nombre, contacto_email")
      .eq("id", s.vacante_id)
      .single();

    const errorGuardado = () =>
      NextResponse.json(
        { error: "No se pudieron guardar tus respuestas por un problema del servidor. Tu enlace sigue activo -- vuelve a intentarlo." },
        { status: 500 }
      );

    if (s.tipo === "tecnica") {
      // El intento pendiente puede estar en cualquiera de los dos modos —
      // el filtro cubre ambos casos de "todavía sin calificar" a la vez.
      // Se busca el intento de ESTA sesión. Antes se buscaba solo por
      // candidato_id, así que con dos enlaces vivos a la vez (I-12) las
      // respuestas de un intento podían escribirse sobre la fila del otro.
      // Las filas anteriores a la columna sesion_id se siguen aceptando.
      const { data: prueba } = await supabaseAdmin
        .from("mindeval_pruebas_tecnicas")
        .select("*")
        .eq("candidato_id", s.candidato_id)
        .or(`sesion_id.eq.${s.id},sesion_id.is.null`)
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

        const { error: updErr } = await supabaseAdmin
          .from("mindeval_pruebas_tecnicas")
          .update({ respuestas_banco: detalle, puntaje_objetivo })
          .eq("id", prueba.id);
        if (updErr) return errorGuardado();
      } else {
        const { respuesta_candidato }: { respuesta_candidato: string } = body;
        if (!respuesta_candidato?.trim()) {
          return NextResponse.json({ error: "Falta la respuesta" }, { status: 400 });
        }

        const correccion = await corregirCasoTecnico(prueba.caso_generado, prueba.criterios, respuesta_candidato);

        const { error: updErr } = await supabaseAdmin
          .from("mindeval_pruebas_tecnicas")
          .update({
            respuesta_candidato,
            puntaje_analisis: correccion.puntaje_analisis,
            puntaje_estrategia: correccion.puntaje_estrategia,
            puntaje_kpis: correccion.puntaje_kpis,
            puntaje_claridad: correccion.puntaje_claridad,
          })
          .eq("id", prueba.id);
        if (updErr) return errorGuardado();
      }
    } else if (s.tipo === "assessment") {
      const { respuestas }: { respuestas: { ejercicio_id: string; respuesta: string }[] } = body;
      if (!respuestas?.length) {
        return NextResponse.json({ error: "Faltan respuestas" }, { status: 400 });
      }

      const snapshot = (s.ejercicios_snapshot ?? []) as EjercicioBanco[];
      // Se corrigen todos los ejercicios en paralelo -- antes se hacía uno a
      // la vez (un assessment de 4-5 ejercicios podía tardar minutos en
      // serie y superar el límite de la función serverless).
      const filas = (
        await Promise.all(
          respuestas.map(async (r) => {
            const ejercicio = snapshot.find((e) => e.id === r.ejercicio_id);
            if (!ejercicio) return null;
            const correccion = await corregirEjercicioAssessment(ejercicio.enunciado, ejercicio.criterios_evaluacion, r.respuesta);
            return {
              candidato_id: s.candidato_id,
              sesion_id: s.id,
              ejercicio: ejercicio.enunciado,
              competencia: ejercicio.competencia,
              puntaje: correccion.puntaje,
              evaluador: "ia",
              notas: correccion.notas,
            };
          })
        )
      ).filter((f): f is NonNullable<typeof f> => f !== null);

      const { error: insErr } = await supabaseAdmin.from("mindeval_assessment_evaluaciones").insert(filas);
      if (insErr) return errorGuardado();
    } else if ((vacanteCortes?.tests_psicometricos ?? []).length > 0) {
      const testsActivos: string[] = vacanteCortes!.tests_psicometricos;
      const { sexo, respuestas16pf5, respuestasKostick, respuestasDisc, respuestasValanti }: {
        sexo?: "H" | "F";
        respuestas16pf5?: { num: number; letra: "a" | "b" | "c" }[];
        respuestasKostick?: { num: number; eleccion: "a" | "b" }[];
        respuestasDisc?: { num: number; mas: 1 | 2 | 3 | 4; menos: 1 | 2 | 3 | 4 }[];
        respuestasValanti?: { num: number; puntosFraseA: 0 | 1 | 2 | 3 }[];
      } = body;

      // Cuántos ítems respondió de verdad el candidato frente a cuántos tenía
      // la batería. Un envío por tiempo agotado llega con menos de los
      // esperados -- sin esta marca, calificar*() calcula sobre puntajes
      // brutos parciales y el resultado queda indistinguible de un test
      // completo (ver mindeval-psicometricas-completitud.sql). El total
      // siempre se toma del banco en el servidor, nunca de lo que diga el
      // navegador.
      const filas: {
        candidato_id: string;
        bateria: string;
        sten: number | null;
        puntaje_estandar?: number;
        percentil: number | null;
        respuestas: unknown;
        items_respondidos: number;
        items_esperados: number;
      }[] = [];

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
            items_respondidos: respuestas16pf5.length,
            items_esperados: ITEMS_16PF5.length,
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
            items_respondidos: respuestasKostick.length,
            items_esperados: ITEMS_KOSTICK.length,
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
            items_respondidos: respuestasDisc.length,
            items_esperados: ITEMS_DISC.length,
          });
        }
      }

      if (testsActivos.includes("valanti")) {
        if (!respuestasValanti?.length) {
          return NextResponse.json({ error: "Faltan las respuestas del VALANTI" }, { status: 400 });
        }
        const resultado = calificarVALANTI(respuestasValanti, nombreCandidato);
        for (const p of resultado.puntajes) {
          filas.push({
            candidato_id: s.candidato_id,
            bateria: `valanti_${p.escala}`,
            // El puntaje estándar de VALANTI (media 50/DE 10) no cabe en
            // `sten` (CHECK 0-10, pensado para 16PF-5/KOSTICK/DISC) -- va en
            // su propia columna. Ver mindeval-valanti-puntaje-estandar.sql.
            sten: null,
            puntaje_estandar: p.puntajeEstandar,
            percentil: null,
            respuestas: {
              puntoBruto: p.puntoBruto,
              nivel: p.nivel,
              distanciaOrganizacion: p.distanciaOrganizacion,
              areaMasImportante: resultado.areaMasImportante,
              areaMenosImportante: resultado.areaMenosImportante,
              respuestas: respuestasValanti,
            },
            items_respondidos: respuestasValanti.length,
            items_esperados: ITEMS_VALANTI.length,
          });
        }
      }

      if (!filas.length) {
        return NextResponse.json({ error: "No se pudo calificar ninguna prueba activa" }, { status: 400 });
      }

      const { error: insErr } = await supabaseAdmin.from("mindeval_pruebas_psicometricas").insert(filas);
      if (insErr) return errorGuardado();
    } else {
      const { respuestas }: { respuestas: Record<string, number[]> } = body;
      if (!respuestas || !Object.keys(respuestas).length) {
        return NextResponse.json({ error: "Faltan respuestas" }, { status: 400 });
      }

      const filas = Object.entries(respuestas).map(([bateria, valores]) => {
        const respondidos = valores.filter((v) => v !== null && v !== undefined);
        const promedio = respondidos.reduce((a, b) => a + b, 0) / (respondidos.length || 1); // escala 1-5
        const sten = Math.max(1, Math.min(10, Math.round(((promedio - 1) / 4) * 9) + 1));
        return {
          candidato_id: s.candidato_id,
          bateria,
          sten,
          percentil: Math.round(((sten - 1) / 9) * 100),
          respuestas: valores,
          items_respondidos: respondidos.length,
          items_esperados: ITEMS_EJEMPLO[bateria]?.length ?? valores.length,
        };
      });

      const { error: insErr } = await supabaseAdmin.from("mindeval_pruebas_psicometricas").insert(filas);
      if (insErr) return errorGuardado();
    }

    // No-op si la sesión era de assessment (etapa_actual ya no está en
    // psicométricas/tecnica en ese punto) o si falta el otro puntaje todavía.
    if (vacanteCortes) {
      await avanzarASenescytSiAplica(supabaseAdmin, s.candidato_id, vacanteCortes);
    }

    const { error: cierreErr } = await supabaseAdmin
      .from("mindeval_sesiones_prueba")
      .update({ estado: "completada", completada_en: new Date().toISOString() })
      .eq("id", s.id);
    if (cierreErr) return errorGuardado();

    // Acuse al candidato y aviso al reclutador (auditoría 2026-09, I-7).
    // Van DESPUÉS del cierre y sin await: la prueba ya está guardada y
    // calificada, y un fallo de correo no puede convertirse en un error para
    // quien acaba de rendir 185 ítems.
    if (vacanteCortes) {
      const emailCandidato = (sesion as unknown as { mindeval_candidatos?: { email?: string | null } }).mindeval_candidatos?.email;
      if (emailCandidato) {
        void enviarPruebaCompletada({
          to: emailCandidato,
          nombreCandidato,
          tituloVacante: vacanteCortes.titulo,
          empresa: vacanteCortes.empresa,
          tipo: s.tipo,
          contacto: { nombre: vacanteCortes.contacto_nombre, email: vacanteCortes.contacto_email },
        }).catch(() => {});
      }
      if (vacanteCortes.contacto_email) {
        void enviarAvisoPruebaRendida({
          to: vacanteCortes.contacto_email,
          nombreCandidato,
          tituloVacante: vacanteCortes.titulo,
          tipo: s.tipo,
          linkFicha: `${req.nextUrl.origin}/seleccion/${s.vacante_id}/candidato/${s.candidato_id}`,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo enviar la prueba";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

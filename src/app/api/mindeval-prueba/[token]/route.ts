import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { corregirCasoTecnico, corregirEjercicioAssessment } from "@/lib/mindeval-ia";
import { calificarBanco, avanzarASenescytSiAplica, calificar16PF5, calificarKostick, calificarDISC, calificarVALANTI } from "@/lib/mindeval-scoring";
import type { EjercicioBanco, SesionPrueba } from "@/lib/mindeval-types";

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
    return NextResponse.json({ error: "Este enlace ha expirado. Solicita al reclutador que te reagende la prueba." }, { status: 410 });
  }
  if (new Date(sesion.fecha_programada).getTime() > Date.now() + 30 * 60_000) {
    return NextResponse.json({ error: "Esta prueba todavía no está disponible. Vuelve a la hora agendada." }, { status: 403 });
  }
  // Ventana de 30 min antes a 1 hora después de la hora agendada -- fuera de
  // eso, aunque el link siga vivo (no ha llegado a los EXPIRACION_DIAS),
  // exige que el candidato entre a la hora que se le indicó, en vez de
  // dejarlo abrir el mismo link horas o días después sin más control. No
  // aplica si ya está "en_curso" -- un candidato que ya desbloqueó la prueba
  // y recarga la página cerca de que se le acabe el tiempo no debe quedar
  // bloqueado a mitad de su propio intento.
  if (sesion.estado !== "en_curso" && Date.now() > new Date(sesion.fecha_programada).getTime() + 60 * 60_000) {
    return NextResponse.json(
      { error: "Ya pasó la hora agendada para esta prueba. Contacta al reclutador para que te reagende un nuevo horario." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    tipo: sesion.tipo,
    candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
    requiere_cedula: !!sesion.mindeval_candidatos?.cedula,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { permitido } = checkRateLimit(req, "mindeval-prueba");
  if (!permitido) return rateLimitResponse();

  const { token } = await params;
  const body = await req.json();

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

  const s = sesion as SesionPrueba;
  const nombreCandidato = (sesion as unknown as { mindeval_candidatos?: { nombre_completo?: string } }).mindeval_candidatos?.nombre_completo ?? "el candidato";

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
    const { sexo, respuestas16pf5, respuestasKostick, respuestasDisc, respuestasValanti }: {
      sexo?: "H" | "F";
      respuestas16pf5?: { num: number; letra: "a" | "b" | "c" }[];
      respuestasKostick?: { num: number; eleccion: "a" | "b" }[];
      respuestasDisc?: { num: number; mas: 1 | 2 | 3 | 4; menos: 1 | 2 | 3 | 4 }[];
      respuestasValanti?: { num: number; puntosFraseA: 0 | 1 | 2 | 3 }[];
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

    if (testsActivos.includes("valanti")) {
      if (!respuestasValanti?.length) {
        return NextResponse.json({ error: "Faltan las respuestas del VALANTI" }, { status: 400 });
      }
      const resultado = calificarVALANTI(respuestasValanti, nombreCandidato);
      for (const p of resultado.puntajes) {
        filas.push({
          candidato_id: s.candidato_id,
          bateria: `valanti_${p.escala}`,
          sten: p.puntajeEstandar,
          percentil: null,
          respuestas: {
            puntoBruto: p.puntoBruto,
            nivel: p.nivel,
            distanciaOrganizacion: p.distanciaOrganizacion,
            areaMasImportante: resultado.areaMasImportante,
            areaMenosImportante: resultado.areaMenosImportante,
            respuestas: respuestasValanti,
          },
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

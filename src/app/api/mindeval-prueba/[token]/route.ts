import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolverPerfilCargo } from "@/lib/mindeval-perfil";
import { generarCasoTecnico, corregirCasoTecnico } from "@/lib/mindeval-ia";
import { ITEMS_EJEMPLO } from "@/lib/mindeval-baterias";
import type { SesionPrueba, Vacante } from "@/lib/mindeval-types";

/**
 * Portal del candidato para rendir la prueba agendada — sin login, validado
 * por token (mismo criterio que /api/token/360/[token]). GET prepara/entrega
 * el contenido; POST guarda la respuesta y cierra la sesión. El avance de
 * etapa del candidato sigue siendo decisión del reclutador: esta ruta nunca
 * mueve etapa_actual, solo guarda resultados para que el reclutador los vea.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
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
  if (new Date(sesion.fecha_programada).getTime() > Date.now() + 30 * 60_000) {
    return NextResponse.json({ error: "Esta prueba todavía no está disponible. Vuelve a la hora agendada." }, { status: 403 });
  }

  const { data: vacante } = await supabaseAdmin.from("mindeval_vacantes").select("*").eq("id", sesion.vacante_id).single();

  if (sesion.estado === "programada") {
    await supabaseAdmin.from("mindeval_sesiones_prueba").update({ estado: "en_curso" }).eq("id", sesion.id);
  }

  if (sesion.tipo === "tecnica") {
    // Reutiliza el caso ya generado para este candidato si existe (evita
    // regenerar con IA si el candidato recarga la página), o lo genera ahora.
    const { data: existente } = await supabaseAdmin
      .from("mindeval_pruebas_tecnicas")
      .select("*")
      .eq("candidato_id", sesion.candidato_id)
      .is("respuesta_candidato", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existente) {
      return NextResponse.json({
        tipo: "tecnica",
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
      caso_generado: caso.caso_generado,
      criterios: caso.criterios,
      corregido_por: "ia",
    });

    return NextResponse.json({
      tipo: "tecnica",
      candidato_id: sesion.candidato_id,
      candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
      caso_generado: caso.caso_generado,
      criterios: caso.criterios,
    });
  }

  return NextResponse.json({
    tipo: "psicometrica",
    candidato_id: sesion.candidato_id,
    candidato_nombre: sesion.mindeval_candidatos?.nombre_completo,
    items: ITEMS_EJEMPLO,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
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

  const s = sesion as SesionPrueba;

  if (s.tipo === "tecnica") {
    const { respuesta_candidato }: { respuesta_candidato: string } = body;
    if (!respuesta_candidato?.trim()) {
      return NextResponse.json({ error: "Falta la respuesta" }, { status: 400 });
    }

    const { data: prueba } = await supabaseAdmin
      .from("mindeval_pruebas_tecnicas")
      .select("*")
      .eq("candidato_id", s.candidato_id)
      .is("respuesta_candidato", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!prueba) {
      return NextResponse.json({ error: "No se encontró el caso asignado a esta sesión" }, { status: 404 });
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

  await supabaseAdmin
    .from("mindeval_sesiones_prueba")
    .update({ estado: "completada", completada_en: new Date().toISOString() })
    .eq("id", s.id);

  return NextResponse.json({ ok: true });
}

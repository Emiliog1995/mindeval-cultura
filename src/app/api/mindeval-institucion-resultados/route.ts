import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { autorizarInstitucion } from "@/lib/mindeval-institucion";
import { NOMBRES_ESCALA_16PF5 } from "@/lib/mindeval-16pf5";
import { NOMBRES_FACTOR_KOSTICK } from "@/lib/mindeval-kostick";
import { NOMBRES_RASGO_DISC } from "@/lib/mindeval-disc";
import { NOMBRES_ESCALA_VALANTI } from "@/lib/mindeval-valanti";
import { psicometricaIncompleta } from "@/lib/mindeval-scoring";

/**
 * Resultados de un evaluado de un proceso de institución (USECIPOL).
 *
 * SOLO puntajes objetivos tal como salen de la calificación determinista, la
 * completitud de cada prueba (ítems respondidos / esperados) y las alertas
 * de navegador tal cual se registraron. NO hay veredictos: ni "prueba
 * invalidada", ni índice de aptitud, ni texto generado por IA. En la
 * plataforma anterior esos veredictos automáticos invalidaron cohortes
 * enteras por un umbral mal calibrado; aquí la persona que revisa decide.
 */

const NOMBRE_BATERIA: Record<string, string> = { "16pf5": "16PF-5", kostick: "KOSTICK", disc: "DISC", valanti: "VALANTI" };

function nombreEscala(bateria: string, clave: string): string {
  const mapas: Record<string, Record<string, string>> = {
    "16pf5": NOMBRES_ESCALA_16PF5 as Record<string, string>,
    kostick: NOMBRES_FACTOR_KOSTICK as Record<string, string>,
    disc: NOMBRES_RASGO_DISC as Record<string, string>,
    valanti: NOMBRES_ESCALA_VALANTI as Record<string, string>,
  };
  return mapas[bateria]?.[clave] ?? clave;
}

export async function GET(req: NextRequest) {
  const vacanteId = req.nextUrl.searchParams.get("vacante_id");
  const candidatoId = req.nextUrl.searchParams.get("candidato_id");
  if (!vacanteId || !candidatoId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const aut = await autorizarInstitucion(req, { roles: ["super_admin", "administrador", "evaluador"], vacanteId });
  if ("error" in aut) return aut.error;

  const { permitido } = checkRateLimit(req, "mindeval-institucion-resultados");
  if (!permitido) return rateLimitResponse();

  const { data: cand } = await supabaseAdmin
    .from("mindeval_candidatos")
    .select("id, nombre_completo, cedula")
    .eq("id", candidatoId)
    .eq("vacante_id", vacanteId)
    .maybeSingle();
  if (!cand) return NextResponse.json({ error: "Evaluado no encontrado en este proceso" }, { status: 404 });

  const [{ data: filas }, { data: alertas }, { data: sesion }] = await Promise.all([
    supabaseAdmin
      .from("mindeval_pruebas_psicometricas")
      .select("bateria, sten, puntaje_estandar, percentil, items_respondidos, items_esperados, aplicada_en, respuestas")
      .eq("candidato_id", candidatoId)
      .order("aplicada_en", { ascending: true }),
    supabaseAdmin
      .from("mindeval_alertas_fraude")
      .select("tipo_alerta, severidad, detalle, creado_en")
      .eq("candidato_id", candidatoId)
      .order("creado_en", { ascending: true }),
    supabaseAdmin
      .from("mindeval_sesiones_prueba")
      .select("estado, iniciada_en, completada_en")
      .eq("candidato_id", candidatoId)
      .eq("vacante_id", vacanteId)
      .eq("tipo", "psicometrica")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Agrupa por prueba. La clave guardada es "<prueba>_<escala>".
  const grupos = new Map<string, { escala: string; sten: number | null; puntaje_estandar: number | null; percentil: number | null }[]>();
  const completitud = new Map<string, { respondidos: number | null; esperados: number | null; incompleta: boolean }>();
  let patronDisc: string | null = null;

  for (const f of filas ?? []) {
    const i = f.bateria.indexOf("_");
    const prueba = i === -1 ? f.bateria : f.bateria.slice(0, i);
    const clave = i === -1 ? f.bateria : f.bateria.slice(i + 1);
    if (!grupos.has(prueba)) grupos.set(prueba, []);
    grupos.get(prueba)!.push({
      escala: nombreEscala(prueba, clave),
      sten: f.sten,
      puntaje_estandar: f.puntaje_estandar ?? null,
      percentil: f.percentil,
    });
    completitud.set(prueba, {
      respondidos: f.items_respondidos,
      esperados: f.items_esperados,
      incompleta: psicometricaIncompleta(f),
    });
    const patron = (f.respuestas as { patron?: string } | null)?.patron;
    if (prueba === "disc" && patron) patronDisc = patron;
  }

  const pruebas = [...grupos.entries()].map(([p, escalas]) => ({
    prueba: NOMBRE_BATERIA[p] ?? p.toUpperCase(),
    codigo: p,
    escalas,
    completitud: completitud.get(p),
    patron: p === "disc" ? patronDisc : null,
  }));

  return NextResponse.json({
    evaluado: { nombre: cand.nombre_completo, cedula: cand.cedula },
    sesion: sesion ?? null,
    pruebas,
    alertas: alertas ?? [],
  });
}

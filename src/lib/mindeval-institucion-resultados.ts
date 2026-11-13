import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { NOMBRES_ESCALA_16PF5 } from "@/lib/mindeval-16pf5";
import { NOMBRES_FACTOR_KOSTICK } from "@/lib/mindeval-kostick";
import { NOMBRES_RASGO_DISC } from "@/lib/mindeval-disc";
import { NOMBRES_ESCALA_VALANTI } from "@/lib/mindeval-valanti";
import { psicometricaIncompleta } from "@/lib/mindeval-scoring";

/**
 * Resultados de un evaluado de institución: SOLO puntajes objetivos tal como
 * salen de la calificación determinista, completitud por prueba y alertas de
 * navegador tal cual se registraron. Ningún veredicto automático.
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

export interface ResultadoEvaluado {
  evaluado: { nombre: string; cedula: string | null };
  perfil: "estudiante" | "docente" | null;
  sesion: { estado: string; iniciada_en: string | null; completada_en: string | null } | null;
  pruebas: {
    prueba: string;
    codigo: string;
    escalas: { escala: string; sten: number | null; puntaje_estandar: number | null; percentil: number | null }[];
    completitud?: { respondidos: number | null; esperados: number | null; incompleta: boolean };
    patron: string | null;
  }[];
  alertas: { tipo_alerta: string; severidad: string; detalle: string | null; creado_en: string }[];
}

export async function cargarResultadosEvaluado(vacanteId: string, candidatoId: string): Promise<ResultadoEvaluado | null> {
  const { data: cand } = await supabaseAdmin
    .from("mindeval_candidatos")
    .select("id, nombre_completo, cedula")
    .eq("id", candidatoId)
    .eq("vacante_id", vacanteId)
    .maybeSingle();
  if (!cand) return null;

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
      .select("estado, iniciada_en, completada_en, perfil_evaluado")
      .eq("candidato_id", candidatoId)
      .eq("vacante_id", vacanteId)
      .eq("tipo", "psicometrica")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

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
    completitud.set(prueba, { respondidos: f.items_respondidos, esperados: f.items_esperados, incompleta: psicometricaIncompleta(f) });
    const patron = (f.respuestas as { patron?: string } | null)?.patron;
    if (prueba === "disc" && patron) patronDisc = patron;
  }

  const perfil = sesion?.perfil_evaluado === "estudiante" || sesion?.perfil_evaluado === "docente" ? sesion.perfil_evaluado : null;

  return {
    evaluado: { nombre: cand.nombre_completo, cedula: cand.cedula },
    perfil,
    sesion: sesion ? { estado: sesion.estado, iniciada_en: sesion.iniciada_en, completada_en: sesion.completada_en } : null,
    pruebas: [...grupos.entries()].map(([p, escalas]) => ({
      prueba: NOMBRE_BATERIA[p] ?? p.toUpperCase(),
      codigo: p,
      escalas,
      completitud: completitud.get(p),
      patron: p === "disc" ? patronDisc : null,
    })),
    alertas: alertas ?? [],
  };
}

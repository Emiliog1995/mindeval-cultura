import { createClient } from "@supabase/supabase-js";
import type { ScoringResult } from "./scoring";
import type { ClimaResult } from "./clima-scoring";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export interface EvaluadoInput {
  nombre:    string;
  cargo:     string;
  area:      string;
  empresa:   string;
  respuestas: Record<string, number>;
  scores:    ScoringResult;
}

export interface Evaluacion extends EvaluadoInput {
  id:           string;
  created_at:   string;
  score_global: number;
  nivel:        string;
}

export async function guardarEvaluacion(data: EvaluadoInput): Promise<string> {
  const { data: row, error } = await supabase
    .from("evaluaciones")
    .insert({
      nombre:       data.nombre,
      cargo:        data.cargo,
      area:         data.area,
      empresa:      data.empresa,
      respuestas:   data.respuestas,
      scores:       data.scores,
      score_global: data.scores.global,
      nivel:        data.scores.globalLevel,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return row.id as string;
}

export async function obtenerEvaluacion(id: string): Promise<Evaluacion> {
  const { data, error } = await supabase
    .from("evaluaciones")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as Evaluacion;
}

export async function listarEvaluaciones(): Promise<Evaluacion[]> {
  const { data, error } = await supabase
    .from("evaluaciones")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Evaluacion[];
}

// ─── Clima Laboral ───────────────────────────────────────────────────────────

export interface ClimaInput {
  respuestas: Record<string, number>;
  scores:     ClimaResult;
}

export interface ClimaRespuesta {
  id:           string;
  created_at:   string;
  respuestas:   Record<string, number>;
  scores:       ClimaResult;
  score_global: number;
  nivel:        string;
}

export async function guardarClima(data: ClimaInput): Promise<string> {
  const { data: row, error } = await supabase
    .from("clima_respuestas")
    .insert({
      respuestas:   data.respuestas,
      scores:       data.scores,
      score_global: data.scores.global,
      nivel:        data.scores.globalLevel,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return row.id as string;
}

export async function listarClima(): Promise<ClimaRespuesta[]> {
  const { data, error } = await supabase
    .from("clima_respuestas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ClimaRespuesta[];
}

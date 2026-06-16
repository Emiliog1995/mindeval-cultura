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
  nombre?:    string;
  cargo?:     string;
  area?:      string;
  empresa?:   string;
}

export interface ClimaRespuesta {
  id:           string;
  created_at:   string;
  respuestas:   Record<string, number>;
  scores:       ClimaResult;
  score_global: number;
  nombre?:      string;
  cargo?:       string;
  area?:        string;
  empresa?:     string;
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
      nombre:       data.nombre ?? null,
      cargo:        data.cargo  ?? null,
      area:         data.area   ?? null,
      empresa:      data.empresa ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return row.id as string;
}

export async function obtenerClima(id: string): Promise<ClimaRespuesta> {
  const { data, error } = await supabase
    .from("clima_respuestas")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as ClimaRespuesta;
}

export async function listarClima(): Promise<ClimaRespuesta[]> {
  const { data, error } = await supabase
    .from("clima_respuestas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ClimaRespuesta[];
}

export async function eliminarEvaluacion(id: string): Promise<void> {
  const { error } = await supabase.from("evaluaciones").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eliminarClima(id: string): Promise<void> {
  const { error } = await supabase.from("clima_respuestas").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Sesiones ─────────────────────────────────────────────────────────────────

export interface Sesion {
  id:         string;
  tipo:       'cultura' | 'clima' | 'salud';
  empresa:    string | null;
  estado:     'pendiente' | 'completada';
  created_at: string;
}

export interface SesionInput {
  tipo:     'cultura' | 'clima' | 'salud';
  empresa?: string;
}

export async function crearSesion(data: SesionInput): Promise<Sesion> {
  const { data: row, error } = await supabase
    .from("sesiones")
    .insert({ tipo: data.tipo, empresa: data.empresa ?? null })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row as Sesion;
}

export async function listarSesiones(): Promise<Sesion[]> {
  const { data, error } = await supabase
    .from("sesiones")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Sesion[];
}

export async function completarSesion(id: string): Promise<void> {
  const { error } = await supabase
    .from("sesiones")
    .update({ estado: 'completada' })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eliminarSesion(id: string): Promise<void> {
  const { error } = await supabase.from("sesiones").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── 360° ──────────────────────────────────────────────────────────────────────

import type { Evaluado360, Evaluacion360, Pdi360, Token360, FuenteEvaluacion } from './360-types';
export type { Evaluado360, Evaluacion360, Pdi360, Token360 };

export async function listar360Evaluados(): Promise<Evaluado360[]> {
  const { data, error } = await supabase
    .from('evaluados_360')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Evaluado360[];
}

export async function crear360Evaluado(
  data: Omit<Evaluado360, 'id' | 'created_at'>,
): Promise<Evaluado360> {
  const { data: row, error } = await supabase
    .from('evaluados_360')
    .insert(data)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return row as Evaluado360;
}

export async function obtener360Evaluado(id: string): Promise<Evaluado360> {
  const { data, error } = await supabase
    .from('evaluados_360')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data as Evaluado360;
}

export async function listar360Evaluaciones(
  evaluadoId: string,
  periodo?: string,
): Promise<Evaluacion360[]> {
  let q = supabase
    .from('evaluaciones_360')
    .select('*')
    .eq('evaluado_id', evaluadoId);
  if (periodo) q = q.eq('periodo', periodo);
  const { data, error } = await q.order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Evaluacion360[];
}

export async function crear360Evaluacion(
  data: Omit<Evaluacion360, 'id' | 'created_at'>,
): Promise<Evaluacion360> {
  const { data: row, error } = await supabase
    .from('evaluaciones_360')
    .insert(data)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return row as Evaluacion360;
}

export async function listarTodas360Evaluaciones(): Promise<Evaluacion360[]> {
  const { data, error } = await supabase
    .from('evaluaciones_360')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Evaluacion360[];
}

export async function obtener360Pdi(
  evaluadoId: string,
  periodo: string,
): Promise<Pdi360 | null> {
  const { data, error } = await supabase
    .from('pdi_360')
    .select('*')
    .eq('evaluado_id', evaluadoId)
    .eq('periodo', periodo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Pdi360 | null;
}

export async function upsert360Pdi(
  data: Omit<Pdi360, 'id' | 'created_at'>,
): Promise<Pdi360> {
  const { data: row, error } = await supabase
    .from('pdi_360')
    .upsert(data, { onConflict: 'evaluado_id,periodo' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return row as Pdi360;
}

// ── Tokens 360° (links de evaluadores) ──────────────────────────────────────

export async function crearTokens360(
  evaluadoId: string,
  periodo: string,
  fuentes: FuenteEvaluacion[],
): Promise<Token360[]> {
  const filas = fuentes.map((fuente) => ({
    evaluado_id: evaluadoId,
    periodo,
    fuente,
    completado: false,
  }));
  const { data, error } = await supabase
    .from('tokens_360')
    .insert(filas)
    .select('*');
  if (error) throw new Error(error.message);
  return (data ?? []) as Token360[];
}

export async function listarTokens360PorEvaluado(evaluadoId: string): Promise<Token360[]> {
  const { data, error } = await supabase
    .from('tokens_360')
    .select('*')
    .eq('evaluado_id', evaluadoId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Token360[];
}

export async function listarTokens360(
  evaluadoId: string,
  periodo: string,
): Promise<Token360[]> {
  const { data, error } = await supabase
    .from('tokens_360')
    .select('*')
    .eq('evaluado_id', evaluadoId)
    .eq('periodo', periodo)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Token360[];
}

export async function obtenerToken360(token: string): Promise<{ token: Token360; evaluado: Evaluado360 } | null> {
  const { data, error } = await supabase
    .from('tokens_360')
    .select('*, evaluados_360(*)')
    .eq('token', token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { evaluados_360, ...token360 } = data as Token360 & { evaluados_360: Evaluado360 };
  return { token: token360, evaluado: evaluados_360 };
}

export async function completarToken360(
  token: string,
  competencias: Record<string, number>,
  potencial?: Record<string, number>,
): Promise<void> {
  const tokenRow = await obtenerToken360(token);
  if (!tokenRow) throw new Error('Link no válido o expirado');
  if (tokenRow.token.completado) throw new Error('Esta evaluación ya fue enviada');

  await crear360Evaluacion({
    evaluado_id: tokenRow.token.evaluado_id,
    periodo: tokenRow.token.periodo,
    fuente: tokenRow.token.fuente,
    competencias: competencias as Evaluacion360['competencias'],
    potencial: potencial as Evaluacion360['potencial'],
    puntaje_total: undefined,
    nivel: undefined,
  });

  const { error } = await supabase
    .from('tokens_360')
    .update({ completado: true })
    .eq('token', token);
  if (error) throw new Error(error.message);
}

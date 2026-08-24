import { createClient } from "@supabase/supabase-js";
import type { ScoringResult } from "./scoring";
import type { ClimaResult } from "./clima-scoring";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export interface EvaluadoInput {
  nombre:      string;
  cargo:       string;
  area:        string;
  empresa:     string;
  empresa_id?: string | null;
  respuestas:  Record<string, number>;
  scores:      ScoringResult;
}

export interface Evaluacion extends EvaluadoInput {
  id:           string;
  created_at:   string;
  score_global: number;
  nivel:        string;
  empresa_id?:  string | null;
}

export async function guardarEvaluacion(data: EvaluadoInput): Promise<string> {
  const { data: row, error } = await supabase
    .from("evaluaciones")
    .insert({
      nombre:       data.nombre,
      cargo:        data.cargo,
      area:         data.area,
      empresa:      data.empresa,
      empresa_id:   data.empresa_id ?? null,
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
  respuestas:  Record<string, number>;
  scores:      ClimaResult;
  nombre?:     string;
  cargo?:      string;
  area?:       string;
  empresa?:    string;
  empresa_id?: string | null;
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
  empresa_id?:  string | null;
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
      empresa_id:   data.empresa_id ?? null,
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
  empresa_id: string | null;
  estado:     'pendiente' | 'completada';
  created_at: string;
}

export interface SesionInput {
  tipo:        'cultura' | 'clima' | 'salud';
  empresa?:    string;
  empresa_id?: string;
}

export async function crearSesion(data: SesionInput): Promise<Sesion> {
  const { data: row, error } = await supabase
    .from("sesiones")
    .insert({ tipo: data.tipo, empresa: data.empresa ?? null, empresa_id: data.empresa_id ?? null })
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

export async function obtenerSesion(id: string): Promise<Sesion | null> {
  const { data, error } = await supabase
    .from("sesiones")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Sesion | null;
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
  // 'empresa' es solo un campo de conveniencia en el tipo — la tabla real
  // no tiene esa columna, solo 'empresa_id'. Se insertaba igual y tumbaba
  // el guardado con "Could not find the 'empresa' column" en cuanto alguien
  // la mandaba con valor.
  const { empresa: _empresa, ...dataParaInsertar } = data;
  const { data: row, error } = await supabase
    .from('evaluados_360')
    .insert(dataParaInsertar)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return { ...row, empresa: data.empresa } as Evaluado360;
}

export async function eliminar360Evaluado(id: string): Promise<void> {
  // Se borra explícito en cada tabla relacionada (en vez de confiar en
  // cascade a nivel de FK) para no dejar filas huérfanas si alguna tabla
  // no tiene el "on delete cascade" configurado.
  await supabase.from('indicadores_resultado_360').delete().eq('evaluado_id', id);
  await supabase.from('pdi_360').delete().eq('evaluado_id', id);
  await supabase.from('tokens_360').delete().eq('evaluado_id', id);
  await supabase.from('evaluaciones_360').delete().eq('evaluado_id', id);
  const { error } = await supabase.from('evaluados_360').delete().eq('id', id);
  if (error) throw new Error(error.message);
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

// El flujo público de completar un token 360° vive en /api/token/360/[token]
// (server-side, con service_role) — ver src/app/api/token/360/[token]/route.ts

// ── Indicadores esenciales del Manual de Puestos (Desempeño = 360° 60% + indicadores 40%) ──

import type { IndicadorEsencial, IndicadorResultado360 } from './360-types';
export type { IndicadorEsencial, IndicadorResultado360 };

export interface PuestoResumen {
  id: string;
  nombre_puesto: string;
  area: string;
}

export async function listarPuestosPorEmpresa(empresaId: string): Promise<PuestoResumen[]> {
  const { data, error } = await supabase
    .from('puestos')
    .select('id, nombre_puesto, area')
    .eq('empresa_id', empresaId)
    .order('nombre_puesto');
  if (error) throw new Error(error.message);
  return (data ?? []) as PuestoResumen[];
}

export async function listarIndicadoresEsencialesDePuesto(puestoId: string): Promise<IndicadorEsencial[]> {
  const { data, error } = await supabase
    .from('indicadores_puesto')
    .select('id, indicador, formula, meta, actividad:actividades_puesto!actividad_esencial_id(es_esencial)')
    .eq('puesto_id', puestoId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<IndicadorEsencial & { actividad: { es_esencial: boolean } | null }>)
    .filter((row) => row.actividad?.es_esencial === true)
    .map(({ id, indicador, formula, meta }) => ({ id, indicador, formula, meta }));
}

export async function listarIndicadoresResultado360(
  evaluadoId: string,
  periodo: string,
): Promise<IndicadorResultado360[]> {
  const { data, error } = await supabase
    .from('indicadores_resultado_360')
    .select('*')
    .eq('evaluado_id', evaluadoId)
    .eq('periodo', periodo);
  if (error) throw new Error(error.message);
  return (data ?? []) as IndicadorResultado360[];
}

export async function listarTodasIndicadoresResultado360(): Promise<IndicadorResultado360[]> {
  const { data, error } = await supabase
    .from('indicadores_resultado_360')
    .select('*');
  if (error) throw new Error(error.message);
  return (data ?? []) as IndicadorResultado360[];
}

// ── Panel de clientes: empresas, módulos activos, personas ─────────────────

export const MODULOS_ECOSISTEMA = [
  {
    key: "cultura", label: "Cultura", href: "/dashboard", tab: "docs", preseleccionaEmpresa: true,
    captura: "Cuestionario de 60 ítems por evaluado — se levanta con cada empresa.",
  },
  {
    key: "clima", label: "Clima", href: "/dashboard", tab: "clima", preseleccionaEmpresa: true,
    captura: "Encuesta de clima (anónima) — se levanta con cada empresa.",
  },
  {
    key: "salud_organizacional", label: "Salud Organizacional", href: "/dashboard", tab: "salud", preseleccionaEmpresa: true,
    captura: "Se calcula a partir de Cultura y Clima ya cargados de esta empresa — no requiere captura propia.",
  },
  {
    key: "evaluacion_360", label: "Evaluación 360°", href: "/dashboard", tab: "eval360", preseleccionaEmpresa: true,
    captura: "Evaluados, evaluadores y período — específico de esta empresa.",
  },
  {
    key: "manual_puestos", label: "Manual de Puestos", href: "/manual-puestos", preseleccionaEmpresa: true,
    captura: "Catálogo de puestos con actividades, competencias e indicadores — trabajo entregable único.",
  },
  {
    key: "nomina", label: "Nómina", href: "/nomina", preseleccionaEmpresa: true,
    captura: "Empleados de nómina, parámetros legales y períodos — se levanta con cada empresa.",
  },
  {
    key: "seleccion", label: "Selección de Talento", href: "/seleccion", preseleccionaEmpresa: true,
    captura: "Vacantes, candidatos y pruebas se crean directo en el módulo — puede reusar el Manual de Puestos de esta empresa si ya existe, o un perfil ligero si no.",
  },
] as const;

export type ModuloKey = (typeof MODULOS_ECOSISTEMA)[number]["key"];

export interface Empresa {
  id: string;
  nombre: string;
  sector: string | null;
  ruc: string | null;
  contacto: string | null;
  tamano_estimado: number | null;
  fecha_creacion: string;
  logo_url: string | null;
}

export interface ModuloActivo {
  id: string;
  empresa_id: string;
  modulo: ModuloKey;
  estado: "activo" | "inactivo" | "pausado";
  fecha_activacion: string;
  fecha_desactivacion: string | null;
  notas: string | null;
}

export interface Persona {
  id: string;
  empresa_id: string;
  nombre: string;
  cedula: string | null;
  email: string | null;
  puesto_id: string | null;
}

export async function listarEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from("empresas_mdt")
    .select("*")
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as Empresa[];
}

export async function obtenerEmpresa(id: string): Promise<Empresa> {
  const { data, error } = await supabase
    .from("empresas_mdt")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as Empresa;
}

export async function crearEmpresa(input: {
  nombre: string;
  sector?: string;
  ruc?: string;
  contacto?: string;
  tamano_estimado?: number | null;
}): Promise<Empresa> {
  const { data, error } = await supabase
    .from("empresas_mdt")
    .insert({
      nombre: input.nombre.trim(),
      sector: input.sector?.trim() || null,
      ruc: input.ruc?.trim() || null,
      contacto: input.contacto?.trim() || null,
      tamano_estimado: input.tamano_estimado ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Empresa;
}

export async function actualizarEmpresa(
  id: string,
  input: { nombre?: string; sector?: string; ruc?: string; contacto?: string; tamano_estimado?: number | null }
): Promise<void> {
  const { error } = await supabase.from("empresas_mdt").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listarModulosActivos(): Promise<ModuloActivo[]> {
  const { data, error } = await supabase.from("modulos_activos").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as ModuloActivo[];
}

export async function listarModulosActivosPorEmpresa(empresaId: string): Promise<ModuloActivo[]> {
  const { data, error } = await supabase
    .from("modulos_activos")
    .select("*")
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);
  return (data ?? []) as ModuloActivo[];
}

export async function activarModulo(empresaId: string, modulo: ModuloKey): Promise<ModuloActivo> {
  const { data, error } = await supabase
    .from("modulos_activos")
    .upsert(
      { empresa_id: empresaId, modulo, estado: "activo", fecha_activacion: new Date().toISOString().slice(0, 10), fecha_desactivacion: null },
      { onConflict: "empresa_id,modulo" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ModuloActivo;
}

export async function cambiarEstadoModulo(
  id: string,
  estado: "activo" | "inactivo" | "pausado"
): Promise<void> {
  const { error } = await supabase
    .from("modulos_activos")
    .update({
      estado,
      fecha_desactivacion: estado === "inactivo" ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listarPersonasPorEmpresa(empresaId: string): Promise<Persona[]> {
  const { data, error } = await supabase
    .from("personas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as Persona[];
}

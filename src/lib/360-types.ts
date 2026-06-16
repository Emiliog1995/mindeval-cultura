export const COMPETENCIAS_360 = [
  { key: 'liderazgo',              label: 'Liderazgo',              meta: 4.5 },
  { key: 'trabajo_equipo',         label: 'Trabajo en Equipo',      meta: 4.5 },
  { key: 'orientacion_resultados', label: 'Orient. a Resultados',   meta: 4.5 },
  { key: 'innovacion',             label: 'Innovación',             meta: 4.0 },
  { key: 'servicio_cliente',       label: 'Servicio al Cliente',    meta: 4.5 },
  { key: 'desarrollo_profesional', label: 'Desarrollo Profesional', meta: 4.0 },
] as const;

export type CompetenciaKey = typeof COMPETENCIAS_360[number]['key'];

export const POTENCIAL_CRITERIOS = [
  { key: 'capacidad_aprendizaje',  label: 'Capacidad de Aprendizaje' },
  { key: 'aspiracion_crecimiento', label: 'Aspiración de Crecimiento' },
  { key: 'agilidad_adaptabilidad', label: 'Agilidad y Adaptabilidad' },
  { key: 'pensamiento_sistemico',  label: 'Pensamiento Sistémico' },
  { key: 'liderazgo_emergente',    label: 'Liderazgo Emergente' },
] as const;

export type PotencialKey = typeof POTENCIAL_CRITERIOS[number]['key'];

export type FuenteEvaluacion =
  | 'autoevaluacion'
  | 'jefe'
  | 'par'
  | 'colaborador'
  | 'cliente_interno';

export const PESOS_FUENTE: Record<FuenteEvaluacion, number> = {
  autoevaluacion:  0.10,
  jefe:            0.40,
  par:             0.20,
  colaborador:     0.20,
  cliente_interno: 0.10,
};

export const FUENTE_LABELS: Record<FuenteEvaluacion, string> = {
  autoevaluacion:  'Autoevaluación',
  jefe:            'Jefe Directo',
  par:             'Par',
  colaborador:     'Colaborador',
  cliente_interno: 'Cliente Interno',
};

export interface Evaluado360 {
  id: string;
  nombre: string;
  cargo: string;
  departamento: string;
  jefe?: string;
  fecha_ingreso?: string;
  created_at: string;
}

export interface Evaluacion360 {
  id: string;
  evaluado_id: string;
  periodo: string;
  fuente: FuenteEvaluacion;
  competencias: Record<CompetenciaKey, number>;
  potencial?: Record<PotencialKey, number>;
  puntaje_total?: number;
  nivel?: string;
  created_at: string;
}

export interface Token360 {
  id: string;
  evaluado_id: string;
  fuente: FuenteEvaluacion;
  token: string;
  periodo: string;
  completado: boolean;
  created_at: string;
}

export interface Pdi360 {
  id: string;
  evaluado_id: string;
  periodo: string;
  area_mejora_1?: string;
  objetivo_smart_1?: string;
  accion_1?: string;
  area_mejora_2?: string;
  objetivo_smart_2?: string;
  accion_2?: string;
  area_mejora_3?: string;
  objetivo_smart_3?: string;
  accion_3?: string;
  plazo?: string;
  indicador?: string;
  cuadrante?: string;
  created_at: string;
}

export type NivelDesempeno = 'SOBRESALIENTE' | 'MUY BUENO' | 'BUENO' | 'EN DESARROLLO' | 'INACEPTABLE';
export type NivelPotencial = 'ALTO' | 'MEDIO' | 'BAJO';

export interface CuadranteInfo {
  numero: number;
  nombre: string;
  accion: string;
  colorFondo: string;
}

export interface ResultadoConsolidado360 {
  evaluado: Evaluado360;
  periodo: string;
  puntaje360: number;
  nivelDesempeno: NivelDesempeno;
  colorDesempeno: string;
  puntajePotencial: number;
  nivelPotencial: NivelPotencial;
  cuadrante: number;
  nombreCuadrante: string;
  accionCuadrante: string;
  colorCuadrante: string;
  puntajesPorCompetencia: Record<CompetenciaKey, number>;
  brechas: Array<{
    key: CompetenciaKey;
    label: string;
    meta: number;
    actual: number;
    brecha: number;
    prioridad: 'alta' | 'media' | 'baja';
  }>;
  evaluaciones: Evaluacion360[];
  pdi?: Pdi360;
}

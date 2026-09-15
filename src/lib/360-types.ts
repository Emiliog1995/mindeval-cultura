export const COMPETENCIAS_360 = [
  { key: 'liderazgo',              label: 'Liderazgo',              meta: 4.5 },
  { key: 'trabajo_equipo',         label: 'Trabajo en Equipo',      meta: 4.5 },
  { key: 'orientacion_resultados', label: 'Orient. a Resultados',   meta: 4.5 },
  { key: 'innovacion',             label: 'Innovación',             meta: 4.0 },
  { key: 'servicio_cliente',       label: 'Servicio al Cliente',    meta: 4.5 },
  { key: 'desarrollo_profesional', label: 'Desarrollo Profesional', meta: 4.0 },
] as const;

export type CompetenciaKey = typeof COMPETENCIAS_360[number]['key'];

/**
 * Renombres de competencias por organización.
 *
 * Las 6 competencias son las mismas para todos, pero cómo se llaman no: una
 * fundación de apadrinamiento no habla de "Servicio al Cliente". La CLAVE
 * nunca cambia —las evaluaciones ya guardadas la tienen adentro de su JSON—,
 * solo cambia el texto que se le muestra a la gente.
 */
export type CompetenciaLabels = Partial<Record<CompetenciaKey, string>>;

export interface CompetenciaConMeta {
  key: CompetenciaKey;
  label: string;
  meta: number;
}

/** Las competencias con el nombre que use esta organización. */
export function competenciasConLabels(overrides?: CompetenciaLabels | null): CompetenciaConMeta[] {
  return COMPETENCIAS_360.map((c) => ({
    key: c.key,
    label: overrides?.[c.key]?.trim() || c.label,
    meta: c.meta,
  }));
}

/**
 * Cumplimiento de un indicador de gestión.
 *
 * SIN_REGISTRO no es una nota baja: es el jefe declarando que la organización
 * no mide ese indicador. Se excluye del promedio en vez de castigar a la
 * persona por algo que nadie registra, y se reporta aparte — cuántos
 * indicadores no tienen registro es, en sí mismo, un hallazgo de la evaluación.
 */
export const SIN_REGISTRO = 0;

export const ESCALA_INDICADOR = [
  { valor: 5, label: 'Superó la meta' },
  { valor: 4, label: 'Cumplió la meta' },
  { valor: 3, label: 'Cerca de la meta' },
  { valor: 2, label: 'Por debajo de la meta' },
  { valor: 1, label: 'Muy por debajo / no se ejecutó' },
] as const;

export const LABEL_SIN_REGISTRO = 'No se lleva registro de este indicador';

export const POTENCIAL_CRITERIOS = [
  { key: 'capacidad_aprendizaje',  label: 'Capacidad de Aprendizaje' },
  { key: 'aspiracion_crecimiento', label: 'Aspiración de Crecimiento' },
  { key: 'agilidad_adaptabilidad', label: 'Agilidad y Adaptabilidad' },
  { key: 'pensamiento_sistemico',  label: 'Pensamiento Sistémico' },
  { key: 'liderazgo_emergente',    label: 'Liderazgo Emergente' },
] as const;

export type PotencialKey = typeof POTENCIAL_CRITERIOS[number]['key'];

// El período es la llave que une tokens ↔ respuestas ↔ indicadores. Se
// ofrece como select con candidatos calculados (en vez de texto libre) para
// que dos personas no terminen usando '2026' y '2025-2026' para el mismo
// ciclo — sin asumir que todo cliente evalúa por semestre calendario.
export function periodosSugeridos(fecha: Date = new Date()): string[] {
  const anio = fecha.getFullYear();
  const semestre = fecha.getMonth() < 6 ? 1 : 2;
  const actual = `${anio}-S${semestre}`;
  const siguiente = semestre === 1 ? `${anio}-S2` : `${anio + 1}-S1`;
  const anterior = semestre === 1 ? `${anio - 1}-S2` : `${anio}-S1`;
  return [actual, siguiente, anterior, `${anio}`];
}

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
  empresa?: string;
  empresa_id?: string;
  puesto_id?: string;
  persona_id?: string;
  jefe?: string;
  fecha_ingreso?: string;
  created_at: string;
}

export interface IndicadorEsencial {
  id: string;
  indicador: string;
  formula: string;
  meta: string;
}

export interface IndicadorResultado360 {
  id: string;
  evaluado_id: string;
  periodo: string;
  indicador_puesto_id: string;
  /** null cuando sin_registro es true: no hay dato que calificar. */
  calificacion: number | null;
  /** El jefe declaró que la organización no lleva registro de este indicador. */
  sin_registro?: boolean;
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
  /** Solo en la autoevaluación: qué pide la propia persona (capacitación, materiales). */
  necesidades?: string | null;
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
  /** A quién hay que enviarle este enlace. Se guarda al generarlo. */
  evaluador_nombre?: string | null;
  evaluador_email?: string | null;
  /** Cuándo salió el correo. null = todavía no se envió. */
  enviado_en?: string | null;
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
  cumplimientoIndicadores: number | null;
  puntajeDesempenoFinal: number;
  indicadoresEsenciales: Array<IndicadorEsencial & { calificacion: number | null; sinRegistro?: boolean }>;
  /** Indicadores que el jefe declaró sin registro. Hallazgo del diagnóstico. */
  indicadoresSinRegistro?: number;
  indicadoresConDato?: number;
  nivelDesempeno: NivelDesempeno;
  colorDesempeno: string;
  puntajePotencial: number;
  nivelPotencial: NivelPotencial;
  potencialPendiente: boolean;
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

import {
  COMPETENCIAS_360,
  PESOS_FUENTE,
  type CompetenciaKey,
  type Evaluacion360,
  type NivelDesempeno,
  type NivelPotencial,
  type PotencialKey,
  type CuadranteInfo,
} from './360-types';

// Desempeño final = 360° (competencias, todas las fuentes) × 60% +
//                    Cumplimiento de indicadores esenciales (solo jefe) × 40%.
// Piloto: si el evaluado aún no tiene indicadores esenciales cargados,
// el Desempeño se apoya 100% en el 360° (fallback amigable, no bloquea).
export const PESO_360_EN_DESEMPENO = 0.6;
export const PESO_INDICADORES_EN_DESEMPENO = 0.4;

export function calcularPuntaje360(evaluaciones: Evaluacion360[]): {
  puntajesPorCompetencia: Record<CompetenciaKey, number>;
  puntaje360: number;
} {
  const acumulado: Record<string, number> = {};
  const pesoTotal: Record<string, number> = {};

  for (const comp of COMPETENCIAS_360) {
    acumulado[comp.key] = 0;
    pesoTotal[comp.key] = 0;
  }

  for (const ev of evaluaciones) {
    const peso = PESOS_FUENTE[ev.fuente] ?? 0;
    for (const comp of COMPETENCIAS_360) {
      const val = ev.competencias[comp.key];
      if (val !== undefined && val > 0) {
        acumulado[comp.key] += val * peso;
        pesoTotal[comp.key] += peso;
      }
    }
  }

  const puntajesPorCompetencia = {} as Record<CompetenciaKey, number>;
  let suma = 0;
  for (const comp of COMPETENCIAS_360) {
    const p = pesoTotal[comp.key] > 0 ? acumulado[comp.key] / pesoTotal[comp.key] : 0;
    puntajesPorCompetencia[comp.key] = Math.round(p * 100) / 100;
    suma += puntajesPorCompetencia[comp.key];
  }

  const puntaje360 = Math.round((suma / COMPETENCIAS_360.length) * 100) / 100;
  return { puntajesPorCompetencia, puntaje360 };
}

export function clasificarNivelDesempeno(puntaje: number): { nivel: NivelDesempeno; color: string } {
  if (puntaje >= 4.5) return { nivel: 'SOBRESALIENTE', color: '#10b981' };
  if (puntaje >= 3.5) return { nivel: 'MUY BUENO',     color: '#84cc16' };
  if (puntaje >= 2.5) return { nivel: 'BUENO',          color: '#eab308' };
  if (puntaje >= 1.5) return { nivel: 'EN DESARROLLO',  color: '#f97316' };
  return                     { nivel: 'INACEPTABLE',    color: '#ef4444' };
}

export function calcularPotencial(potencial: Record<PotencialKey, number>): {
  puntaje: number;
  nivel: NivelPotencial;
} {
  const vals = Object.values(potencial).filter((v) => v > 0);
  const puntaje = vals.length > 0
    ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
    : 0;

  const nivel: NivelPotencial =
    puntaje >= 4.0 ? 'ALTO' :
    puntaje >= 2.5 ? 'MEDIO' : 'BAJO';

  return { puntaje, nivel };
}

// Clave: `${potencial}-${desempeño}`. Fuente: matriz oficial de 9 cajas (Matriz_9_cajas.docx).
const CUADRANTES: Record<string, CuadranteInfo> = {
  'ALTO-BAJO':    { numero: 1, nombre: 'ENIGMA',                   accion: 'Investigar causa (encaje, inducción, jefatura) antes de decidir', colorFondo: '#fef9c3' },
  'ALTO-MEDIO':   { numero: 2, nombre: 'TALENTO EN CRECIMIENTO',   accion: 'Retos concretos + formación dirigida + seguimiento cercano',      colorFondo: '#dcfce7' },
  'ALTO-ALTO':    { numero: 3, nombre: 'ESTRELLA',                 accion: 'Retención prioritaria, candidato a sucesión',                     colorFondo: '#dcfce7' },
  'MEDIO-BAJO':   { numero: 4, nombre: 'INCONSISTENTE',            accion: 'Plan de mejora con objetivos y plazo definido',                   colorFondo: '#fecaca' },
  'MEDIO-MEDIO':  { numero: 5, nombre: 'PROFESIONAL CLAVE',        accion: 'Mantener motivado y reconocido',                                  colorFondo: '#fef9c3' },
  'MEDIO-ALTO':   { numero: 6, nombre: 'ALTO DESEMPEÑO',           accion: 'Margen de crecimiento lateral o de nivel jerárquico',             colorFondo: '#dcfce7' },
  'BAJO-BAJO':    { numero: 7, nombre: 'RIESGO',                   accion: 'Reubicación, desvinculación o revisar proceso de selección',      colorFondo: '#fecaca' },
  'BAJO-MEDIO':   { numero: 8, nombre: 'TRABAJADOR EFICAZ',        accion: 'Reconocer que cumple y es confiable; no forzar ascenso',          colorFondo: '#fef9c3' },
  'BAJO-ALTO':    { numero: 9, nombre: 'EXPERTO',                  accion: 'Retener con reconocimiento técnico, no con promesas de ascenso',  colorFondo: '#dcfce7' },
};

function nivelDesempenoToEje(nivel: NivelDesempeno | NivelPotencial): 'BAJO' | 'MEDIO' | 'ALTO' {
  if (nivel === 'SOBRESALIENTE' || nivel === 'MUY BUENO' || nivel === 'ALTO') return 'ALTO';
  if (nivel === 'BUENO' || nivel === 'MEDIO') return 'MEDIO';
  return 'BAJO';
}

export function determinarCuadrante(
  nivelDesempeno: NivelDesempeno,
  nivelPotencial: NivelPotencial,
): CuadranteInfo {
  const ejeDesempeno = nivelDesempenoToEje(nivelDesempeno);
  const ejePotencial = nivelDesempenoToEje(nivelPotencial);
  const key = `${ejePotencial}-${ejeDesempeno}`;
  return CUADRANTES[key] ?? CUADRANTES['MEDIO-MEDIO'];
}

export function calcularCumplimientoIndicadores(calificaciones: number[]): number | null {
  const vals = calificaciones.filter((v) => v > 0);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

export function calcularDesempenoFinal(
  puntaje360: number,
  cumplimientoIndicadores: number | null,
): number {
  if (cumplimientoIndicadores === null) return puntaje360;
  const combinado =
    puntaje360 * PESO_360_EN_DESEMPENO + cumplimientoIndicadores * PESO_INDICADORES_EN_DESEMPENO;
  return Math.round(combinado * 100) / 100;
}

// Junta el cálculo completo (360° + indicadores esenciales + potencial + cuadrante)
// que repiten todas las vistas del módulo, para no duplicar la lógica en cada página.
export function construirResultadoBase360(
  evaluaciones: Evaluacion360[],
  calificacionesIndicadores: number[],
): {
  puntajesPorCompetencia: Record<CompetenciaKey, number>;
  puntaje360: number;
  cumplimientoIndicadores: number | null;
  puntajeDesempenoFinal: number;
  nivelDesempeno: NivelDesempeno;
  colorDesempeno: string;
  puntajePotencial: number;
  nivelPotencial: NivelPotencial;
  potencialPendiente: boolean;
  cuadrante: number;
  nombreCuadrante: string;
  accionCuadrante: string;
  colorCuadrante: string;
  brechas: ReturnType<typeof calcularBrechas>;
} {
  const { puntajesPorCompetencia, puntaje360 } = calcularPuntaje360(evaluaciones);
  const jefeEv = evaluaciones.find((e) => e.fuente === 'jefe');
  const potencialPendiente = !jefeEv?.potencial;
  // Sin evaluación del jefe no hay dato real de potencial. Se usa 'MEDIO' solo
  // como valor neutro interno para no romper el cálculo del cuadrante — los
  // consumidores de este resultado deben revisar `potencialPendiente` antes
  // de mostrar el nivel, el puntaje o la posición en la Matriz de 9 Cajas.
  const { puntaje: puntajePotencial, nivel: nivelPotencial } = jefeEv?.potencial
    ? calcularPotencial(jefeEv.potencial)
    : { puntaje: 0, nivel: 'MEDIO' as NivelPotencial };

  const cumplimientoIndicadores = calcularCumplimientoIndicadores(calificacionesIndicadores);
  const puntajeDesempenoFinal = calcularDesempenoFinal(puntaje360, cumplimientoIndicadores);
  const { nivel: nivelDesempeno, color: colorDesempeno } = clasificarNivelDesempeno(puntajeDesempenoFinal);
  const cuadranteInfo = determinarCuadrante(nivelDesempeno, nivelPotencial);
  const brechas = calcularBrechas(puntajesPorCompetencia);

  return {
    puntajesPorCompetencia,
    puntaje360,
    cumplimientoIndicadores,
    puntajeDesempenoFinal,
    nivelDesempeno,
    colorDesempeno,
    puntajePotencial,
    nivelPotencial,
    potencialPendiente,
    cuadrante: cuadranteInfo.numero,
    nombreCuadrante: cuadranteInfo.nombre,
    accionCuadrante: cuadranteInfo.accion,
    colorCuadrante: cuadranteInfo.colorFondo,
    brechas,
  };
}

export function calcularBrechas(
  puntajesPorCompetencia: Record<CompetenciaKey, number>,
): Array<{
  key: CompetenciaKey;
  label: string;
  meta: number;
  actual: number;
  brecha: number;
  prioridad: 'alta' | 'media' | 'baja';
}> {
  return COMPETENCIAS_360.map((comp) => {
    const actual = puntajesPorCompetencia[comp.key] ?? 0;
    const brecha = Math.max(0, Math.round((comp.meta - actual) * 100) / 100);
    const prioridad: 'alta' | 'media' | 'baja' =
      brecha > 0.8  ? 'alta'  :
      brecha >= 0.4 ? 'media' : 'baja';
    return { key: comp.key, label: comp.label, meta: comp.meta, actual, brecha, prioridad };
  }).sort((a, b) => b.brecha - a.brecha);
}

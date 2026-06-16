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

const CUADRANTES: Record<string, CuadranteInfo> = {
  'BAJO-BAJO':   { numero: 1, nombre: 'BAJO RENDIMIENTO', accion: 'Intervención inmediata',    colorFondo: '#fecaca' },
  'MEDIO-BAJO':  { numero: 2, nombre: 'INCONSISTENTE',    accion: 'Revisar motivación',        colorFondo: '#fecaca' },
  'ALTO-BAJO':   { numero: 3, nombre: 'ALTO RENDIMIENTO', accion: 'Retención táctica',         colorFondo: '#fef9c3' },
  'BAJO-MEDIO':  { numero: 4, nombre: 'ENIGMA',           accion: 'Coaching + capacitación',   colorFondo: '#fef9c3' },
  'MEDIO-MEDIO': { numero: 5, nombre: 'NÚCLEO',           accion: 'Reconocer + fidelizar',     colorFondo: '#fef9c3' },
  'ALTO-MEDIO':  { numero: 6, nombre: 'ALTO IMPACTO',     accion: 'Formación continua',        colorFondo: '#dcfce7' },
  'BAJO-ALTO':   { numero: 7, nombre: 'DILEMA',           accion: 'Revisar rol',               colorFondo: '#fef9c3' },
  'MEDIO-ALTO':  { numero: 8, nombre: 'FUTURA ESTRELLA',  accion: 'Proyectos retadores',       colorFondo: '#dcfce7' },
  'ALTO-ALTO':   { numero: 9, nombre: 'ESTRELLA',         accion: 'Plan de sucesión',          colorFondo: '#dcfce7' },
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
  const ejeX = nivelDesempenoToEje(nivelDesempeno);
  const ejeY = nivelDesempenoToEje(nivelPotencial);
  const key = `${ejeX}-${ejeY}`;
  return CUADRANTES[key] ?? CUADRANTES['MEDIO-MEDIO'];
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

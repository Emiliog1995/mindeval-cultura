export interface Actividad {
  id?: string
  orden: number
  descripcion: string
  frecuencia: number
  consecuencia: number
  complejidad: number
}

export function calcularTotal(f: number, ce: number, cm: number): number {
  return f + ce * cm
}

export function identificarEsenciales(actividades: Actividad[]): Actividad[] {
  const conTotal = actividades
    .filter(a => a.descripcion.trim() && a.frecuencia && a.consecuencia && a.complejidad)
    .map(a => ({ ...a, _total: calcularTotal(a.frecuencia, a.consecuencia, a.complejidad) }))
    .sort((a, b) => b._total - a._total)
  const umbral = conTotal.length >= 4 ? 4 : 3
  const topPuntaje = conTotal[umbral - 1]?._total ?? 0
  return conTotal.filter(a => a._total >= topPuntaje).slice(0, Math.max(umbral, 3))
}

export const ESCALA_F: Record<number, string> = {
  5: 'Todos los días',
  4: 'Al menos una vez por semana',
  3: 'Al menos una vez cada 15 días',
  2: 'Al menos una vez al mes',
  1: 'Al menos una vez al año',
}

export const ESCALA_CE: Record<number, string> = {
  5: 'Consecuencias muy graves — pone en riesgo la organización',
  4: 'Consecuencias graves — afecta resultados clave',
  3: 'Consecuencias moderadas — requiere corrección inmediata',
  2: 'Consecuencias leves — se corrige fácilmente',
  1: 'Sin consecuencias significativas',
}

export const ESCALA_CM: Record<number, string> = {
  5: 'Muy compleja — requiere alto nivel de especialización',
  4: 'Compleja — requiere experiencia y criterio',
  3: 'Moderada — con capacitación estándar se domina',
  2: 'Simple — se aprende rápido',
  1: 'Muy simple — mecánica o rutinaria',
}

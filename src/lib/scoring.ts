import { ITEMS, SUBSCALES, DIMENSIONS, type Dimension, type Subscale } from "./items";

export interface SubscaleScore {
  code: Subscale;
  label: string;
  dimension: Dimension;
  mean: number;
  level: string;
}

export interface DimensionScore {
  code: Dimension;
  label: string;
  mean: number;
  level: string;
}

export interface ScoringResult {
  subscales: SubscaleScore[];
  dimensions: DimensionScore[];
  global: number;
  globalLevel: string;
}

export function getLevel(mean: number): string {
  if (mean >= 4.21) return "MUY ALTO";
  if (mean >= 3.61) return "ALTO";
  if (mean >= 3.01) return "MEDIO";
  if (mean >= 2.41) return "BAJO";
  return "MUY BAJO";
}

export function getLevelColor(level: string): string {
  switch (level) {
    case "MUY ALTO": return "#059669";
    case "ALTO":     return "#65a30d";
    case "MEDIO":    return "#ca8a04";
    case "BAJO":     return "#ea580c";
    case "MUY BAJO": return "#dc2626";
    default:         return "#6b7280";
  }
}

export function calcularScores(respuestas: Record<string, number>): ScoringResult {
  const subscaleCodes = Object.keys(SUBSCALES) as Subscale[];

  const subscaleScores: SubscaleScore[] = subscaleCodes.map((code) => {
    const itemsOfSubscale = ITEMS.filter((i) => i.subscale === code);
    const values = itemsOfSubscale.map((item) => {
      const raw = respuestas[String(item.id)] ?? 3;
      return item.inverse ? 6 - raw : raw;
    });
    const mean = parseFloat(
      (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)
    );
    return { code, label: SUBSCALES[code].label, dimension: SUBSCALES[code].dimension, mean, level: getLevel(mean) };
  });

  const dimensionCodes = Object.keys(DIMENSIONS) as Dimension[];
  const dimensionScores: DimensionScore[] = dimensionCodes.map((dim) => {
    const dimSubscales = subscaleScores.filter((s) => s.dimension === dim);
    const mean = parseFloat(
      (dimSubscales.reduce((a, b) => a + b.mean, 0) / dimSubscales.length).toFixed(2)
    );
    return { code: dim, label: DIMENSIONS[dim], mean, level: getLevel(mean) };
  });

  const global = parseFloat(
    (dimensionScores.reduce((a, b) => a + b.mean, 0) / dimensionScores.length).toFixed(2)
  );

  return { subscales: subscaleScores, dimensions: dimensionScores, global, globalLevel: getLevel(global) };
}

export function interpretacion(level: string): string {
  switch (level) {
    case "MUY ALTO": return "La cultura organizacional es un activo estratégico sólido. Las prácticas son consistentes, el equipo está altamente comprometido y la organización aprende y se adapta con eficacia.";
    case "ALTO":     return "La cultura organizacional es favorable. Existen fortalezas claras que conviene sostener y capitalizar para alcanzar la excelencia.";
    case "MEDIO":    return "La cultura organizacional presenta áreas de oportunidad significativas. Se recomienda un plan de desarrollo cultural con acciones concretas en las dimensiones con menor puntuación.";
    case "BAJO":     return "Existen debilidades culturales que pueden afectar el desempeño. Se requiere intervención prioritaria en las dimensiones críticas.";
    case "MUY BAJO": return "La cultura organizacional presenta riesgos importantes. Se recomienda una intervención urgente y estructurada con acompañamiento especializado.";
    default:         return "";
  }
}

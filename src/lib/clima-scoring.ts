import { CLIMA_ITEMS, CLIMA_DIMENSIONS, type ClimaDimension } from "./clima-items";

export interface ClimaDimensionScore {
  code: ClimaDimension;
  label: string;
  mean: number;
  level: string;
}

export interface ClimaResult {
  dimensions: ClimaDimensionScore[];
  global: number;
  globalLevel: string;
}

export function getClimaLevel(mean: number): string {
  if (mean >= 4.21) return "MUY FAVORABLE";
  if (mean >= 3.61) return "FAVORABLE";
  if (mean >= 3.01) return "MODERADO";
  if (mean >= 2.41) return "DESFAVORABLE";
  return "MUY DESFAVORABLE";
}

export function getClimaLevelColor(level: string): string {
  switch (level) {
    case "MUY FAVORABLE":    return "#16a34a";
    case "FAVORABLE":        return "#65a30d";
    case "MODERADO":         return "#ca8a04";
    case "DESFAVORABLE":     return "#ea580c";
    case "MUY DESFAVORABLE": return "#dc2626";
    default:                 return "#6b7280";
  }
}

export function calcularClimaScores(respuestas: Record<string, number>): ClimaResult {
  const dimCodes = Object.keys(CLIMA_DIMENSIONS) as ClimaDimension[];

  const dimensions: ClimaDimensionScore[] = dimCodes.map((code) => {
    const items = CLIMA_ITEMS.filter((i) => i.dimension === code);
    const values = items.map((item) => {
      const raw = respuestas[String(item.id)] ?? 3;
      return item.inverse ? 6 - raw : raw;
    });
    const mean = parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
    return { code, label: CLIMA_DIMENSIONS[code], mean, level: getClimaLevel(mean) };
  });

  const global = parseFloat(
    (dimensions.reduce((a, b) => a + b.mean, 0) / dimensions.length).toFixed(2)
  );

  return { dimensions, global, globalLevel: getClimaLevel(global) };
}

export function interpretacionClima(level: string): string {
  switch (level) {
    case "MUY FAVORABLE":    return "El clima organizacional es excelente. Los colaboradores perciben un entorno altamente positivo, motivador y propicio para el desempeño.";
    case "FAVORABLE":        return "El clima organizacional es positivo. Existen fortalezas claras que conviene sostener y potenciar para mantener el bienestar del equipo.";
    case "MODERADO":         return "El clima organizacional presenta áreas de mejora. Se recomienda identificar los factores críticos y diseñar acciones de intervención prioritarias.";
    case "DESFAVORABLE":     return "Existen factores que afectan negativamente el ambiente laboral. Se requiere intervención en las dimensiones con menor puntuación.";
    case "MUY DESFAVORABLE": return "El clima organizacional presenta riesgos importantes. Se recomienda una intervención urgente y estructurada con acompañamiento especializado.";
    default:                 return "";
  }
}

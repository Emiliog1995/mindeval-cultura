import type { Evaluacion, ClimaRespuesta } from "./supabase";
import type { ScoringResult } from "./scoring";

export interface AreaSaludData {
  area: string;
  count: number;
  dimI: number;   // Implicación
  dimII: number;  // Consistencia
  dimIII: number; // Adaptabilidad
  dimIV: number;  // Misión
  globalCultura: number;
}

export interface ISOData extends AreaSaludData {
  climaGlobal: number;
  iso: number;
  isoLevel: string;
}

export type Cuadrante =
  | "ÁGIL Y COMPROMETIDA"
  | "COMPROMETIDA PERO RÍGIDA"
  | "EN RIESGO"
  | "ADAPTABLE PERO DESVINCULADA";

export function getISOLevel(iso: number): string {
  if (iso >= 4.21) return "MUY SALUDABLE";
  if (iso >= 3.61) return "SALUDABLE";
  if (iso >= 3.01) return "EN DESARROLLO";
  if (iso >= 2.41) return "EN RIESGO";
  return "CRÍTICO";
}

export function getISOColor(level: string): string {
  switch (level) {
    case "MUY SALUDABLE": return "#16a34a";
    case "SALUDABLE":     return "#65a30d";
    case "EN DESARROLLO": return "#ca8a04";
    case "EN RIESGO":     return "#ea580c";
    case "CRÍTICO":       return "#dc2626";
    default:              return "#6b7280";
  }
}

export function calcularAreaDOCS(evaluaciones: Evaluacion[]): AreaSaludData[] {
  const areaMap = new Map<string, Evaluacion[]>();
  for (const ev of evaluaciones) {
    const area = ev.area?.trim() || "Sin área";
    if (!areaMap.has(area)) areaMap.set(area, []);
    areaMap.get(area)!.push(ev);
  }

  return Array.from(areaMap.entries())
    .map(([area, evs]) => {
      const scores = evs.map((e) => e.scores as ScoringResult);
      const avg = (dim: "I" | "II" | "III" | "IV") => {
        const vals = scores.map((s) => s.dimensions.find((d) => d.code === dim)?.mean ?? 0);
        return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
      };
      const dimI   = avg("I");
      const dimII  = avg("II");
      const dimIII = avg("III");
      const dimIV  = avg("IV");
      const globalCultura = parseFloat(((dimI + dimII + dimIII + dimIV) / 4).toFixed(2));
      return { area, count: evs.length, dimI, dimII, dimIII, dimIV, globalCultura };
    })
    .sort((a, b) => b.globalCultura - a.globalCultura);
}

export function calcularClimaGlobal(climaData: ClimaRespuesta[]): number {
  if (!climaData.length) return 0;
  return parseFloat(
    (climaData.reduce((a, r) => a + (r.score_global ?? 0), 0) / climaData.length).toFixed(2)
  );
}

// Fórmula inamovible: ISO = Cultura_área × 0.6 + Clima_global × 0.4
export function calcularISO(areaData: AreaSaludData[], climaGlobal: number): ISOData[] {
  return areaData.map((a) => {
    const iso = parseFloat((a.globalCultura * 0.6 + climaGlobal * 0.4).toFixed(2));
    return { ...a, climaGlobal, iso, isoLevel: getISOLevel(iso) };
  });
}

export function getCuadrante(adaptabilidad: number, implicacion: number): Cuadrante {
  if (adaptabilidad >= 3.0 && implicacion >= 3.0) return "ÁGIL Y COMPROMETIDA";
  if (adaptabilidad < 3.0  && implicacion >= 3.0) return "COMPROMETIDA PERO RÍGIDA";
  if (adaptabilidad >= 3.0 && implicacion < 3.0)  return "ADAPTABLE PERO DESVINCULADA";
  return "EN RIESGO";
}

export const CUADRANTE_DESC: Record<Cuadrante, string> = {
  "ÁGIL Y COMPROMETIDA":         "Alta adaptabilidad y alta implicación. Posición cultural ideal para el cambio sostenible.",
  "COMPROMETIDA PERO RÍGIDA":    "Equipos comprometidos pero con resistencia al cambio. Trabajar flexibilidad y orientación al aprendizaje.",
  "EN RIESGO":                   "Baja implicación y baja adaptabilidad. Intervención urgente en cultura y liderazgo.",
  "ADAPTABLE PERO DESVINCULADA": "Alta flexibilidad pero baja cohesión de equipos. Fortalecer implicación y sentido de pertenencia.",
};

export const CUADRANTE_COLOR: Record<Cuadrante, string> = {
  "ÁGIL Y COMPROMETIDA":         "#16a34a",
  "COMPROMETIDA PERO RÍGIDA":    "#ca8a04",
  "EN RIESGO":                   "#dc2626",
  "ADAPTABLE PERO DESVINCULADA": "#ea580c",
};

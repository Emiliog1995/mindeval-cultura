import type { Evaluacion, ClimaRespuesta } from "./supabase";
import type { ScoringResult } from "./scoring";

/**
 * Mínimo de respuestas de clima que debe tener un área para reportar SU
 * clima en vez del clima global de la organización.
 *
 * Son dos razones a la vez:
 *  - estadística: con 1 o 2 respuestas la media de un área es ruido;
 *  - confidencialidad: con muy poca muestra, el resultado de un área apunta
 *    directamente a quienes la respondieron, y el instrumento de clima
 *    pregunta por el jefe inmediato.
 */
export const MIN_RESPUESTAS_CLIMA_AREA = 3;

/**
 * Clave con la que se agrupan las áreas. El área es texto libre en los dos
 * cuestionarios, así que "RRHH", "Recursos Humanos " y "recursos humanos"
 * llegan como tres cadenas distintas y antes se analizaban como tres áreas.
 * Se normaliza acentos, espacios y mayúsculas solo para AGRUPAR; para
 * mostrar se conserva la forma que el usuario escribió (ver etiquetaArea).
 */
export function normalizarArea(raw?: string | null): string {
  const limpio = (raw ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return limpio || "SIN AREA";
}

/** De todas las formas escritas de un área, la más repetida (empate: la primera). */
function etiquetaArea(originales: string[]): string {
  const conteo = new Map<string, number>();
  for (const o of originales) {
    const limpio = o.trim();
    if (!limpio) continue;
    conteo.set(limpio, (conteo.get(limpio) ?? 0) + 1);
  }
  let mejor = "Sin área";
  let max = 0;
  for (const [forma, n] of conteo) {
    if (n > max) { mejor = forma; max = n; }
  }
  return mejor;
}

export interface AreaSaludData {
  area: string;     // etiqueta visible
  areaKey: string;  // clave de agrupación (normalizada)
  count: number;
  dimI: number;   // Implicación
  dimII: number;  // Consistencia
  dimIII: number; // Adaptabilidad
  dimIV: number;  // Misión
  globalCultura: number;
}

export interface ISOData extends AreaSaludData {
  /** Clima de la organización completa. Se muestra como referencia. */
  climaGlobal: number;
  /** Clima que entró en el ISO de ESTA área (propio o, si falta muestra, el global). */
  climaUsado: number;
  /** Respuestas de clima encontradas para esta área. */
  climaCount: number;
  /** true = no había muestra suficiente y se usó el clima global. */
  climaEsGlobal: boolean;
  iso: number;
  isoLevel: string;
}

export type Cuadrante =
  | "ÁGIL Y COMPROMETIDA"
  | "COMPROMETIDA PERO RÍGIDA"
  | "EN RIESGO"
  | "ADAPTABLE PERO DESVINCULADA";

export type CuadranteRotacion =
  | "RETENCIÓN SÓLIDA"
  | "COMPROMISO EN DESGASTE"
  | "PRESENCIA SIN COMPROMISO"
  | "RIESGO ALTO DE ROTACIÓN";

export function getISOLevel(iso: number): string {
  if (iso >= 4.21) return "MUY SALUDABLE";
  if (iso >= 3.61) return "SALUDABLE";
  if (iso >= 3.01) return "EN DESARROLLO";
  if (iso >= 2.41) return "EN RIESGO";
  return "CRÍTICO";
}

export function getISOColor(level: string): string {
  switch (level) {
    case "MUY SALUDABLE": return "#059669";
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
    const key = normalizarArea(ev.area);
    if (!areaMap.has(key)) areaMap.set(key, []);
    areaMap.get(key)!.push(ev);
  }

  return Array.from(areaMap.entries())
    .map(([areaKey, evs]) => {
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
      return {
        area: etiquetaArea(evs.map((e) => e.area ?? "")),
        areaKey,
        count: evs.length,
        dimI, dimII, dimIII, dimIV,
        globalCultura,
      };
    })
    .sort((a, b) => b.globalCultura - a.globalCultura);
}

export function calcularClimaGlobal(climaData: ClimaRespuesta[]): number {
  if (!climaData.length) return 0;
  return parseFloat(
    (climaData.reduce((a, r) => a + (r.score_global ?? 0), 0) / climaData.length).toFixed(2)
  );
}

export interface ClimaArea { mean: number; count: number }

/** Clima promedio por área, agrupado con la misma clave que la cultura. */
export function calcularClimaPorArea(climaData: ClimaRespuesta[]): Map<string, ClimaArea> {
  const acc = new Map<string, number[]>();
  for (const r of climaData) {
    const key = normalizarArea(r.area);
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(r.score_global ?? 0);
  }
  const out = new Map<string, ClimaArea>();
  for (const [key, vals] of acc) {
    out.set(key, {
      mean: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)),
      count: vals.length,
    });
  }
  return out;
}

/**
 * Fórmula: ISO = Cultura_área × 0.6 + Clima_área × 0.4
 *
 * El clima entra POR ÁREA, no global. Antes se sumaba el mismo clima global a
 * todas las áreas: como era una constante, el ranking por ISO terminaba siendo
 * el ranking por cultura desplazado y el clima no diferenciaba nada — un área
 * con cultura decente y clima pésimo quedaba invisible, que es justo lo que
 * este índice debe detectar.
 *
 * Si un área no llega a MIN_RESPUESTAS_CLIMA_AREA se usa el clima global como
 * respaldo (y queda marcado con climaEsGlobal) en vez de reportar una media
 * construida sobre una o dos respuestas.
 */
export function calcularISO(
  areaData: AreaSaludData[],
  climaData: ClimaRespuesta[],
  minRespuestas: number = MIN_RESPUESTAS_CLIMA_AREA
): ISOData[] {
  const climaGlobal = calcularClimaGlobal(climaData);
  const porArea = calcularClimaPorArea(climaData);

  return areaData.map((a) => {
    const propio = porArea.get(a.areaKey);
    const suficiente = !!propio && propio.count >= minRespuestas;
    const climaUsado = suficiente ? propio!.mean : climaGlobal;
    const iso = parseFloat((a.globalCultura * 0.6 + climaUsado * 0.4).toFixed(2));
    return {
      ...a,
      climaGlobal,
      climaUsado,
      climaCount: propio?.count ?? 0,
      climaEsGlobal: !suficiente,
      iso,
      isoLevel: getISOLevel(iso),
    };
  });
}

/** Áreas que respondieron clima pero no tienen ninguna evaluación de cultura. */
export function areasSoloClima(areaData: AreaSaludData[], climaData: ClimaRespuesta[]): string[] {
  const conCultura = new Set(areaData.map((a) => a.areaKey));
  const faltantes = new Map<string, string[]>();
  for (const r of climaData) {
    const key = normalizarArea(r.area);
    if (conCultura.has(key)) continue;
    if (!faltantes.has(key)) faltantes.set(key, []);
    faltantes.get(key)!.push(r.area ?? "");
  }
  return Array.from(faltantes.values()).map(etiquetaArea).sort();
}

// ─── Cuadrantes culturales (Adaptabilidad × Implicación) ────────────────────
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
  "ÁGIL Y COMPROMETIDA":         "#059669",
  "COMPROMETIDA PERO RÍGIDA":    "#ca8a04",
  "EN RIESGO":                   "#dc2626",
  "ADAPTABLE PERO DESVINCULADA": "#ea580c",
};

// ─── Cuadrantes de riesgo de rotación (Clima × Implicación) ─────────────────
/**
 * Riesgo de rotación cruzando el clima percibido del área (satisfacción con
 * liderazgo, reconocimiento, condiciones…) contra su implicación cultural.
 * Es el cruce que de verdad anticipa salidas: la cultura sola no lo hace.
 */
export function getCuadranteRotacion(clima: number, implicacion: number): CuadranteRotacion {
  if (clima >= 3.0 && implicacion >= 3.0) return "RETENCIÓN SÓLIDA";
  if (clima <  3.0 && implicacion >= 3.0) return "COMPROMISO EN DESGASTE";
  if (clima >= 3.0 && implicacion <  3.0) return "PRESENCIA SIN COMPROMISO";
  return "RIESGO ALTO DE ROTACIÓN";
}

export const ROTACION_DESC: Record<CuadranteRotacion, string> = {
  "RETENCIÓN SÓLIDA":         "Buen clima y alta implicación. Riesgo de rotación bajo: sostener las prácticas que ya funcionan.",
  "COMPROMISO EN DESGASTE":   "Gente comprometida en un entorno que no la sostiene. Riesgo alto de perder justo a quien más aporta: atacar liderazgo, reconocimiento y condiciones.",
  "PRESENCIA SIN COMPROMISO": "El entorno es cómodo pero falta vínculo con la organización. Riesgo de rotación silenciosa y bajo desempeño: trabajar propósito y participación.",
  "RIESGO ALTO DE ROTACIÓN":  "Clima desfavorable y baja implicación. Intervención urgente: es el perfil con mayor probabilidad de salidas.",
};

export const ROTACION_COLOR: Record<CuadranteRotacion, string> = {
  "RETENCIÓN SÓLIDA":         "#059669",
  "COMPROMISO EN DESGASTE":   "#ea580c",
  "PRESENCIA SIN COMPROMISO": "#ca8a04",
  "RIESGO ALTO DE ROTACIÓN":  "#dc2626",
};

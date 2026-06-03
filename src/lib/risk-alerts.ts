import type { Evaluacion, ClimaRespuesta } from "./supabase";
import type { ScoringResult } from "./scoring";
import type { ClimaResult } from "./clima-scoring";

export type RiskLevel = "ALTO" | "MEDIO" | "BAJO";

export interface AlertRule {
  id: string;
  nombre: string;
  cultDim: string;
  cultLabel: string;
  climaDim: string;
  climaLabel: string;
  recomendacion: string;
  baseLevel: RiskLevel;
}

export interface AlertTrigger {
  rule: AlertRule;
  cultScore: number;
  climaScore: number;
  severity: RiskLevel;
}

export interface AreaRisk {
  area: string;
  nEvaluados: number;
  overallRisk: RiskLevel | null;
  alerts: AlertTrigger[];
}

export const ALERT_RULES: AlertRule[] = [
  {
    id: "rotacion",
    nombre: "Riesgo de Rotación",
    cultDim: "I",
    cultLabel: "Implicación",
    climaDim: "D",
    climaLabel: "Reconocimiento y Motivación",
    recomendacion: "Implementar programa de reconocimiento. Conversaciones 1:1 con líderes de área. Revisar condiciones salariales.",
    baseLevel: "ALTO",
  },
  {
    id: "agotamiento",
    nombre: "Riesgo de Agotamiento",
    cultDim: "I",
    cultLabel: "Implicación",
    climaDim: "E",
    climaLabel: "Condiciones y Recursos",
    recomendacion: "Auditar carga de trabajo y condiciones físicas. Priorizar dotación de recursos y redistribución de cargas.",
    baseLevel: "ALTO",
  },
  {
    id: "desalineacion",
    nombre: "Riesgo de Desalineación",
    cultDim: "IV",
    cultLabel: "Misión",
    climaDim: "B",
    climaLabel: "Comunicación",
    recomendacion: "Fortalecer canales de comunicación interna. Talleres de alineación estratégica con los equipos.",
    baseLevel: "MEDIO",
  },
  {
    id: "estancamiento",
    nombre: "Riesgo de Estancamiento",
    cultDim: "III",
    cultLabel: "Adaptabilidad",
    climaDim: "F",
    climaLabel: "Desarrollo Profesional",
    recomendacion: "Diseñar planes de carrera individuales. Invertir en capacitación y aprendizaje organizacional.",
    baseLevel: "MEDIO",
  },
];

const UMBRAL_BAJO = 3.0;
const UMBRAL_MUY_BAJO = 2.5;

function computeSeverity(cultScore: number, climaScore: number, base: RiskLevel): RiskLevel | null {
  if (cultScore >= UMBRAL_BAJO || climaScore >= UMBRAL_BAJO) return null;
  if (cultScore < UMBRAL_MUY_BAJO && climaScore < UMBRAL_MUY_BAJO) return "ALTO";
  if (base === "ALTO") return "ALTO";
  return "MEDIO";
}

const RISK_ORDER: Record<RiskLevel, number> = { ALTO: 0, MEDIO: 1, BAJO: 2 };

export function calcularAlertas(
  evaluaciones: Evaluacion[],
  climaData: ClimaRespuesta[]
): AreaRisk[] {
  if (!climaData.length || !evaluaciones.length) return [];

  const climaMeans: Record<string, number> = {};
  ["A", "B", "C", "D", "E", "F"].forEach((code) => {
    const vals = climaData.map((r) => {
      const s = r.scores as ClimaResult;
      return s.dimensions.find((d) => d.code === code)?.mean ?? 0;
    });
    climaMeans[code] = vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  const areaMap = new Map<string, Evaluacion[]>();
  evaluaciones.forEach((e) => {
    const a = e.area?.trim() || "Sin área";
    if (!areaMap.has(a)) areaMap.set(a, []);
    areaMap.get(a)!.push(e);
  });

  const result: AreaRisk[] = [];

  areaMap.forEach((evals, area) => {
    const cultMeans: Record<string, number> = {};
    ["I", "II", "III", "IV"].forEach((dim) => {
      const vals = evals.map((e) => {
        const s = e.scores as ScoringResult;
        return s.dimensions.find((d) => d.code === dim)?.mean ?? 0;
      });
      cultMeans[dim] = vals.reduce((a, b) => a + b, 0) / vals.length;
    });

    const alerts: AlertTrigger[] = [];
    ALERT_RULES.forEach((rule) => {
      const cultScore = cultMeans[rule.cultDim] ?? 0;
      const climaScore = climaMeans[rule.climaDim] ?? 0;
      const severity = computeSeverity(cultScore, climaScore, rule.baseLevel);
      if (severity) alerts.push({ rule, cultScore, climaScore, severity });
    });

    let overallRisk: RiskLevel | null = null;
    if (alerts.some((a) => a.severity === "ALTO")) overallRisk = "ALTO";
    else if (alerts.some((a) => a.severity === "MEDIO")) overallRisk = "MEDIO";
    else if (alerts.length) overallRisk = "BAJO";

    result.push({ area, nEvaluados: evals.length, overallRisk, alerts });
  });

  return result.sort((a, b) => {
    const ao = a.overallRisk ? RISK_ORDER[a.overallRisk] : 3;
    const bo = b.overallRisk ? RISK_ORDER[b.overallRisk] : 3;
    return ao - bo;
  });
}

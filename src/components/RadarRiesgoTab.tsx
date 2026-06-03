"use client";

import { useMemo } from "react";
import type { Evaluacion, ClimaRespuesta } from "@/lib/supabase";
import { calcularAlertas, type AreaRisk, type RiskLevel } from "@/lib/risk-alerts";

interface Props {
  evaluaciones: Evaluacion[];
  climaData: ClimaRespuesta[];
}

const RISK_CONFIG: Record<RiskLevel, { label: string; emoji: string; bg: string; border: string; text: string }> = {
  ALTO:  { label: "Riesgo Alto",  emoji: "🔴", bg: "#fef2f2", border: "#fca5a5", text: "#dc2626" },
  MEDIO: { label: "Riesgo Medio", emoji: "🟡", bg: "#fffbeb", border: "#fcd34d", text: "#b45309" },
  BAJO:  { label: "Riesgo Bajo",  emoji: "🟠", bg: "#fff7ed", border: "#fdba74", text: "#c2410c" },
};

const ALERT_COLORS: Record<RiskLevel, { dot: string; text: string }> = {
  ALTO:  { dot: "#dc2626", text: "#7f1d1d" },
  MEDIO: { dot: "#b45309", text: "#78350f" },
  BAJO:  { dot: "#c2410c", text: "#431407" },
};

function ScoreBadge({ label, score }: { label: string; score: number }) {
  const color = score < 2.5 ? "#dc2626" : score < 3.0 ? "#ea580c" : "#16a34a";
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${color}18`, color }}>
      {label}: {score.toFixed(2)}
    </span>
  );
}

function AreaCard({ areaRisk }: { areaRisk: AreaRisk }) {
  const { area, nEvaluados, overallRisk, alerts } = areaRisk;

  if (!overallRisk) {
    return (
      <div className="rounded-2xl border p-5 flex items-center justify-between"
        style={{ background: "#f0fdf4", borderColor: "#86efac" }}>
        <div>
          <span className="text-base font-bold" style={{ color: "#15803d" }}>✅ {area}</span>
          <p className="text-xs mt-0.5" style={{ color: "#166534" }}>{nEvaluados} evaluado{nEvaluados !== 1 ? "s" : ""}</p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: "#dcfce7", color: "#15803d" }}>
          Sin alertas
        </span>
      </div>
    );
  }

  const cfg = RISK_CONFIG[overallRisk];

  return (
    <div className="rounded-2xl border p-5 space-y-4"
      style={{ background: cfg.bg, borderColor: cfg.border }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-base font-bold" style={{ color: "#1a2035" }}>
            {cfg.emoji} {area}
          </span>
          <p className="text-xs mt-0.5 text-gray-500">{nEvaluados} evaluado{nEvaluados !== 1 ? "s" : ""} en esta área</p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full"
          style={{ background: cfg.border, color: cfg.text }}>
          {cfg.label}
        </span>
      </div>

      {/* Alertas */}
      <div className="space-y-3">
        {alerts.map(({ rule, cultScore, climaScore, severity }) => {
          const ac = ALERT_COLORS[severity];
          const sevEmoji = severity === "ALTO" ? "🔴" : "🟡";
          return (
            <div key={rule.id} className="bg-white rounded-xl p-4 shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">{sevEmoji}</span>
                <span className="text-sm font-bold" style={{ color: ac.text }}>{rule.nombre}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <ScoreBadge label={`Cultura — ${rule.cultLabel}`} score={cultScore} />
                <ScoreBadge label={`Clima — ${rule.climaLabel}`} score={climaScore} />
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                <span className="font-semibold">Acción recomendada:</span> {rule.recomendacion}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RadarRiesgoTab({ evaluaciones, climaData }: Props) {
  const areaRisks = useMemo(
    () => calcularAlertas(evaluaciones, climaData),
    [evaluaciones, climaData]
  );

  const sinDatos = !evaluaciones.length || !climaData.length;
  const nAlto  = areaRisks.filter((a) => a.overallRisk === "ALTO").length;
  const nMedio = areaRisks.filter((a) => a.overallRisk === "MEDIO").length;
  const nSin   = areaRisks.filter((a) => !a.overallRisk).length;

  return (
    <div className="space-y-6">

      {/* Título */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-lg font-bold" style={{ color: "#1a2035" }}>
          Radar de Riesgo Organizacional
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Cruza automáticamente los resultados de Cultura por área con el Clima global. Solo muestra alertas cuando existen datos de ambos instrumentos.
        </p>
      </div>

      {/* Sin datos suficientes */}
      {sinDatos && (
        <div className="bg-white rounded-2xl shadow p-10 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-semibold text-gray-700">Se necesitan datos de ambos instrumentos</p>
          <p className="text-sm text-gray-400 mt-1">
            {!evaluaciones.length && "Aún no hay evaluaciones de Cultura. "}
            {!climaData.length && "Aún no hay respuestas de Clima Laboral."}
          </p>
        </div>
      )}

      {/* Resumen */}
      {!sinDatos && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Áreas en riesgo alto",  value: nAlto,  color: "#dc2626", bg: "#fef2f2" },
            { label: "Áreas en riesgo medio", value: nMedio, color: "#b45309", bg: "#fffbeb" },
            { label: "Áreas sin alertas",     value: nSin,   color: "#15803d", bg: "#f0fdf4" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="rounded-2xl shadow p-5 text-center" style={{ background: bg }}>
              <p className="text-3xl font-bold" style={{ color }}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tarjetas por área */}
      {!sinDatos && areaRisks.length > 0 && (
        <div className="space-y-4">
          {areaRisks.map((ar) => (
            <AreaCard key={ar.area} areaRisk={ar} />
          ))}
        </div>
      )}

      {/* Nota metodológica */}
      {!sinDatos && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="font-semibold">Nota metodológica:</span> Las alertas se activan cuando ambas dimensiones de un patrón se encuentran por debajo de 3.0 (nivel BAJO o MUY BAJO). El Clima se toma como promedio global (datos anónimos). La Cultura se calcula por área con los evaluados de cada una.
          </p>
        </div>
      )}
    </div>
  );
}

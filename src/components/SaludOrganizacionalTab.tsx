"use client";

import React, { useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { Evaluacion, ClimaRespuesta } from "@/lib/supabase";
import {
  calcularAreaDOCS,
  calcularClimaGlobal,
  calcularISO,
  getCuadrante,
  getISOColor,
  getISOLevel,
  CUADRANTE_DESC,
  CUADRANTE_COLOR,
  type ISOData,
  type Cuadrante,
} from "@/lib/salud-scoring";

interface Props {
  evaluaciones: Evaluacion[];
  climaData: ClimaRespuesta[];
}

// ─── Custom bubble shape ────────────────────────────────────────────────────
interface BubblePayload {
  area: string;
  count: number;
  x: number;
  y: number;
}

function BubbleShape(props: Record<string, unknown>) {
  const cx = props.cx as number;
  const cy = props.cy as number;
  const payload = props.payload as BubblePayload;
  // Radius scales with count but clamped: min 20px, max 52px
  const r = Math.max(20, Math.min(52, 16 + payload.count * 7));
  const label =
    payload.area.length > 12 ? payload.area.slice(0, 11) + "…" : payload.area;
  return (
    <g>
      <circle
        cx={cx} cy={cy} r={r}
        fill="#c9a84c" fillOpacity={0.65}
        stroke="#1a2035" strokeWidth={1.5}
      />
      <text
        x={cx} y={cy - 3}
        textAnchor="middle" fontSize={8}
        fill="#1a2035" fontWeight="700"
      >
        {label}
      </text>
      <text
        x={cx} y={cy + 10}
        textAnchor="middle" fontSize={7} fill="#243447"
      >
        {`n=${payload.count}`}
      </text>
    </g>
  );
}

// ─── Custom tooltips ────────────────────────────────────────────────────────
interface HeatTooltipPayload {
  area: string; count: number; x: number; y: number;
}
interface RotTooltipPayload {
  area: string; count: number; x: number; y: number;
  cuadrante: Cuadrante;
}

function HeatTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: HeatTooltipPayload }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-[200px]">
      <p className="font-bold text-gray-800 mb-1">{d.area}</p>
      <p className="text-gray-600">Consistencia (Eje X): <b>{d.x.toFixed(2)}</b></p>
      <p className="text-gray-600">Implicación (Eje Y): <b>{d.y.toFixed(2)}</b></p>
      <p className="text-gray-500 mt-1">Evaluados: {d.count}</p>
    </div>
  );
}

function RotTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: RotTooltipPayload }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-[220px]">
      <p className="font-bold text-gray-800 mb-1">{d.area}</p>
      <p className="text-gray-600">Adaptabilidad (Eje X): <b>{d.x.toFixed(2)}</b></p>
      <p className="text-gray-600">Implicación (Eje Y): <b>{d.y.toFixed(2)}</b></p>
      <p className="mt-1 font-semibold" style={{ color: CUADRANTE_COLOR[d.cuadrante] }}>
        {d.cuadrante}
      </p>
      <p className="text-gray-500 mt-0.5">{CUADRANTE_DESC[d.cuadrante]}</p>
      <p className="text-gray-400 mt-1">Evaluados: {d.count}</p>
    </div>
  );
}

// ─── ISO Bar ────────────────────────────────────────────────────────────────
function ISOBar({ value }: { value: number }) {
  const pct = Math.min(100, (value / 5) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, background: getISOColor(getISOLevel(value)) }}
        />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color: getISOColor(getISOLevel(value)) }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function SaludOrganizacionalTab({ evaluaciones, climaData }: Props) {
  const { areaData, climaGlobal, isoData, isoGlobal, bubbleData, rotacionData, cuadranteResumen } =
    useMemo(() => {
      const areaData   = calcularAreaDOCS(evaluaciones);
      const climaGlobal = calcularClimaGlobal(climaData);
      const isoData    = calcularISO(areaData, climaGlobal);

      // ISO global: promedio de todos los evaluados (sin segmentar por área) × 0.6 + clima × 0.4
      const culturaGlobalTotal = evaluaciones.length
        ? parseFloat((
            evaluaciones.reduce((sum, e) => {
              const s = e.scores as import("@/lib/scoring").ScoringResult;
              return sum + s.global;
            }, 0) / evaluaciones.length
          ).toFixed(2))
        : 0;
      const isoGlobal = parseFloat((culturaGlobalTotal * 0.6 + climaGlobal * 0.4).toFixed(2));

      // Mapa de calor burbuja: X = Consistencia (dimII), Y = Implicación (dimI)
      const bubbleData = areaData.map((a) => ({ x: a.dimII, y: a.dimI, area: a.area, count: a.count }));

      // Matriz de rotación: X = Adaptabilidad (dimIII), Y = Implicación (dimI)
      const rotacionData = areaData.map((a) => ({
        x: a.dimIII,
        y: a.dimI,
        area: a.area,
        count: a.count,
        cuadrante: getCuadrante(a.dimIII, a.dimI),
      }));

      // Conteo de áreas por cuadrante
      const cuadranteResumen = rotacionData.reduce<Record<string, number>>((acc, d) => {
        acc[d.cuadrante] = (acc[d.cuadrante] ?? 0) + 1;
        return acc;
      }, {});

      return { areaData, climaGlobal, isoData, isoGlobal, bubbleData, rotacionData, cuadranteResumen };
    }, [evaluaciones, climaData]);

  const noData = evaluaciones.length === 0;
  const noClima = climaData.length === 0;
  const isoGlobalLevel = getISOLevel(isoGlobal);

  if (noData) {
    return (
      <div className="bg-white rounded-2xl shadow p-12 text-center">
        <p className="text-gray-400 text-sm">
          No hay evaluaciones DOCS registradas. Completa el cuestionario de cultura organizacional primero.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Evaluados DOCS",    value: evaluaciones.length.toString() },
          { label: "Respuestas Clima",  value: climaData.length.toString() },
          { label: "Áreas analizadas",  value: areaData.length.toString() },
          {
            label: "ISO Organizacional",
            value: evaluaciones.length && !noClima ? isoGlobal.toFixed(2) : "—",
            color: !noClima ? getISOColor(isoGlobalLevel) : undefined,
            sub: !noClima ? isoGlobalLevel : "Sin datos de clima",
          },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="bg-white rounded-2xl shadow p-5 text-center">
            <p className="text-2xl font-bold" style={{ color: color ?? "#1a2035" }}>{value}</p>
            {sub && <p className="text-xs font-semibold mt-0.5" style={{ color: color ?? "#6b7280" }}>{sub}</p>}
            <p className="text-xs text-gray-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {noClima && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <b>Nota:</b> No hay respuestas de clima laboral. El ISO requiere datos de ambos instrumentos. Los gráficos de posicionamiento cultural sí están disponibles con los datos DOCS.
        </div>
      )}

      {/* ISO por área */}
      {!noClima && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-base font-bold mb-1" style={{ color: "#1a2035" }}>
            Índice de Salud Organizacional (ISO) por Área
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Fórmula: ISO = Cultura DOCS × 0.6 + Clima Laboral global × 0.4 · Clima global: <b>{climaGlobal.toFixed(2)}</b>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#1a2035" }}>
                  {["Área", "Evaluados", "Cultura (DOCS)", "Clima (global)", "ISO", "Nivel", "Barra"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap" style={{ color: "#c9a84c" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(isoData as ISOData[]).map((row, i) => (
                  <tr key={row.area} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{row.area}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{row.count}</td>
                    <td className="px-3 py-2 text-center font-semibold" style={{ color: "#1a2035" }}>{row.globalCultura.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{climaGlobal.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center font-bold" style={{ color: getISOColor(row.isoLevel) }}>
                      {row.iso.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold whitespace-nowrap" style={{ color: getISOColor(row.isoLevel) }}>
                      {row.isoLevel}
                    </td>
                    <td className="px-3 py-2 min-w-[120px]">
                      <ISOBar value={row.iso} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mapa de calor burbuja */}
      {areaData.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-base font-bold mb-1" style={{ color: "#1a2035" }}>
            Mapa de Calor Cultural por Área
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Eje X = Consistencia · Eje Y = Implicación · Tamaño = n° evaluados por área · Zona óptima: arriba a la derecha
          </p>
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                type="number" dataKey="x"
                domain={[1, 5]} name="Consistencia"
                label={{ value: "Consistencia (Dim. II)", position: "insideBottom", offset: -15, fontSize: 11, fill: "#6b7280" }}
                tickCount={5} tick={{ fontSize: 10 }}
              />
              <YAxis
                type="number" dataKey="y"
                domain={[1, 5]} name="Implicación"
                label={{ value: "Implicación (Dim. I)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "#6b7280" }}
                tickCount={5} tick={{ fontSize: 10 }}
              />
              <ReferenceLine x={3} stroke="#94a3b8" strokeDasharray="4 4" />
              <ReferenceLine y={3} stroke="#94a3b8" strokeDasharray="4 4" />
              <Tooltip content={(props) => <HeatTooltip active={(props as { active?: boolean }).active} payload={(props as { payload?: Array<{ payload: HeatTooltipPayload }> }).payload} />} />
              <Scatter data={bubbleData} shape={(props) => <BubbleShape {...(props as Record<string, unknown>)} />} />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 border-t border-dashed border-gray-400" />Umbral 3.0</span>
            <span>Zona óptima → cuadrante superior derecho (Consistencia &gt; 3 + Implicación &gt; 3)</span>
          </div>
        </div>
      )}

      {/* Matriz de rotación */}
      {areaData.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-base font-bold mb-1" style={{ color: "#1a2035" }}>
            Matriz de Posicionamiento Cultural
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Eje X = Adaptabilidad · Eje Y = Implicación · Cada cuadrante define el perfil de riesgo/oportunidad del área
          </p>
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                type="number" dataKey="x"
                domain={[1, 5]} name="Adaptabilidad"
                label={{ value: "Adaptabilidad (Dim. III)", position: "insideBottom", offset: -15, fontSize: 11, fill: "#6b7280" }}
                tickCount={5} tick={{ fontSize: 10 }}
              />
              <YAxis
                type="number" dataKey="y"
                domain={[1, 5]} name="Implicación"
                label={{ value: "Implicación (Dim. I)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "#6b7280" }}
                tickCount={5} tick={{ fontSize: 10 }}
              />
              <ReferenceLine x={3} stroke="#94a3b8" strokeDasharray="4 4" />
              <ReferenceLine y={3} stroke="#94a3b8" strokeDasharray="4 4" />
              <Tooltip content={(props) => <RotTooltip active={(props as { active?: boolean }).active} payload={(props as { payload?: Array<{ payload: RotTooltipPayload }> }).payload} />} />
              <Scatter data={rotacionData} shape={(props) => <BubbleShape {...(props as Record<string, unknown>)} />} />
            </ScatterChart>
          </ResponsiveContainer>

          {/* Leyenda de cuadrantes */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.entries(CUADRANTE_DESC) as [Cuadrante, string][]).map(([cuadrante, desc]) => {
              const count = cuadranteResumen[cuadrante] ?? 0;
              return (
                <div
                  key={cuadrante}
                  className="flex gap-3 p-3 rounded-xl border"
                  style={{ borderColor: CUADRANTE_COLOR[cuadrante] + "40", background: CUADRANTE_COLOR[cuadrante] + "0a" }}
                >
                  <div
                    className="w-2 rounded-full shrink-0 mt-0.5"
                    style={{ background: CUADRANTE_COLOR[cuadrante] }}
                  />
                  <div>
                    <p className="text-xs font-bold mb-0.5" style={{ color: CUADRANTE_COLOR[cuadrante] }}>
                      {cuadrante}
                      {count > 0 && (
                        <span className="ml-2 font-normal text-gray-400">({count} área{count !== 1 ? "s" : ""})</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

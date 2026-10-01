/* eslint-disable @typescript-eslint/no-explicit-any */
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
  areasSoloClima,
  getCuadrante,
  getCuadranteRotacion,
  getISOColor,
  getISOLevel,
  CUADRANTE_DESC,
  CUADRANTE_COLOR,
  ROTACION_DESC,
  ROTACION_COLOR,
  MIN_RESPUESTAS_CLIMA_AREA,
  type ISOData,
} from "@/lib/salud-scoring";

interface Props {
  evaluaciones: Evaluacion[];
  climaData: ClimaRespuesta[];
}

// ─── Punto del scatter ──────────────────────────────────────────────────────
// Las etiquetas de los ejes viajan dentro del dato para que un mismo tooltip
// sirva a los tres gráficos sin crear componentes nuevos en cada render.
interface Punto {
  area: string;
  count: number;
  x: number;
  y: number;
  xLabel: string;
  yLabel: string;
  nota?: string;
}

interface PuntoCuadrante extends Punto {
  cuadrante: string;
  desc: string;
  color: string;
}

function BubbleShape(props: any) {
  const cx = props.cx as number;
  const cy = props.cy as number;
  const payload = props.payload as Punto;
  // Radius scales with count but clamped: min 20px, max 52px
  const r = Math.max(20, Math.min(52, 16 + payload.count * 7));
  const label =
    payload.area.length > 12 ? payload.area.slice(0, 11) + "…" : payload.area;
  return (
    <g>
      <circle
        cx={cx} cy={cy} r={r}
        fill="#10b981" fillOpacity={0.65}
        stroke="#0A1A32" strokeWidth={1.5}
      />
      <text
        x={cx} y={cy - 3}
        textAnchor="middle" fontSize={8}
        fill="#0A1A32" fontWeight="700"
      >
        {label}
      </text>
      <text
        x={cx} y={cy + 10}
        textAnchor="middle" fontSize={7} fill="#1E2D5A"
      >
        {`n=${payload.count}`}
      </text>
    </g>
  );
}

function EjesTooltip(props: any) {
  if (!props.active || !props.payload?.length) return null;
  const d = props.payload[0].payload as Punto;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-[220px]">
      <p className="font-bold text-gray-800 mb-1">{d.area}</p>
      <p className="text-gray-600">{d.xLabel}: <b>{d.x.toFixed(2)}</b></p>
      <p className="text-gray-600">{d.yLabel}: <b>{d.y.toFixed(2)}</b></p>
      <p className="text-gray-500 mt-1">Evaluados: {d.count}</p>
      {d.nota && <p className="text-amber-600 mt-1">{d.nota}</p>}
    </div>
  );
}

function CuadranteTooltip(props: any) {
  if (!props.active || !props.payload?.length) return null;
  const d = props.payload[0].payload as PuntoCuadrante;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-[240px]">
      <p className="font-bold text-gray-800 mb-1">{d.area}</p>
      <p className="text-gray-600">{d.xLabel}: <b>{d.x.toFixed(2)}</b></p>
      <p className="text-gray-600">{d.yLabel}: <b>{d.y.toFixed(2)}</b></p>
      <p className="mt-1 font-semibold" style={{ color: d.color }}>{d.cuadrante}</p>
      <p className="text-gray-500 mt-0.5">{d.desc}</p>
      <p className="text-gray-400 mt-1">Evaluados: {d.count}</p>
      {d.nota && <p className="text-amber-600 mt-1">{d.nota}</p>}
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

// ─── Leyenda de cuadrantes ──────────────────────────────────────────────────
function LeyendaCuadrantes({
  desc, color, resumen,
}: {
  desc: Record<string, string>;
  color: Record<string, string>;
  resumen: Record<string, number>;
}) {
  return (
    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Object.entries(desc).map(([cuadrante, texto]) => {
        const count = resumen[cuadrante] ?? 0;
        return (
          <div
            key={cuadrante}
            className="flex gap-3 p-3 rounded-xl border"
            style={{ borderColor: color[cuadrante] + "40", background: color[cuadrante] + "0a" }}
          >
            <div className="w-2 rounded-full shrink-0 mt-0.5" style={{ background: color[cuadrante] }} />
            <div>
              <p className="text-xs font-bold mb-0.5" style={{ color: color[cuadrante] }}>
                {cuadrante}
                {count > 0 && (
                  <span className="ml-2 font-normal text-gray-400">({count} área{count !== 1 ? "s" : ""})</span>
                )}
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">{texto}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function SaludOrganizacionalTab({ evaluaciones, climaData }: Props) {
  const {
    areaData, climaGlobal, isoData, isoGlobal, sinCultura,
    bubbleData, bubbleEjes, rotacionData, cuadranteResumen,
    riesgoData, riesgoResumen, areasConClimaPropio,
  } = useMemo(() => {
    const areaData    = calcularAreaDOCS(evaluaciones);
    const climaGlobal = calcularClimaGlobal(climaData);
    const isoData     = calcularISO(areaData, climaData);
    const sinCultura  = areasSoloClima(areaData, climaData);
    const hayClima    = climaData.length > 0;

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

    const notaFallback = `Sin muestra propia de clima (mín. ${MIN_RESPUESTAS_CLIMA_AREA}): se usa el clima global`;

    // Mapa principal: Clima del área (X) × Cultura del área (Y). Si todavía no
    // hay clima, el eje X cae a Consistencia para que el mapa siga sirviendo.
    const bubbleEjes = hayClima
      ? { xLabel: "Clima Laboral del área", yLabel: "Cultura DOCS del área", titulo: "Mapa Clima × Cultura por Área" }
      : { xLabel: "Consistencia (Dim. II)", yLabel: "Implicación (Dim. I)",  titulo: "Mapa de Calor Cultural por Área" };

    const bubbleData: Punto[] = hayClima
      ? isoData.map((a) => ({
          x: a.climaUsado, y: a.globalCultura, area: a.area, count: a.count,
          xLabel: bubbleEjes.xLabel, yLabel: bubbleEjes.yLabel,
          nota: a.climaEsGlobal ? notaFallback : undefined,
        }))
      : areaData.map((a) => ({
          x: a.dimII, y: a.dimI, area: a.area, count: a.count,
          xLabel: bubbleEjes.xLabel, yLabel: bubbleEjes.yLabel,
        }));

    // Matriz cultural: Adaptabilidad × Implicación (ambas de cultura, a propósito)
    const rotacionData: PuntoCuadrante[] = areaData.map((a) => {
      const c = getCuadrante(a.dimIII, a.dimI);
      return {
        x: a.dimIII, y: a.dimI, area: a.area, count: a.count,
        xLabel: "Adaptabilidad (Dim. III)", yLabel: "Implicación (Dim. I)",
        cuadrante: c, desc: CUADRANTE_DESC[c], color: CUADRANTE_COLOR[c],
      };
    });

    // Matriz de riesgo de rotación: Clima del área × Implicación cultural
    const riesgoData: PuntoCuadrante[] = hayClima
      ? isoData.map((a) => {
          const c = getCuadranteRotacion(a.climaUsado, a.dimI);
          return {
            x: a.climaUsado, y: a.dimI, area: a.area, count: a.count,
            xLabel: "Clima Laboral del área", yLabel: "Implicación (Dim. I)",
            cuadrante: c, desc: ROTACION_DESC[c], color: ROTACION_COLOR[c],
            nota: a.climaEsGlobal ? notaFallback : undefined,
          };
        })
      : [];

    const contar = (datos: PuntoCuadrante[]) =>
      datos.reduce<Record<string, number>>((acc, d) => {
        acc[d.cuadrante] = (acc[d.cuadrante] ?? 0) + 1;
        return acc;
      }, {});

    return {
      areaData, climaGlobal, isoData, isoGlobal, sinCultura,
      bubbleData, bubbleEjes, rotacionData,
      cuadranteResumen: contar(rotacionData),
      riesgoData, riesgoResumen: contar(riesgoData),
      areasConClimaPropio: isoData.filter((a) => !a.climaEsGlobal).length,
    };
  }, [evaluaciones, climaData]);

  const noData = evaluaciones.length === 0;
  const noClima = climaData.length === 0;
  const isoGlobalLevel = getISOLevel(isoGlobal);
  const hayFallback = !noClima && areasConClimaPropio < isoData.length;

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
            <p className="text-2xl font-bold" style={{ color: color ?? "#0A1A32" }}>{value}</p>
            {sub && <p className="text-xs font-semibold mt-0.5" style={{ color: color ?? "#6b7280" }}>{sub}</p>}
            <p className="text-xs text-gray-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {noClima && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <b>Nota:</b> No hay respuestas de clima laboral. El ISO y la matriz de riesgo de rotación requieren datos de ambos instrumentos. Los gráficos de posicionamiento cultural sí están disponibles con los datos DOCS.
        </div>
      )}

      {sinCultura.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <b>Áreas fuera del análisis:</b> {sinCultura.join(", ")} respondió clima pero no tiene ninguna evaluación de cultura, así que no aparece en el ISO ni en los mapas. Envíale el cuestionario DOCS para incluirla.
        </div>
      )}

      {/* ISO por área */}
      {!noClima && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-base font-bold mb-1" style={{ color: "#0A1A32" }}>
            Índice de Salud Organizacional (ISO) por Área
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Fórmula: ISO = Cultura DOCS del área × 0.6 + Clima Laboral del área × 0.4 · Clima global de referencia: <b>{climaGlobal.toFixed(2)}</b>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#0A1A32" }}>
                  {["Área", "Evaluados", "Cultura (DOCS)", "Resp. clima", "Clima del área", "ISO", "Nivel", "Barra"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap" style={{ color: "#10b981" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(isoData as ISOData[]).map((row, i) => (
                  <tr key={row.areaKey} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{row.area}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{row.count}</td>
                    <td className="px-3 py-2 text-center font-semibold" style={{ color: "#0A1A32" }}>{row.globalCultura.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{row.climaCount}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span className={row.climaEsGlobal ? "text-gray-400" : "font-semibold text-gray-700"}>
                        {row.climaUsado.toFixed(2)}
                      </span>
                      {row.climaEsGlobal && (
                        <span
                          className="ml-1 text-amber-600 cursor-help"
                          title={`Esta área tiene ${row.climaCount} respuesta(s) de clima; se necesitan ${MIN_RESPUESTAS_CLIMA_AREA}. Se usó el clima global (${climaGlobal.toFixed(2)}).`}
                        >
                          *
                        </span>
                      )}
                    </td>
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
          {hayFallback && (
            <p className="text-xs text-amber-700 mt-3 leading-relaxed">
              <b>*</b> Área sin muestra propia de clima suficiente (mínimo {MIN_RESPUESTAS_CLIMA_AREA} respuestas).
              Se usó el clima global como respaldo: su ISO es una estimación. Con menos respuestas el
              promedio del área es ruido y además deja de ser confidencial.
            </p>
          )}
        </div>
      )}

      {/* Mapa principal */}
      {areaData.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-base font-bold mb-1" style={{ color: "#0A1A32" }}>
            {bubbleEjes.titulo}
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Eje X = {bubbleEjes.xLabel} · Eje Y = {bubbleEjes.yLabel} · Tamaño = n° evaluados por área · Zona óptima: arriba a la derecha
          </p>
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                type="number" dataKey="x"
                domain={[1, 5]} name={bubbleEjes.xLabel}
                label={{ value: bubbleEjes.xLabel, position: "insideBottom", offset: -15, fontSize: 11, fill: "#6b7280" }}
                tickCount={5} tick={{ fontSize: 10 }}
              />
              <YAxis
                type="number" dataKey="y"
                domain={[1, 5]} name={bubbleEjes.yLabel}
                label={{ value: bubbleEjes.yLabel, angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "#6b7280" }}
                tickCount={5} tick={{ fontSize: 10 }}
              />
              <ReferenceLine x={3} stroke="#94a3b8" strokeDasharray="4 4" />
              <ReferenceLine y={3} stroke="#94a3b8" strokeDasharray="4 4" />
              <Tooltip content={<EjesTooltip />} />
              <Scatter data={bubbleData} shape={(props: any) => <BubbleShape {...props} />} />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 border-t border-dashed border-gray-400" />Umbral 3.0</span>
            <span>Zona óptima → cuadrante superior derecho ({bubbleEjes.xLabel} &gt; 3 + {bubbleEjes.yLabel} &gt; 3)</span>
          </div>
        </div>
      )}

      {/* Matriz de riesgo de rotación — Clima × Implicación */}
      {!noClima && riesgoData.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-base font-bold mb-1" style={{ color: "#0A1A32" }}>
            Matriz de Riesgo de Rotación
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Eje X = Clima Laboral del área · Eje Y = Implicación cultural · El cruce clima × implicación es el que anticipa salidas: la cultura sola no lo hace
          </p>
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                type="number" dataKey="x"
                domain={[1, 5]} name="Clima Laboral"
                label={{ value: "Clima Laboral del área", position: "insideBottom", offset: -15, fontSize: 11, fill: "#6b7280" }}
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
              <Tooltip content={<CuadranteTooltip />} />
              <Scatter data={riesgoData} shape={(props: any) => <BubbleShape {...props} />} />
            </ScatterChart>
          </ResponsiveContainer>
          <LeyendaCuadrantes
            desc={ROTACION_DESC as Record<string, string>}
            color={ROTACION_COLOR as Record<string, string>}
            resumen={riesgoResumen}
          />
        </div>
      )}

      {/* Matriz de posicionamiento cultural — Adaptabilidad × Implicación */}
      {areaData.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-base font-bold mb-1" style={{ color: "#0A1A32" }}>
            Matriz de Posicionamiento Cultural
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Eje X = Adaptabilidad · Eje Y = Implicación · Ambos ejes son de cultura (DOCS): describe cómo se mueve el área, no cómo se siente
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
              <Tooltip content={<CuadranteTooltip />} />
              <Scatter data={rotacionData} shape={(props: any) => <BubbleShape {...props} />} />
            </ScatterChart>
          </ResponsiveContainer>
          <LeyendaCuadrantes
            desc={CUADRANTE_DESC as Record<string, string>}
            color={CUADRANTE_COLOR as Record<string, string>}
            resumen={cuadranteResumen}
          />
        </div>
      )}

    </div>
  );
}

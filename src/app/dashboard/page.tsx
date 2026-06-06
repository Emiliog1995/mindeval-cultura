"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";
import { listarEvaluaciones, listarClima, type Evaluacion, type ClimaRespuesta } from "@/lib/supabase";
import { getLevelColor } from "@/lib/scoring";
import { isAdmin, logout } from "@/lib/auth";
import type { ScoringResult } from "@/lib/scoring";
import { CLIMA_DIMENSIONS, type ClimaDimension } from "@/lib/clima-items";
import { getClimaLevelColor, type ClimaResult } from "@/lib/clima-scoring";
import SaludOrganizacionalTab from "@/components/SaludOrganizacionalTab";
import RadarRiesgoTab from "@/components/RadarRiesgoTab";

type Tab = "docs" | "clima" | "salud" | "alertas";

const CLIMA_DIM_CODES: ClimaDimension[] = ["A", "B", "C", "D", "E", "F"];

export default function Dashboard() {
  const router = useRouter();

  // ─── Tab ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("docs");

  // ─── DOCS ────────────────────────────────────────────────────────────────
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [filtroArea, setFiltroArea]     = useState("");
  const [filtroCargo, setFiltroCargo]   = useState("");
  const [cargando, setCargando]         = useState(true);
  const [error, setError]               = useState("");

  // ─── Clima ───────────────────────────────────────────────────────────────
  const [climaData, setClimaData]         = useState<ClimaRespuesta[]>([]);
  const [cargandoClima, setCargandoClima] = useState(true);
  const [errorClima, setErrorClima]       = useState("");

  useEffect(() => {
    if (!isAdmin()) { router.replace("/admin"); return; }

    listarEvaluaciones()
      .then(setEvaluaciones)
      .catch(() => setError("No se pudieron cargar las evaluaciones. Verifica las credenciales de Supabase."))
      .finally(() => setCargando(false));

    listarClima()
      .then(setClimaData)
      .catch(() => setErrorClima("No se pudieron cargar los datos de clima."))
      .finally(() => setCargandoClima(false));
  }, [router]);

  // ─── DOCS helpers ────────────────────────────────────────────────────────
  const areas  = [...new Set(evaluaciones.map((e) => e.area).filter(Boolean))].sort();
  const cargos = [...new Set(evaluaciones.map((e) => e.cargo).filter(Boolean))].sort();

  const filtradas = evaluaciones.filter((e) => {
    if (filtroArea  && e.area  !== filtroArea)  return false;
    if (filtroCargo && e.cargo !== filtroCargo) return false;
    return true;
  });

  function promedioOrg() {
    if (!filtradas.length) return null;
    const dims = ["I", "II", "III", "IV"] as const;
    return dims.map((dim) => {
      const valores = filtradas.map((e) => {
        const s = e.scores as ScoringResult;
        return s.dimensions.find((d) => d.code === dim)?.mean ?? 0;
      });
      const mean = valores.reduce((a, b) => a + b, 0) / valores.length;
      return {
        subject: { I: "Implicación", II: "Consistencia", III: "Adaptabilidad", IV: "Misión" }[dim],
        value: parseFloat(mean.toFixed(2)),
      };
    });
  }

  const globalProm = filtradas.length
    ? (filtradas.reduce((a, e) => a + (e.score_global ?? 0), 0) / filtradas.length).toFixed(2)
    : "-";

  async function exportarExcel() {
    const { utils, writeFile } = await import("xlsx");
    const filas = filtradas.map((e) => {
      const s = e.scores as ScoringResult;
      const row: Record<string, string | number> = {
        ID: e.id,
        Fecha: new Date(e.created_at).toLocaleDateString("es-EC"),
        Nombre: e.nombre,
        Cargo: e.cargo,
        "Área": e.area,
        Empresa: e.empresa,
        "Score Global": e.score_global ?? 0,
        Nivel: e.nivel ?? "",
      };
      s.dimensions.forEach((d) => { row[`Dim ${d.code} ${d.label}`] = d.mean; });
      s.subscales.forEach((sub) => { row[`${sub.code} ${sub.label}`] = sub.mean; });
      return row;
    });
    const ws = utils.json_to_sheet(filas);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Evaluaciones");
    writeFile(wb, `DOCS_Dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ─── Clima helpers ───────────────────────────────────────────────────────
  const [filtroAreaClima,  setFiltroAreaClima]  = useState("");
  const [filtroCargoClima, setFiltroCargoClima] = useState("");

  const areasClima  = [...new Set(climaData.map((r) => r.area).filter(Boolean))].sort() as string[];
  const cargosClima = [...new Set(climaData.map((r) => r.cargo).filter(Boolean))].sort() as string[];

  const climaFiltrada = climaData.filter((r) => {
    if (filtroAreaClima  && r.area  !== filtroAreaClima)  return false;
    if (filtroCargoClima && r.cargo !== filtroCargoClima) return false;
    return true;
  });

  function promedioOrgClima() {
    if (!climaFiltrada.length) return null;
    return CLIMA_DIM_CODES.map((code) => {
      const valores = climaFiltrada.map((r) => {
        const s = r.scores as ClimaResult;
        return s.dimensions.find((d) => d.code === code)?.mean ?? 0;
      });
      const mean = valores.reduce((a, b) => a + b, 0) / valores.length;
      return { subject: CLIMA_DIMENSIONS[code], value: parseFloat(mean.toFixed(2)) };
    });
  }

  const globalClima = climaFiltrada.length
    ? (climaFiltrada.reduce((a, r) => a + (r.score_global ?? 0), 0) / climaFiltrada.length).toFixed(2)
    : "-";

  async function exportarExcelClima() {
    const { utils, writeFile } = await import("xlsx");
    const filas = climaFiltrada.map((r) => {
      const s = r.scores as ClimaResult;
      const row: Record<string, string | number> = {
        Fecha:          new Date(r.created_at).toLocaleDateString("es-EC"),
        Nombre:         r.nombre  ?? "",
        Cargo:          r.cargo   ?? "",
        "Área":         r.area    ?? "",
        Empresa:        r.empresa ?? "",
        "Score Global": r.score_global ?? 0,
        Nivel:          r.nivel ?? "",
      };
      s.dimensions.forEach((d) => { row[d.label] = d.mean; });
      return row;
    });
    const ws = utils.json_to_sheet(filas);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Clima Laboral");
    writeFile(wb, `Clima_Dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const radarData      = promedioOrg();
  const radarDataClima = promedioOrgClima();

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "#f0f4f8" }}>

      {/* Header */}
      <header style={{ background: "#1a2035" }} className="py-4 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <span style={{ color: "#c9a84c" }} className="text-xl font-bold tracking-wide">MINDTALENT</span>
            <p className="text-white text-xs mt-0.5 opacity-70">Dashboard de Consultor</p>
          </div>
          <button
            onClick={() => { logout(); router.push("/admin"); }}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white border border-white border-opacity-30 hover:border-opacity-60 transition"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Tab switcher */}
      <div style={{ background: "#243447" }} className="px-6">
        <div className="max-w-6xl mx-auto flex gap-1 pt-3">
          {(["docs", "clima", "salud"] as Tab[]).map((tab) => {
            const labels: Record<Tab, string> = {
              docs:    "Cultura DOCS",
              clima:   "Clima Laboral",
              salud:   "Salud Organizacional",
              alertas: "Radar de Riesgo",
            };
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-all"
                style={{
                  background: isActive ? "#f0f4f8" : "transparent",
                  color:      isActive ? "#1a2035" : "#c9a84c",
                }}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* ══════════════════ TAB: CULTURA DOCS ═══════════════════════════════ */}
        {activeTab === "docs" && (
          <>
            {error && <p className="text-red-600 bg-red-50 rounded-lg px-4 py-3 text-sm">{error}</p>}

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Evaluados (muestra)", value: filtradas.length.toString() },
                { label: "Total en BD",         value: evaluaciones.length.toString() },
                { label: "Promedio Global",     value: globalProm },
                { label: "Último ingreso",      value: evaluaciones[0] ? new Date(evaluaciones[0].created_at).toLocaleDateString("es-EC") : "-" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-2xl shadow p-5 text-center">
                  <p className="text-2xl font-bold" style={{ color: "#1a2035" }}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-2xl shadow p-5 flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Filtrar por Área</label>
                <select
                  value={filtroArea}
                  onChange={(e) => setFiltroArea(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">Todas las áreas</option>
                  {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Filtrar por Cargo</label>
                <select
                  value={filtroCargo}
                  onChange={(e) => setFiltroCargo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">Todos los cargos</option>
                  {cargos.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {(filtroArea || filtroCargo) && (
                <button
                  onClick={() => { setFiltroArea(""); setFiltroCargo(""); }}
                  className="text-xs underline text-gray-500 self-end pb-2"
                >
                  Limpiar filtros
                </button>
              )}
              <div className="ml-auto self-end">
                <button
                  onClick={exportarExcel}
                  disabled={!filtradas.length}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: "#c9a84c", color: "#1a2035" }}
                >
                  Exportar Excel
                </button>
              </div>
            </div>

            {/* Radar organizacional */}
            {radarData && (
              <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="text-base font-bold mb-4" style={{ color: "#1a2035" }}>
                  Perfil Organizacional — Promedio de la muestra ({filtradas.length} evaluados)
                </h2>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#1a2035" }} />
                    <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 9 }} />
                    <Radar name="Org." dataKey="value" stroke="#1a2035" fill="#c9a84c" fillOpacity={0.55} />
                    <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabla de evaluados */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-base font-bold mb-4" style={{ color: "#1a2035" }}>
                Listado de Evaluados{filtradas.length !== evaluaciones.length && ` (${filtradas.length} de ${evaluaciones.length})`}
              </h2>

              {cargando ? (
                <div className="text-center py-10">
                  <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: "#1a2035", borderTopColor: "#c9a84c" }} />
                  <p className="text-gray-500 text-sm mt-3">Cargando...</p>
                </div>
              ) : filtradas.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">
                  {evaluaciones.length === 0 ? "Aún no hay evaluaciones registradas." : "Ningún evaluado coincide con los filtros."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#1a2035" }}>
                        {["Fecha", "Nombre", "Cargo", "Área", "Global", "Nivel", "Implicación", "Consistencia", "Adaptabilidad", "Misión", ""].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap" style={{ color: "#c9a84c" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtradas.map((e, i) => {
                        const s = e.scores as ScoringResult;
                        return (
                          <tr key={e.id} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                              {new Date(e.created_at).toLocaleDateString("es-EC")}
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{e.nombre}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{e.cargo}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{e.area}</td>
                            <td className="px-3 py-2 font-bold" style={{ color: getLevelColor(e.nivel ?? "") }}>
                              {(e.score_global ?? 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold whitespace-nowrap" style={{ color: getLevelColor(e.nivel ?? "") }}>
                              {e.nivel}
                            </td>
                            {s.dimensions.map((d) => (
                              <td key={d.code} className="px-3 py-2 text-center" style={{ color: getLevelColor(d.level) }}>
                                {d.mean.toFixed(2)}
                              </td>
                            ))}
                            <td className="px-3 py-2">
                              <a
                                href={`/resultados?id=${e.id}`}
                                className="text-xs underline whitespace-nowrap"
                                style={{ color: "#1a2035" }}
                              >
                                Ver informe
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════ TAB: CLIMA LABORAL ══════════════════════════════ */}
        {activeTab === "clima" && (
          <>
            {errorClima && <p className="text-red-600 bg-red-50 rounded-lg px-4 py-3 text-sm">{errorClima}</p>}

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Evaluados (muestra)", value: climaFiltrada.length.toString() },
                { label: "Total en BD",         value: climaData.length.toString() },
                { label: "Promedio Global",     value: globalClima },
                { label: "Último ingreso",      value: climaData[0] ? new Date(climaData[0].created_at).toLocaleDateString("es-EC") : "-" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-2xl shadow p-5 text-center">
                  <p className="text-2xl font-bold" style={{ color: "#1a2035" }}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-2xl shadow p-5 flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Filtrar por Área</label>
                <select
                  value={filtroAreaClima}
                  onChange={(e) => setFiltroAreaClima(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">Todas las áreas</option>
                  {areasClima.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Filtrar por Cargo</label>
                <select
                  value={filtroCargoClima}
                  onChange={(e) => setFiltroCargoClima(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">Todos los cargos</option>
                  {cargosClima.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {(filtroAreaClima || filtroCargoClima) && (
                <button
                  onClick={() => { setFiltroAreaClima(""); setFiltroCargoClima(""); }}
                  className="text-xs underline text-gray-500 self-end pb-2"
                >
                  Limpiar filtros
                </button>
              )}
              <div className="ml-auto self-end">
                <button
                  onClick={exportarExcelClima}
                  disabled={!climaFiltrada.length}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: "#c9a84c", color: "#1a2035" }}
                >
                  Exportar Excel
                </button>
              </div>
            </div>

            {/* Radar clima */}
            {radarDataClima && (
              <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="text-base font-bold mb-4" style={{ color: "#1a2035" }}>
                  Perfil de Clima Laboral — Promedio organizacional ({climaFiltrada.length} respuestas)
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarDataClima}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#1a2035" }} />
                    <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 9 }} />
                    <Radar name="Clima" dataKey="value" stroke="#1a2035" fill="#c9a84c" fillOpacity={0.55} />
                    <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabla evaluados clima */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-base font-bold mb-4" style={{ color: "#1a2035" }}>
                Listado de Evaluados{climaFiltrada.length !== climaData.length && ` (${climaFiltrada.length} de ${climaData.length})`}
              </h2>

              {cargandoClima ? (
                <div className="text-center py-10">
                  <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: "#1a2035", borderTopColor: "#c9a84c" }} />
                  <p className="text-gray-500 text-sm mt-3">Cargando...</p>
                </div>
              ) : climaFiltrada.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">
                  {climaData.length === 0 ? "Aún no hay respuestas de clima registradas." : "Ningún evaluado coincide con los filtros."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#1a2035" }}>
                        {["Fecha", "Nombre", "Cargo", "Área", "Global", "Nivel", "Liderazgo", "Comunicación", "Trabajo en Equipo", "Reconocimiento", "Condiciones", "Desarrollo"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap" style={{ color: "#c9a84c" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {climaFiltrada.map((r, i) => {
                        const s = r.scores as ClimaResult;
                        return (
                          <tr key={r.id} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                              {new Date(r.created_at).toLocaleDateString("es-EC")}
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{r.nombre ?? "—"}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.cargo ?? "—"}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.area ?? "—"}</td>
                            <td className="px-3 py-2 font-bold" style={{ color: getClimaLevelColor(r.nivel ?? "") }}>
                              {(r.score_global ?? 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold whitespace-nowrap" style={{ color: getClimaLevelColor(r.nivel ?? "") }}>
                              {r.nivel}
                            </td>
                            {s.dimensions.map((d) => (
                              <td key={d.code} className="px-3 py-2 text-center" style={{ color: getClimaLevelColor(d.level) }}>
                                {d.mean.toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════ TAB: SALUD ORGANIZACIONAL ═══════════════════════ */}
        {activeTab === "salud" && (
          <SaludOrganizacionalTab evaluaciones={evaluaciones} climaData={climaData} />
        )}

        {/* ══════════════════ TAB: RADAR DE RIESGO ════════════════════════════ */}
        {activeTab === "alertas" && (
          <RadarRiesgoTab evaluaciones={evaluaciones} climaData={climaData} />
        )}

      </main>
    </div>
  );
}

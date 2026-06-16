"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";
import {
  listarEvaluaciones, listarClima, eliminarEvaluacion, eliminarClima, listarSesiones, crearSesion, eliminarSesion,
  crear360Evaluado, crearTokens360,
  type Evaluacion, type ClimaRespuesta, type Sesion, type Evaluado360, type Token360,
} from "@/lib/supabase";
import { FUENTE_LABELS, type FuenteEvaluacion } from "@/lib/360-types";
import { getLevelColor } from "@/lib/scoring";
import { isAdmin, logout } from "@/lib/auth";
import type { ScoringResult } from "@/lib/scoring";
import { CLIMA_DIMENSIONS, type ClimaDimension } from "@/lib/clima-items";
import { getClimaLevelColor, type ClimaResult } from "@/lib/clima-scoring";
import SaludOrganizacionalTab from "@/components/SaludOrganizacionalTab";
import RadarRiesgoTab from "@/components/RadarRiesgoTab";
import Eval360DashboardPreview from "@/components/360/Eval360DashboardPreview";

type Tab = "docs" | "clima" | "salud" | "alertas" | "sesiones" | "eval360";

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

  // ─── Sesiones ────────────────────────────────────────────────────────────
  const [sesiones, setSesiones]               = useState<Sesion[]>([]);
  const [nuevaTipo, setNuevaTipo]             = useState<'cultura' | 'clima' | '360'>("cultura");
  const [nuevaEmpresa, setNuevaEmpresa]       = useState("");
  const [creandoSesion, setCreandoSesion]     = useState(false);
  const [linkCopiado, setLinkCopiado]         = useState<string | null>(null);

  // ─── 360° (generación de links desde el dashboard) ─────────────────────
  const [datos360, setDatos360] = useState({ nombre: "", cargo: "", departamento: "", jefe: "", periodo: "" });
  const [evaluados360, setEvaluados360] = useState<Array<{ evaluado: Evaluado360; empresa?: string; links: Array<{ fuente: FuenteEvaluacion; url: string }> }>>([]);
  const [expandido360, setExpandido360] = useState<string | null>(null);
  const [error360, setError360] = useState("");

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

    listarSesiones().then(setSesiones).catch(() => {});
  }, [router]);

  async function handleCrearSesion() {
    if (nuevaTipo === "360") return handleGenerar360();
    setCreandoSesion(true);
    try {
      const s = await crearSesion({ tipo: nuevaTipo, empresa: nuevaEmpresa || undefined });
      setSesiones((prev) => [s, ...prev]);
      setNuevaEmpresa("");
    } finally {
      setCreandoSesion(false);
    }
  }

  async function handleGenerar360() {
    if (!datos360.nombre || !datos360.cargo || !datos360.departamento || !datos360.periodo) {
      setError360("Completa nombre, cargo, departamento y período.");
      return;
    }
    setError360("");
    setCreandoSesion(true);
    try {
      const evaluado = await crear360Evaluado({
        nombre: datos360.nombre,
        cargo: datos360.cargo,
        departamento: datos360.departamento,
        jefe: datos360.jefe || undefined,
      });
      const fuentes: FuenteEvaluacion[] = ["autoevaluacion", "jefe", "par", "colaborador", "cliente_interno"];
      const tokens: Token360[] = await crearTokens360(evaluado.id, datos360.periodo, fuentes);
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const links = tokens.map((t) => ({ fuente: t.fuente, url: `${base}/evaluar-360/${t.token}` }));

      setEvaluados360((prev) => [{ evaluado, empresa: nuevaEmpresa || undefined, links }, ...prev]);
      setExpandido360(evaluado.id);
      setDatos360({ nombre: "", cargo: "", departamento: "", jefe: "", periodo: "" });
      setNuevaEmpresa("");
    } catch (e) {
      setError360(e instanceof Error ? e.message : "Error al generar los links de evaluación 360°");
    } finally {
      setCreandoSesion(false);
    }
  }

  function copiarLink360(url: string) {
    navigator.clipboard.writeText(url);
    setLinkCopiado(url);
    setTimeout(() => setLinkCopiado(null), 2000);
  }

  async function handleEliminarSesion(id: string) {
    await eliminarSesion(id);
    setSesiones((prev) => prev.filter((s) => s.id !== id));
  }

  function getLinkSesion(s: Sesion) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/eval?id=${s.id}`;
  }

  function copiarLink(s: Sesion) {
    navigator.clipboard.writeText(getLinkSesion(s));
    setLinkCopiado(s.id);
    setTimeout(() => setLinkCopiado(null), 2000);
  }

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

  // ─── Eliminar ────────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState<{ tipo: "docs" | "clima"; id: string; nombre: string } | null>(null);
  const [eliminando, setEliminando] = useState(false);

  async function handleEliminar() {
    if (!confirmDelete) return;
    setEliminando(true);
    try {
      if (confirmDelete.tipo === "docs") {
        await eliminarEvaluacion(confirmDelete.id);
        setEvaluaciones((prev) => prev.filter((e) => e.id !== confirmDelete.id));
      } else {
        await eliminarClima(confirmDelete.id);
        setClimaData((prev) => prev.filter((r) => r.id !== confirmDelete.id));
      }
      setConfirmDelete(null);
    } catch {
      alert("No se pudo eliminar el registro. Intenta de nuevo.");
    } finally {
      setEliminando(false);
    }
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
          {(["docs", "clima", "salud", "sesiones", "eval360"] as Tab[]).map((tab) => {
            const labels: Record<Tab, string> = {
              docs:     "Cultura DOCS",
              clima:    "Clima Laboral",
              salud:    "Salud Organizacional",
              alertas:  "Radar de Riesgo",
              sesiones: "Programar evaluaciones",
              eval360:  "Evaluación 360°",
            };
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-all"
                style={{
                  background: isActive ? (tab === "eval360" ? "#c9a84c" : "#f0f4f8") : "transparent",
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
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-gray-900"
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
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-gray-900"
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
                              <div className="flex items-center gap-3">
                                <a
                                  href={`/resultados?id=${e.id}`}
                                  className="text-xs underline whitespace-nowrap"
                                  style={{ color: "#1a2035" }}
                                >
                                  Ver informe
                                </a>
                                <button
                                  onClick={() => setConfirmDelete({ tipo: "docs", id: e.id, nombre: e.nombre })}
                                  className="text-xs text-red-500 hover:text-red-700 whitespace-nowrap transition-colors"
                                >
                                  Eliminar
                                </button>
                              </div>
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
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-gray-900"
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
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-gray-900"
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
                        {["Fecha", "Nombre", "Cargo", "Área", "Global", "Nivel", "Liderazgo", "Comunicación", "Trabajo en Equipo", "Reconocimiento", "Condiciones", "Desarrollo", ""].map((h) => (
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
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-3">
                                <a
                                  href={`/resultados-clima?id=${r.id}`}
                                  className="text-xs underline whitespace-nowrap"
                                  style={{ color: "#1a2035" }}
                                >
                                  Ver informe
                                </a>
                                <button
                                  onClick={() => setConfirmDelete({ tipo: "clima", id: r.id, nombre: r.nombre ?? "este registro" })}
                                  className="text-xs text-red-500 hover:text-red-700 whitespace-nowrap transition-colors"
                                >
                                  Eliminar
                                </button>
                              </div>
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

        {/* ══════════════════ TAB: SALUD ORGANIZACIONAL ═══════════════════════ */}
        {activeTab === "salud" && (
          <SaludOrganizacionalTab evaluaciones={evaluaciones} climaData={climaData} />
        )}

        {/* ══════════════════ TAB: RADAR DE RIESGO ════════════════════════════ */}
        {activeTab === "alertas" && (
          <RadarRiesgoTab evaluaciones={evaluaciones} climaData={climaData} />
        )}

        {/* ══════════════════ TAB: EVALUACIÓN 360° ════════════════════════════ */}
        {activeTab === "eval360" && <Eval360DashboardPreview />}

        {/* ══════════════════ TAB: PROGRAMAR EVALUACIONES ═════════════════════ */}
        {activeTab === "sesiones" && (
          <>
            {/* Crear nueva sesión */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-base font-bold mb-4" style={{ color: "#1a2035" }}>Nueva sesión de evaluación</h2>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                  <select
                    value={nuevaTipo}
                    onChange={(e) => setNuevaTipo(e.target.value as 'cultura' | 'clima' | '360')}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-gray-900"
                  >
                    <option value="cultura">Cultura DOCS</option>
                    <option value="clima">Clima Laboral</option>
                    <option value="360">Evaluación 360°</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Empresa (opcional)</label>
                  <input
                    type="text"
                    value={nuevaEmpresa}
                    onChange={(e) => setNuevaEmpresa(e.target.value)}
                    placeholder="Nombre de la empresa"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none w-56"
                  />
                </div>

                {nuevaTipo === "360" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del evaluado *</label>
                      <input
                        type="text"
                        value={datos360.nombre}
                        onChange={(e) => setDatos360((p) => ({ ...p, nombre: e.target.value }))}
                        placeholder="Nombre completo"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none w-48 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Cargo *</label>
                      <input
                        type="text"
                        value={datos360.cargo}
                        onChange={(e) => setDatos360((p) => ({ ...p, cargo: e.target.value }))}
                        placeholder="Cargo"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none w-40 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Departamento *</label>
                      <input
                        type="text"
                        value={datos360.departamento}
                        onChange={(e) => setDatos360((p) => ({ ...p, departamento: e.target.value }))}
                        placeholder="Departamento"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none w-40 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Jefe directo</label>
                      <input
                        type="text"
                        value={datos360.jefe}
                        onChange={(e) => setDatos360((p) => ({ ...p, jefe: e.target.value }))}
                        placeholder="Opcional"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none w-36 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Período *</label>
                      <input
                        type="text"
                        value={datos360.periodo}
                        onChange={(e) => setDatos360((p) => ({ ...p, periodo: e.target.value }))}
                        placeholder="ej: 2026-S1"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none w-32 text-gray-900"
                      />
                    </div>
                  </>
                )}

                <button
                  onClick={handleCrearSesion}
                  disabled={creandoSesion}
                  className="px-5 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: "#1a2035", color: "#c9a84c" }}
                >
                  {creandoSesion ? "Creando..." : "Generar link"}
                </button>
              </div>
              {nuevaTipo === "360" && error360 && (
                <p className="text-xs text-red-600 mt-3">{error360}</p>
              )}
              {nuevaTipo === "360" && (
                <p className="text-xs text-gray-400 mt-3">
                  Se generarán 5 links independientes (autoevaluación, jefe, par, colaborador, cliente interno) para que cada evaluador responda sin ver las respuestas de los demás.
                </p>
              )}
            </div>

            {/* Evaluaciones 360° generadas */}
            {evaluados360.length > 0 && (
              <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="text-base font-bold mb-4" style={{ color: "#1a2035" }}>
                  Evaluaciones 360° generadas ({evaluados360.length})
                </h2>
                <div className="space-y-3">
                  {evaluados360.map(({ evaluado, empresa, links }) => (
                    <div key={evaluado.id} className="border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandido360(expandido360 === evaluado.id ? null : evaluado.id)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                      >
                        <div>
                          <span className="font-semibold text-sm" style={{ color: "#1a2035" }}>{evaluado.nombre}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {evaluado.cargo} · {evaluado.departamento}{empresa ? ` · ${empresa}` : ""}
                          </span>
                        </div>
                        <span className="text-gray-400 text-xs">{expandido360 === evaluado.id ? "▲" : "▼ ver 5 links"}</span>
                      </button>
                      {expandido360 === evaluado.id && (
                        <div className="border-t border-gray-200 px-4 py-3 space-y-2 bg-gray-50">
                          {links.map((l) => (
                            <div key={l.fuente} className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-gray-700">{FUENTE_LABELS[l.fuente]}</span>
                                <p className="text-xs text-gray-400 truncate max-w-md">{l.url}</p>
                              </div>
                              <button
                                onClick={() => copiarLink360(l.url)}
                                className="text-xs font-semibold whitespace-nowrap px-2 py-1 rounded transition-colors shrink-0"
                                style={{ background: linkCopiado === l.url ? "#c9a84c" : "#fff", color: "#1a2035", border: "1px solid #e5e7eb" }}
                              >
                                {linkCopiado === l.url ? "Copiado" : "Copiar"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Listado de sesiones */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-base font-bold mb-4" style={{ color: "#1a2035" }}>
                Sesiones creadas ({sesiones.length})
              </h2>
              {sesiones.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">No hay sesiones creadas aún.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#1a2035" }}>
                        {["Fecha", "Tipo", "Empresa", "Estado", "Link de participante", ""].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap" style={{ color: "#c9a84c" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sesiones.map((s, i) => (
                        <tr key={s.id} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                          <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                            {new Date(s.created_at).toLocaleDateString("es-EC")}
                          </td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "#1a2035" }}>
                            {s.tipo === "cultura" ? "Cultura DOCS" : s.tipo === "clima" ? "Clima Laboral" : "Salud"}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{s.empresa ?? "—"}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.estado === "completada" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                              {s.estado === "completada" ? "Completada" : "Pendiente"}
                            </span>
                          </td>
                          <td className="px-3 py-2 max-w-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 truncate">{getLinkSesion(s)}</span>
                              <button
                                onClick={() => copiarLink(s)}
                                className="text-xs font-semibold whitespace-nowrap px-2 py-1 rounded transition-colors"
                                style={{ background: linkCopiado === s.id ? "#c9a84c" : "#f0f4f8", color: "#1a2035" }}
                              >
                                {linkCopiado === s.id ? "Copiado" : "Copiar"}
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => handleEliminarSesion(s.id)}
                              className="text-xs text-red-500 hover:text-red-700 transition-colors"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

      </main>

      {/* ── Modal de confirmación de eliminación ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-base font-bold mb-2" style={{ color: "#1a2035" }}>
              ¿Eliminar registro?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Vas a eliminar el registro de <span className="font-semibold text-gray-800">{confirmDelete.nombre}</span>.
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={eliminando}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminar}
                disabled={eliminando}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: "#dc2626" }}
              >
                {eliminando ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

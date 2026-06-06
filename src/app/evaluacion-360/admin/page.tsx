"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listar360Evaluados, listarTodas360Evaluaciones } from "@/lib/supabase";
import {
  calcularPuntaje360,
  calcularPotencial,
  determinarCuadrante,
  clasificarNivelDesempeno,
  calcularBrechas,
} from "@/lib/360-scoring";
import type { ResultadoConsolidado360 } from "@/lib/360-types";
import { isAdmin } from "@/lib/auth";
import NineBoxMatrix from "@/components/360/NineBoxMatrix";

export default function Admin360Page() {
  const router = useRouter();
  const [resultados, setResultados] = useState<ResultadoConsolidado360[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroDpto, setFiltroDpto] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("");
  const [filtroNivel, setFiltroNivel] = useState("");

  useEffect(() => {
    if (!isAdmin()) { router.replace("/admin"); return; }

    async function cargar() {
      try {
        const [evaluados, todasEval] = await Promise.all([
          listar360Evaluados(),
          listarTodas360Evaluaciones(),
        ]);
        const res: ResultadoConsolidado360[] = [];
        for (const ev of evaluados) {
          const evs = todasEval.filter((e) => e.evaluado_id === ev.id);
          if (evs.length === 0) continue;
          const { puntajesPorCompetencia, puntaje360 } = calcularPuntaje360(evs);
          const { nivel: nivelDesempeno, color: colorDesempeno } = clasificarNivelDesempeno(puntaje360);
          const jefeEv = evs.find((e) => e.fuente === "jefe");
          const { puntaje: puntajePotencial, nivel: nivelPotencial } = jefeEv?.potencial
            ? calcularPotencial(jefeEv.potencial)
            : { puntaje: 0, nivel: "MEDIO" as const };
          const cuadranteInfo = determinarCuadrante(nivelDesempeno, nivelPotencial);
          const brechas = calcularBrechas(puntajesPorCompetencia);
          res.push({
            evaluado: ev,
            periodo: evs[0]?.periodo ?? "",
            puntaje360, nivelDesempeno, colorDesempeno,
            puntajePotencial, nivelPotencial,
            cuadrante: cuadranteInfo.numero,
            nombreCuadrante: cuadranteInfo.nombre,
            accionCuadrante: cuadranteInfo.accion,
            colorCuadrante: cuadranteInfo.colorFondo,
            puntajesPorCompetencia, brechas,
            evaluaciones: evs,
          });
        }
        setResultados(res);
      } catch {
        // estado vacío
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [router]);

  const dptos   = [...new Set(resultados.map((r) => r.evaluado.departamento))].sort();
  const periodos = [...new Set(resultados.map((r) => r.periodo))].sort();
  const niveles  = [...new Set(resultados.map((r) => r.nivelDesempeno))].sort();

  const filtrados = resultados.filter((r) => {
    if (filtroDpto    && r.evaluado.departamento !== filtroDpto)    return false;
    if (filtroPeriodo && r.periodo               !== filtroPeriodo) return false;
    if (filtroNivel   && r.nivelDesempeno         !== filtroNivel)  return false;
    return true;
  });

  const zonaVerde = filtrados.filter((r) => [6, 8, 9].includes(r.cuadrante)).length;
  const zonaRoja  = filtrados.filter((r) => [1, 2].includes(r.cuadrante)).length;
  const promOrg   = filtrados.length
    ? filtrados.reduce((s, r) => s + r.puntaje360, 0) / filtrados.length
    : 0;

  const nineBoxData = filtrados.map((r) => ({
    nombre:    r.evaluado.nombre,
    cuadrante: r.cuadrante,
    puntaje360: r.puntaje360,
    potencial: r.puntajePotencial,
  }));

  async function exportarCSV() {
    const filas = [
      ["Nombre", "Cargo", "Departamento", "Período", "360°", "Nivel desempeño", "Potencial", "Nivel potencial", "Cuadrante", "Nombre cuadrante"],
      ...filtrados.map((r) => [
        r.evaluado.nombre,
        r.evaluado.cargo,
        r.evaluado.departamento,
        r.periodo,
        r.puntaje360.toFixed(2),
        r.nivelDesempeno,
        r.puntajePotencial.toFixed(2),
        r.nivelPotencial,
        r.cuadrante.toString(),
        r.nombreCuadrante,
      ]),
    ];
    const csv = filas.map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `360_Admin_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#1a2035" }}>
      {/* Header */}
      <div className="border-b border-[#2d3a50] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Admin — Evaluación 360°</h1>
            <p className="text-xs text-gray-400 mt-0.5">Panel completo de gestión · MINDTALENT</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/evaluacion-360" className="text-sm text-gray-400 hover:text-white transition-colors">
              ← Módulo 360°
            </Link>
            <Link
              href="/evaluacion-360/nueva"
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: "#c9a84c", color: "#1a2035" }}
            >
              ➕ Nueva Evaluación
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total evaluados",    value: filtrados.length,  color: "#2dd4bf" },
            { label: "% Zona verde (6,8,9)", value: `${filtrados.length ? Math.round(zonaVerde / filtrados.length * 100) : 0}%`, color: "#22c55e" },
            { label: "% Zona roja (1,2)",  value: `${filtrados.length ? Math.round(zonaRoja  / filtrados.length * 100) : 0}%`, color: "#ef4444" },
            { label: "Promedio org 360°",  value: promOrg.toFixed(2), color: "#c9a84c" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-[#1e2a42] rounded-xl p-4 border border-[#2d3a50]">
              <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
              <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros + export */}
        <div className="bg-[#1e2a42] rounded-xl p-4 border border-[#2d3a50] flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 font-semibold uppercase tracking-wide">Departamento</label>
            <select
              value={filtroDpto}
              onChange={(e) => setFiltroDpto(e.target.value)}
              className="bg-[#162032] border border-[#2d3a50] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf]"
            >
              <option value="">Todos</option>
              {dptos.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 font-semibold uppercase tracking-wide">Período</label>
            <select
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value)}
              className="bg-[#162032] border border-[#2d3a50] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf]"
            >
              <option value="">Todos</option>
              {periodos.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 font-semibold uppercase tracking-wide">Nivel desempeño</label>
            <select
              value={filtroNivel}
              onChange={(e) => setFiltroNivel(e.target.value)}
              className="bg-[#162032] border border-[#2d3a50] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf]"
            >
              <option value="">Todos</option>
              {niveles.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {(filtroDpto || filtroPeriodo || filtroNivel) && (
            <button
              onClick={() => { setFiltroDpto(""); setFiltroPeriodo(""); setFiltroNivel(""); }}
              className="text-xs text-gray-400 hover:text-white underline self-end pb-2 transition-colors"
            >
              Limpiar
            </button>
          )}
          <div className="ml-auto self-end">
            <button
              onClick={exportarCSV}
              disabled={!filtrados.length}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: "#c9a84c", color: "#1a2035" }}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Nine Box organizacional */}
        {filtrados.length > 0 && (
          <div className="bg-[#1e2a42] rounded-xl p-5 border border-[#2d3a50]">
            <h2 className="text-white font-semibold mb-4 text-sm">Matriz Nine Box organizacional ({filtrados.length} evaluados)</h2>
            <NineBoxMatrix
              colaboradores={nineBoxData}
              onSelect={(nombre) => {
                const r = filtrados.find((x) => x.evaluado.nombre === nombre);
                if (r) router.push(`/evaluacion-360/${r.evaluado.id}`);
              }}
            />
          </div>
        )}

        {/* Tabla completa */}
        <div className="bg-[#1e2a42] rounded-xl border border-[#2d3a50] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2d3a50]">
            <h2 className="text-white font-semibold text-sm">
              Listado completo{filtrados.length !== resultados.length && ` (${filtrados.length} de ${resultados.length})`}
            </h2>
          </div>

          {cargando ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: "#2d3a50", borderTopColor: "#c9a84c" }} />
              <p className="text-gray-400 text-sm mt-3">Cargando…</p>
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-center text-gray-500 py-12 text-sm">
              {resultados.length === 0 ? "No hay evaluados registrados." : "Ningún evaluado coincide con los filtros."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2d3a50]">
                    {["Nombre", "Cargo", "Departamento", "Período", "360°", "Potencial", "Nivel", "Cuadrante", ""].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-400 px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((r) => (
                    <tr
                      key={r.evaluado.id}
                      className="border-b border-[#2d3a50]/50 hover:bg-[#243447] cursor-pointer transition-colors"
                      onClick={() => router.push(`/evaluacion-360/${r.evaluado.id}`)}
                    >
                      <td className="px-4 py-3 text-white text-sm font-medium whitespace-nowrap">{r.evaluado.nombre}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm whitespace-nowrap">{r.evaluado.cargo}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm whitespace-nowrap">{r.evaluado.departamento}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">{r.periodo}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold text-sm" style={{ color: r.colorDesempeno }}>
                          {r.puntaje360.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{r.puntajePotencial.toFixed(2)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-semibold" style={{ color: r.colorDesempeno }}>{r.nivelDesempeno}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: r.colorCuadrante, color: "#1a2035" }}
                        >
                          {r.cuadrante} · {r.nombreCuadrante}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[#c9a84c] text-xs">Ver →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listar360Evaluados, listarTodas360Evaluaciones, listarTokens360PorEvaluado, type Evaluado360 } from "@/lib/supabase";
import {
  calcularPuntaje360, calcularPotencial, determinarCuadrante,
  clasificarNivelDesempeno, calcularBrechas,
} from "@/lib/360-scoring";
import type { ResultadoConsolidado360 } from "@/lib/360-types";
import NineBoxMatrix from "@/components/360/NineBoxMatrix";
import { useAuthGuard } from "@/lib/useAuthGuard";

export default function Evaluacion360Page() {
  const router = useRouter();
  const { verificando } = useAuthGuard();
  const [resultados, setResultados] = useState<ResultadoConsolidado360[]>([]);
  const [pendientes, setPendientes] = useState<Array<{ evaluado: Evaluado360; completados: number; total: number }>>([]);
  const [cargando, setCargando]     = useState(true);
  const [filtroDpto, setFiltroDpto] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("");

  useEffect(() => {
    async function cargar() {
      try {
        const [evaluados, todasEval] = await Promise.all([
          listar360Evaluados(),
          listarTodas360Evaluaciones(),
        ]);
        const res: ResultadoConsolidado360[] = [];
        const pend: Array<{ evaluado: Evaluado360; completados: number; total: number }> = [];
        for (const ev of evaluados) {
          const evs = todasEval.filter((e) => e.evaluado_id === ev.id);
          if (evs.length === 0) {
            const tokens = await listarTokens360PorEvaluado(ev.id).catch(() => []);
            if (tokens.length > 0) {
              pend.push({ evaluado: ev, completados: tokens.filter((t) => t.completado).length, total: tokens.length });
            }
            continue;
          }
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
        setPendientes(pend);
      } catch {
        // estado vacío
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  const dptos = [...new Set(resultados.map((r) => r.evaluado.departamento))];
  const periodos = [...new Set(resultados.map((r) => r.periodo))];
  const empresas = [...new Set([...resultados.map((r) => r.evaluado.empresa), ...pendientes.map((p) => p.evaluado.empresa)].filter((e): e is string => Boolean(e)))];

  const filtrados = resultados
    .filter((r) => {
      if (filtroDpto && r.evaluado.departamento !== filtroDpto) return false;
      if (filtroPeriodo && r.periodo !== filtroPeriodo) return false;
      if (filtroEmpresa && r.evaluado.empresa !== filtroEmpresa) return false;
      return true;
    })
    .sort((a, b) => (a.evaluado.empresa ?? "").localeCompare(b.evaluado.empresa ?? "") || a.evaluado.nombre.localeCompare(b.evaluado.nombre));

  const pendientesFiltrados = pendientes
    .filter((p) => {
      if (filtroDpto && p.evaluado.departamento !== filtroDpto) return false;
      if (filtroEmpresa && p.evaluado.empresa !== filtroEmpresa) return false;
      return true;
    })
    .sort((a, b) => (a.evaluado.empresa ?? "").localeCompare(b.evaluado.empresa ?? "") || a.evaluado.nombre.localeCompare(b.evaluado.nombre));

  const zonaVerde = filtrados.filter((r) => [6, 8, 9].includes(r.cuadrante)).length;
  const zonaRoja  = filtrados.filter((r) => [1, 2].includes(r.cuadrante)).length;
  const promOrg   = filtrados.length
    ? filtrados.reduce((s, r) => s + r.puntaje360, 0) / filtrados.length
    : 0;

  const nineBoxData = filtrados.map((r) => ({
    nombre: r.evaluado.nombre,
    cuadrante: r.cuadrante,
    puntaje360: r.puntaje360,
    potencial: r.puntajePotencial,
  }));

  if (verificando) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A1A32" }}>
      {/* Header */}
      <div className="border-b border-[#2d3a50] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Evaluación 360° + Nine Box</h1>
          <p className="text-xs text-gray-400 mt-0.5">Módulo de desempeño y potencial — MINDTALENT</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Dashboard
          </Link>
          <Link
            href="/evaluacion-360/nueva"
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: "#10b981", color: "#0A1A32" }}
          >
            ➕ Nueva Evaluación
          </Link>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total evaluados", value: filtrados.length, color: "#2dd4bf" },
            { label: "% Zona verde", value: `${filtrados.length ? Math.round(zonaVerde / filtrados.length * 100) : 0}%`, color: "#10b981" },
            { label: "% Zona roja", value: `${filtrados.length ? Math.round(zonaRoja / filtrados.length * 100) : 0}%`, color: "#ef4444" },
            { label: "Promedio org 360°", value: promOrg.toFixed(2), color: "#10b981" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-[#1e2a42] rounded-xl p-4 border border-[#2d3a50]">
              <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
              <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <select
            value={filtroEmpresa}
            onChange={(e) => setFiltroEmpresa(e.target.value)}
            className="bg-[#1e2a42] border border-[#2d3a50] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf]"
          >
            <option value="">Todas las empresas</option>
            {empresas.map((emp) => <option key={emp} value={emp}>{emp}</option>)}
          </select>
          <select
            value={filtroDpto}
            onChange={(e) => setFiltroDpto(e.target.value)}
            className="bg-[#1e2a42] border border-[#2d3a50] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf]"
          >
            <option value="">Todos los departamentos</option>
            {dptos.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
            className="bg-[#1e2a42] border border-[#2d3a50] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf]"
          >
            <option value="">Todos los períodos</option>
            {periodos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {cargando ? (
          <div className="text-center py-16 text-gray-400">Cargando evaluaciones…</div>
        ) : filtrados.length === 0 && pendientesFiltrados.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">No hay evaluados registrados.</p>
            <Link href="/evaluacion-360/nueva" className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: "#10b981", color: "#0A1A32" }}>
              Registrar primer evaluado
            </Link>
          </div>
        ) : filtrados.length > 0 ? (
          <>
            {/* Nine Box */}
            <div className="bg-[#1e2a42] rounded-xl p-6 border border-[#2d3a50]">
              <h2 className="text-white font-semibold mb-4">Matriz Nine Box</h2>
              <NineBoxMatrix
                colaboradores={nineBoxData}
                onSelect={(nombre) => {
                  const r = filtrados.find((x) => x.evaluado.nombre === nombre);
                  if (r) router.push(`/evaluacion-360/${r.evaluado.id}`);
                }}
              />
            </div>

            {/* Tabla */}
            <div className="bg-[#1e2a42] rounded-xl border border-[#2d3a50] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2d3a50]">
                    {["Nombre", "Empresa", "Cargo", "Depto", "360°", "Potencial", "Cuadrante", ""].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-400 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((r) => (
                    <tr
                      key={r.evaluado.id}
                      className="border-b border-[#2d3a50]/50 hover:bg-[#1E2D5A] cursor-pointer transition-colors"
                      onClick={() => router.push(`/evaluacion-360/${r.evaluado.id}`)}
                    >
                      <td className="px-4 py-3 text-white text-sm font-medium">{r.evaluado.nombre}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{r.evaluado.empresa ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{r.evaluado.cargo}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{r.evaluado.departamento}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-sm" style={{ color: r.colorDesempeno }}>
                          {r.puntaje360.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{r.puntajePotencial.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: r.colorCuadrante, color: "#0A1A32" }}>
                          {r.cuadrante} · {r.nombreCuadrante}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[#10b981] text-xs">Ver →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {/* Pendientes (sin respuestas aún) */}
        {pendientesFiltrados.length > 0 && (
          <div className="bg-[#1e2a42] rounded-xl border border-[#2d3a50] overflow-hidden">
            <h2 className="text-white font-semibold px-4 pt-4 pb-2">
              ⏳ Evaluaciones en proceso ({pendientesFiltrados.length})
            </h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2d3a50]">
                  {["Nombre", "Empresa", "Cargo", "Depto", "Avance", ""].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendientesFiltrados.map((p) => (
                  <tr
                    key={p.evaluado.id}
                    className="border-b border-[#2d3a50]/50 hover:bg-[#1E2D5A] cursor-pointer transition-colors"
                    onClick={() => router.push(`/evaluacion-360/${p.evaluado.id}`)}
                  >
                    <td className="px-4 py-3 text-white text-sm font-medium">{p.evaluado.nombre}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{p.evaluado.empresa ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{p.evaluado.cargo}</td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{p.evaluado.departamento}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: p.completados === p.total ? "#10b981" : "#9ca3af" }}>
                      {p.completados}/{p.total} respondidos
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[#10b981] text-xs">Ver →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

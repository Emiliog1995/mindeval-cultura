"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listar360Evaluados, listarTodas360Evaluaciones } from "@/lib/supabase";
import { calcularPuntaje360, calcularPotencial, determinarCuadrante, clasificarNivelDesempeno, calcularBrechas } from "@/lib/360-scoring";
import type { ResultadoConsolidado360 } from "@/lib/360-types";
import { COMPETENCIAS_360 } from "@/lib/360-types";
import NineBoxMatrix from "./NineBoxMatrix";

export default function Eval360DashboardPreview() {
  const [resultados, setResultados] = useState<ResultadoConsolidado360[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
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
            puntaje360,
            nivelDesempeno,
            colorDesempeno,
            puntajePotencial,
            nivelPotencial,
            cuadrante: cuadranteInfo.numero,
            nombreCuadrante: cuadranteInfo.nombre,
            accionCuadrante: cuadranteInfo.accion,
            colorCuadrante: cuadranteInfo.colorFondo,
            puntajesPorCompetencia,
            brechas,
            evaluaciones: evs,
          });
        }
        setResultados(res);
      } catch {
        // silencioso — estado vacío
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  const zonaVerde = resultados.filter((r) => [6, 8, 9].includes(r.cuadrante)).length;
  const zonaRoja  = resultados.filter((r) => [1, 2].includes(r.cuadrante)).length;
  const promOrg   = resultados.length
    ? resultados.reduce((s, r) => s + r.puntaje360, 0) / resultados.length
    : 0;

  const mayorBrecha = resultados.length
    ? COMPETENCIAS_360.map((comp) => ({
        label: comp.label,
        brecha: resultados.reduce((s, r) => {
          const b = r.brechas.find((x) => x.key === comp.key);
          return s + (b?.brecha ?? 0);
        }, 0) / resultados.length,
      })).sort((a, b) => b.brecha - a.brecha)[0]
    : null;

  const nineBoxData = resultados.map((r) => ({
    nombre: r.evaluado.nombre,
    cuadrante: r.cuadrante,
    puntaje360: r.puntaje360,
    potencial: r.puntajePotencial,
  }));

  if (cargando) {
    return <div className="text-gray-400 text-sm py-8 text-center">Cargando datos 360°…</div>;
  }

  if (resultados.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">No hay evaluados registrados aún.</p>
        <Link
          href="/evaluacion-360/nueva"
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: "#c9a84c", color: "#1a2035" }}
        >
          Registrar primer evaluado
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total evaluados", value: resultados.length, color: "#2dd4bf" },
          { label: "Zona verde (6,8,9)", value: `${resultados.length ? Math.round(zonaVerde / resultados.length * 100) : 0}%`, color: "#22c55e" },
          { label: "Zona roja (1,2)", value: `${resultados.length ? Math.round(zonaRoja / resultados.length * 100) : 0}%`, color: "#ef4444" },
          { label: "Promedio org 360°", value: promOrg.toFixed(2), color: "#c9a84c" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#1e2a42] rounded-xl p-4 border border-[#2d3a50]">
            <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Nine Box resumido */}
      <div className="bg-[#1e2a42] rounded-xl p-4 border border-[#2d3a50]">
        <h4 className="text-white font-semibold mb-3">Matriz Nine Box organizacional</h4>
        <NineBoxMatrix colaboradores={nineBoxData} />
      </div>

      {/* Mayor brecha */}
      {mayorBrecha && (
        <div className="bg-[#1e2a42] rounded-xl p-4 border border-[#2d3a50] flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Competencia con mayor brecha organizacional</p>
            <p className="text-white font-semibold">{mayorBrecha.label}</p>
          </div>
          <span className="text-xl font-bold text-red-400">−{mayorBrecha.brecha.toFixed(2)}</span>
        </div>
      )}

      <div className="text-right">
        <Link
          href="/evaluacion-360"
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: "#c9a84c", color: "#1a2035" }}
        >
          Ver módulo completo →
        </Link>
      </div>
    </div>
  );
}

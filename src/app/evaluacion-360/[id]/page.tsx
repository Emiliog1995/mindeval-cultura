"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  obtener360Evaluado,
  listar360Evaluaciones,
  obtener360Pdi,
  listarTokens360PorEvaluado,
  type Pdi360,
  type Token360,
} from "@/lib/supabase";
import {
  calcularPuntaje360,
  calcularPotencial,
  determinarCuadrante,
  clasificarNivelDesempeno,
  calcularBrechas,
} from "@/lib/360-scoring";
import type { ResultadoConsolidado360 } from "@/lib/360-types";
import { COMPETENCIAS_360, FUENTE_LABELS } from "@/lib/360-types";
import RadarChart360 from "@/components/360/RadarChart360";
import BrechasChart from "@/components/360/BrechasChart";
import NineBoxMatrix from "@/components/360/NineBoxMatrix";
import ClaudeNarrativa360 from "@/components/360/ClaudeNarrativa360";
import PDIForm from "@/components/360/PDIForm";
import ExportPDF360 from "@/components/360/ExportPDF360";
import { useAuthGuard } from "@/lib/useAuthGuard";

export default function EvaluadoIndividualPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { verificando } = useAuthGuard();

  const [resultado, setResultado] = useState<ResultadoConsolidado360 | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [narrativa, setNarrativa] = useState("");
  const [tokens, setTokens] = useState<Token360[]>([]);
  const [evaluadoPendiente, setEvaluadoPendiente] = useState<{ nombre: string; cargo: string; departamento: string } | null>(null);
  const radarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const [evaluado, evaluaciones] = await Promise.all([
          obtener360Evaluado(id),
          listar360Evaluaciones(id),
        ]);

        if (!evaluaciones.length) {
          const todosTokens = await listarTokens360PorEvaluado(id).catch(() => []);
          setTokens(todosTokens);
          setEvaluadoPendiente({ nombre: evaluado.nombre, cargo: evaluado.cargo, departamento: evaluado.departamento });
          return;
        }

        const { puntajesPorCompetencia, puntaje360 } = calcularPuntaje360(evaluaciones);
        const { nivel: nivelDesempeno, color: colorDesempeno } = clasificarNivelDesempeno(puntaje360);
        const jefeEv = evaluaciones.find((e) => e.fuente === "jefe");
        const { puntaje: puntajePotencial, nivel: nivelPotencial } = jefeEv?.potencial
          ? calcularPotencial(jefeEv.potencial)
          : { puntaje: 0, nivel: "MEDIO" as const };
        const cuadranteInfo = determinarCuadrante(nivelDesempeno, nivelPotencial);
        const brechas = calcularBrechas(puntajesPorCompetencia);
        const periodo = evaluaciones[0]?.periodo ?? "";
        const pdi = await obtener360Pdi(id, periodo);

        setResultado({
          evaluado,
          periodo,
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
          evaluaciones,
          pdi: pdi ?? undefined,
        });
      } catch {
        setError("No se pudo cargar la información del evaluado.");
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [id]);

  if (verificando) return null;

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#1a2035" }}>
        <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: "#2d3a50", borderTopColor: "#c9a84c" }} />
      </div>
    );
  }

  if (evaluadoPendiente) {
    return (
      <div className="min-h-screen px-6 py-10" style={{ backgroundColor: "#1a2035" }}>
        <div className="max-w-2xl mx-auto space-y-4">
          <Link href="/evaluacion-360" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Volver al listado
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">{evaluadoPendiente.nombre}</h1>
            <p className="text-xs text-gray-400">{evaluadoPendiente.cargo} · {evaluadoPendiente.departamento}</p>
          </div>

          <div className="bg-[#1e2a42] rounded-xl p-4 border border-[#2d3a50]">
            <p className="text-white text-sm font-semibold mb-1">⏳ Evaluación en proceso</p>
            <p className="text-gray-400 text-xs">
              Aún no hay respuestas registradas. El resultado se calculará automáticamente cuando los evaluadores
              completen sus formularios.
            </p>
          </div>

          {tokens.length > 0 ? (
            <div className="space-y-2">
              {tokens.map((t) => (
                <div key={t.id} className="bg-[#1e2a42] rounded-xl border border-[#2d3a50] px-4 py-3 flex items-center justify-between">
                  <span className="text-white text-sm">{FUENTE_LABELS[t.fuente]}</span>
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: t.completado ? "#22c55e22" : "#9ca3af22",
                      color: t.completado ? "#22c55e" : "#9ca3af",
                    }}
                  >
                    {t.completado ? "✅ Completado" : "⏳ Pendiente"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No se generaron links para este evaluado.</p>
          )}
        </div>
      </div>
    );
  }

  if (error || !resultado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: "#1a2035" }}>
        <p className="text-red-400 text-sm">{error || "Evaluado no encontrado."}</p>
        <Link href="/evaluacion-360" className="text-sm text-gray-400 hover:text-white transition-colors">
          ← Volver al listado
        </Link>
      </div>
    );
  }

  const { evaluado, periodo, puntaje360, nivelDesempeno, colorDesempeno,
          puntajePotencial, nivelPotencial, cuadrante, nombreCuadrante,
          accionCuadrante, colorCuadrante, puntajesPorCompetencia, brechas } = resultado;

  const radarData = COMPETENCIAS_360.map((c) => ({
    competencia: c.label,
    actual: parseFloat((puntajesPorCompetencia[c.key] ?? 0).toFixed(2)),
    meta: c.meta,
  }));

  const nineBoxData = [{
    nombre: evaluado.nombre,
    cuadrante,
    puntaje360,
    potencial: puntajePotencial,
  }];

  // Agrupar evaluaciones por fuente para tabla de detalle
  const porFuente = resultado.evaluaciones.reduce<Record<string, number[]>>((acc, ev) => {
    const label = FUENTE_LABELS[ev.fuente] ?? ev.fuente;
    if (!acc[label]) acc[label] = [];
    acc[label].push(ev.puntaje_total ?? 0);
    return acc;
  }, {});

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#1a2035" }}>
      {/* Header */}
      <div className="border-b border-[#2d3a50] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              ←
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">{evaluado.nombre}</h1>
              <p className="text-xs text-gray-400">
                {evaluado.cargo} · {evaluado.departamento}
                {evaluado.jefe && ` · Jefe: ${evaluado.jefe}`}
                {periodo && ` · Período: ${periodo}`}
              </p>
            </div>
          </div>
          <ExportPDF360 resultado={resultado} narrativa={narrativa} radarRef={radarRef} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Puntaje 360°", value: puntaje360.toFixed(2), color: colorDesempeno },
            { label: "Nivel desempeño", value: nivelDesempeno, color: colorDesempeno },
            { label: "Puntaje potencial", value: puntajePotencial.toFixed(2), color: "#2dd4bf" },
            { label: "Nivel potencial", value: nivelPotencial, color: "#2dd4bf" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-[#1e2a42] rounded-xl p-4 border border-[#2d3a50]">
              <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
              <p className="text-lg font-bold leading-tight" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Cuadrante Nine Box */}
        <div
          className="rounded-xl px-5 py-4 border border-[#2d3a50] flex items-center justify-between"
          style={{ backgroundColor: colorCuadrante + "22", borderColor: colorCuadrante + "55" }}
        >
          <div>
            <p className="text-xs text-gray-400">Cuadrante Nine Box</p>
            <p className="text-white font-bold text-base">{cuadrante} · {nombreCuadrante}</p>
            <p className="text-sm text-gray-300 mt-0.5">{accionCuadrante}</p>
          </div>
          <span
            className="text-4xl font-black opacity-30"
            style={{ color: colorCuadrante }}
          >
            {cuadrante}
          </span>
        </div>

        {/* Radar + Nine Box */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#1e2a42] rounded-xl p-5 border border-[#2d3a50]">
            <h2 className="text-white font-semibold mb-3 text-sm">Radar de Competencias</h2>
            <div ref={radarRef}>
              <RadarChart360 data={radarData} height={300} />
            </div>
          </div>

          <div className="bg-[#1e2a42] rounded-xl p-5 border border-[#2d3a50]">
            <h2 className="text-white font-semibold mb-3 text-sm">Posición Nine Box</h2>
            <NineBoxMatrix colaboradores={nineBoxData} />
          </div>
        </div>

        {/* Brechas */}
        <div className="bg-[#1e2a42] rounded-xl p-5 border border-[#2d3a50]">
          <h2 className="text-white font-semibold mb-3 text-sm">Análisis de Brechas por Competencia</h2>
          <BrechasChart brechas={brechas} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2d3a50]">
                  {["Competencia", "Meta", "Actual", "Brecha", "Prioridad"].map((h) => (
                    <th key={h} className="text-left text-gray-400 font-semibold px-2 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {brechas.map((b) => (
                  <tr key={b.key} className="border-b border-[#2d3a50]/40">
                    <td className="px-2 py-2 text-gray-200">{b.label}</td>
                    <td className="px-2 py-2 text-gray-400">{b.meta.toFixed(1)}</td>
                    <td className="px-2 py-2 text-white font-medium">{b.actual.toFixed(2)}</td>
                    <td className="px-2 py-2 font-bold" style={{ color: b.brecha > 0 ? "#ef4444" : "#22c55e" }}>
                      {b.brecha > 0 ? `-${b.brecha.toFixed(2)}` : "✓"}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        b.prioridad === "alta" ? "bg-red-900/40 text-red-400" :
                        b.prioridad === "media" ? "bg-yellow-900/40 text-yellow-400" :
                        "bg-green-900/40 text-green-400"
                      }`}>
                        {b.prioridad}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detalle por fuente */}
        {Object.keys(porFuente).length > 0 && (
          <div className="bg-[#1e2a42] rounded-xl p-5 border border-[#2d3a50]">
            <h2 className="text-white font-semibold mb-3 text-sm">Evaluaciones por fuente</h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(porFuente).map(([fuente, puntajes]) => (
                <div key={fuente} className="bg-[#162032] rounded-lg px-4 py-3 text-center min-w-[110px]">
                  <p className="text-[10px] text-gray-400 mb-1">{fuente}</p>
                  <p className="text-lg font-bold text-[#2dd4bf]">
                    {(puntajes.reduce((a, b) => a + b, 0) / puntajes.length).toFixed(2)}
                  </p>
                  {puntajes.length > 1 && (
                    <p className="text-[9px] text-gray-500">{puntajes.length} evaluadores</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Narrativa IA */}
        <div className="bg-[#1e2a42] rounded-xl p-5 border border-[#2d3a50]">
          <ClaudeNarrativa360
            resultado={resultado}
            onNarrativaLista={(texto) => setNarrativa(texto)}
          />
        </div>

        {/* PDI */}
        <div className="bg-[#1e2a42] rounded-xl p-5 border border-[#2d3a50]">
          <PDIForm
            evaluadoId={id}
            periodo={periodo}
            cuadrante={nombreCuadrante}
            pdiInicial={resultado.pdi}
            onGuardado={(pdi: Pdi360) =>
              setResultado((prev) => prev ? { ...prev, pdi } : prev)
            }
          />
        </div>

      </div>
    </div>
  );
}

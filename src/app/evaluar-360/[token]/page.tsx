"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { COMPETENCIAS_360, POTENCIAL_CRITERIOS, FUENTE_LABELS, type CompetenciaKey, type PotencialKey } from "@/lib/360-types";
import type { Evaluado360, Token360 } from "@/lib/supabase";

type CompetenciasMap = Record<CompetenciaKey, number>;
type PotencialMap = Record<PotencialKey, number>;

function emptyCompetencias(): CompetenciasMap {
  return Object.fromEntries(COMPETENCIAS_360.map((c) => [c.key, 3])) as CompetenciasMap;
}
function emptyPotencial(): PotencialMap {
  return Object.fromEntries(POTENCIAL_CRITERIOS.map((c) => [c.key, 3])) as PotencialMap;
}

interface IndicadorEsencialForm {
  id: string;
  indicador: string;
  meta: string;
  formula: string | null;
}

const ESCALA_INDICADOR = [
  { valor: 5, label: "Superó la meta" },
  { valor: 4, label: "Cumplió la meta" },
  { valor: 3, label: "Cerca de la meta" },
  { valor: 2, label: "Por debajo de la meta" },
  { valor: 1, label: "Muy por debajo / no se ejecutó" },
];

export default function EvaluarToken360() {
  const { token } = useParams<{ token: string }>();
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<{ token: Token360; evaluado: Evaluado360 } | null>(null);
  const [indicadoresEsenciales, setIndicadoresEsenciales] = useState<IndicadorEsencialForm[]>([]);

  const [competencias, setCompetencias] = useState<CompetenciasMap>(emptyCompetencias());
  const [potencial, setPotencial] = useState<PotencialMap>(emptyPotencial());
  const [calificacionesIndicadores, setCalificacionesIndicadores] = useState<Record<string, number>>({});
  const [tocados, setTocados] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/token/360/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? "Este link no es válido o ya no está disponible.");
        }
        return r.json() as Promise<{
          token: Token360;
          evaluado: Evaluado360;
          indicadoresEsenciales: IndicadorEsencialForm[];
        }>;
      })
      .then((res) => {
        if (res.token.completado) {
          setEnviado(true);
        } else {
          setData(res);
          setIndicadoresEsenciales(res.indicadoresEsenciales ?? []);
          setCalificacionesIndicadores(
            Object.fromEntries((res.indicadoresEsenciales ?? []).map((i) => [i.id, 3])),
          );
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setCargando(false));
  }, [token]);

  function marcarTocado(clave: string) {
    setTocados((prev) => {
      if (prev.has(clave)) return prev;
      const next = new Set(prev);
      next.add(clave);
      return next;
    });
  }

  function setComp(key: CompetenciaKey, val: number) {
    setCompetencias((prev) => ({ ...prev, [key]: val }));
    marcarTocado(`comp:${key}`);
  }
  function setPot(key: PotencialKey, val: number) {
    setPotencial((prev) => ({ ...prev, [key]: val }));
    marcarTocado(`pot:${key}`);
  }
  function setIndicador(id: string, val: number) {
    setCalificacionesIndicadores((prev) => ({ ...prev, [id]: val }));
    marcarTocado(`ind:${id}`);
  }

  function camposFaltantes(): string[] {
    if (!data) return [];
    const esJefe = data.token.fuente === "jefe";
    const faltan: string[] = [];

    for (const c of COMPETENCIAS_360) {
      if (!tocados.has(`comp:${c.key}`)) faltan.push(c.label);
    }
    if (esJefe) {
      for (const p of POTENCIAL_CRITERIOS) {
        if (!tocados.has(`pot:${p.key}`)) faltan.push(p.label);
      }
      for (const ind of indicadoresEsenciales) {
        if (!tocados.has(`ind:${ind.id}`)) faltan.push(ind.indicador);
      }
    }
    return faltan;
  }

  async function handleEnviar() {
    if (!data) return;
    const faltan = camposFaltantes();
    if (faltan.length > 0) {
      setError(`Falta calificar: ${faltan.join(", ")}.`);
      return;
    }
    setEnviando(true);
    setError("");
    try {
      const esJefe = data.token.fuente === "jefe";
      const res = await fetch(`/api/token/360/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competencias,
          potencial: esJefe ? potencial : undefined,
          indicadoresResultado: esJefe
            ? indicadoresEsenciales.map((ind) => ({
                indicador_puesto_id: ind.id,
                calificacion: calificacionesIndicadores[ind.id] ?? 3,
              }))
            : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Error al enviar");
      }
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A1A32" }}>
        <p className="text-gray-400 text-sm">Cargando…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#0A1A32" }}>
        <div className="bg-[#1e2a42] rounded-xl p-6 border border-red-500/40 max-w-md text-center">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#0A1A32" }}>
        <div className="bg-[#1e2a42] rounded-xl p-8 border border-[#2d3a50] max-w-md text-center space-y-3">
          <div className="text-4xl">✅</div>
          <h1 className="text-white font-bold text-lg">¡Gracias por tu evaluación!</h1>
          <p className="text-gray-400 text-sm">Tu respuesta fue enviada correctamente.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A1A32" }}>
      <div className="border-b border-[#2d3a50] px-6 py-4">
        <h1 className="text-lg font-bold text-white">Evaluación 360°</h1>
        <p className="text-sm text-gray-400">
          Estás evaluando a <span className="text-[#10b981] font-semibold">{data.evaluado.nombre}</span> como{" "}
          <span className="font-semibold">{FUENTE_LABELS[data.token.fuente]}</span>
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <div className="bg-[#1e2a42] rounded-xl border border-[#2d3a50] p-4 space-y-3">
          <p className="text-xs text-gray-500">Competencias (1.0 – 5.0)</p>
          {COMPETENCIAS_360.map((comp) => (
            <div key={comp.key} className="flex items-center gap-3">
              <span className="text-xs text-gray-300 w-40 shrink-0 flex items-center gap-1">
                {comp.label}
                {!tocados.has(`comp:${comp.key}`) && <span className="text-amber-400" title="Sin calificar">●</span>}
              </span>
              <input
                type="range" min={1} max={5} step={0.1}
                value={competencias[comp.key]}
                onChange={(e) => setComp(comp.key, parseFloat(e.target.value))}
                className="flex-1 accent-[#2dd4bf]"
              />
              <span className="text-[#2dd4bf] text-sm font-bold w-10 text-right">
                {competencias[comp.key].toFixed(1)}
              </span>
            </div>
          ))}
        </div>

        {data.token.fuente === "jefe" && (
          <div className="bg-[#1e2a42] rounded-xl border border-[#2d3a50] p-4 space-y-3">
            <p className="text-xs text-gray-500">Potencial (1.0 – 5.0)</p>
            {POTENCIAL_CRITERIOS.map((crit) => (
              <div key={crit.key} className="flex items-center gap-3">
                <span className="text-xs text-gray-300 w-40 shrink-0 flex items-center gap-1">
                  {crit.label}
                  {!tocados.has(`pot:${crit.key}`) && <span className="text-amber-400" title="Sin calificar">●</span>}
                </span>
                <input
                  type="range" min={1} max={5} step={0.1}
                  value={potencial[crit.key]}
                  onChange={(e) => setPot(crit.key, parseFloat(e.target.value))}
                  className="flex-1 accent-[#10b981]"
                />
                <span className="text-[#10b981] text-sm font-bold w-10 text-right">
                  {potencial[crit.key].toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}

        {data.token.fuente === "jefe" && indicadoresEsenciales.length > 0 && (
          <div className="bg-[#1e2a42] rounded-xl border border-[#2d3a50] p-4 space-y-4">
            <div>
              <p className="text-xs text-gray-500">Cumplimiento de indicadores esenciales</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                ¿Qué tan cumplida está la meta de cada indicador de este período?
              </p>
            </div>
            {indicadoresEsenciales.map((ind) => (
              <div key={ind.id} className="space-y-1.5">
                <p className="text-xs text-gray-300 flex items-center gap-1">
                  {ind.indicador}
                  {!tocados.has(`ind:${ind.id}`) && <span className="text-amber-400" title="Sin calificar">●</span>}
                </p>
                {ind.formula && (
                  <p className="text-[10px] text-gray-500">Fórmula: {ind.formula}</p>
                )}
                <p className="text-[10px] text-gray-500">Meta: {ind.meta}</p>
                <select
                  value={calificacionesIndicadores[ind.id] ?? 3}
                  onChange={(e) => setIndicador(ind.id, parseInt(e.target.value, 10))}
                  className="w-full bg-[#0A1A32] border border-[#2d3a50] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#10b981]"
                >
                  {ESCALA_INDICADOR.map((op) => (
                    <option key={op.valor} value={op.valor}>{op.valor} — {op.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
        )}

        <button
          onClick={handleEnviar}
          disabled={enviando}
          className="w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-60"
          style={{ backgroundColor: "#10b981", color: "#0A1A32" }}
        >
          {enviando ? "Enviando…" : "Enviar evaluación"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { obtenerToken360, completarToken360 } from "@/lib/supabase";
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

export default function EvaluarToken360() {
  const { token } = useParams<{ token: string }>();
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<{ token: Token360; evaluado: Evaluado360 } | null>(null);

  const [competencias, setCompetencias] = useState<CompetenciasMap>(emptyCompetencias());
  const [potencial, setPotencial] = useState<PotencialMap>(emptyPotencial());

  useEffect(() => {
    obtenerToken360(token)
      .then((res) => {
        if (!res) {
          setError("Este link no es válido o ya no está disponible.");
        } else if (res.token.completado) {
          setEnviado(true);
        } else {
          setData(res);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setCargando(false));
  }, [token]);

  function setComp(key: CompetenciaKey, val: number) {
    setCompetencias((prev) => ({ ...prev, [key]: val }));
  }
  function setPot(key: PotencialKey, val: number) {
    setPotencial((prev) => ({ ...prev, [key]: val }));
  }

  async function handleEnviar() {
    if (!data) return;
    setEnviando(true);
    setError("");
    try {
      const esJefe = data.token.fuente === "jefe";
      await completarToken360(token, competencias, esJefe ? potencial : undefined);
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#1a2035" }}>
        <p className="text-gray-400 text-sm">Cargando…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#1a2035" }}>
        <div className="bg-[#1e2a42] rounded-xl p-6 border border-red-500/40 max-w-md text-center">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#1a2035" }}>
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
    <div className="min-h-screen" style={{ backgroundColor: "#1a2035" }}>
      <div className="border-b border-[#2d3a50] px-6 py-4">
        <h1 className="text-lg font-bold text-white">Evaluación 360°</h1>
        <p className="text-sm text-gray-400">
          Estás evaluando a <span className="text-[#c9a84c] font-semibold">{data.evaluado.nombre}</span> como{" "}
          <span className="font-semibold">{FUENTE_LABELS[data.token.fuente]}</span>
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <div className="bg-[#1e2a42] rounded-xl border border-[#2d3a50] p-4 space-y-3">
          <p className="text-xs text-gray-500">Competencias (1.0 – 5.0)</p>
          {COMPETENCIAS_360.map((comp) => (
            <div key={comp.key} className="flex items-center gap-3">
              <span className="text-xs text-gray-300 w-40 shrink-0">{comp.label}</span>
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
                <span className="text-xs text-gray-300 w-40 shrink-0">{crit.label}</span>
                <input
                  type="range" min={1} max={5} step={0.1}
                  value={potencial[crit.key]}
                  onChange={(e) => setPot(crit.key, parseFloat(e.target.value))}
                  className="flex-1 accent-[#c9a84c]"
                />
                <span className="text-[#c9a84c] text-sm font-bold w-10 text-right">
                  {potencial[crit.key].toFixed(1)}
                </span>
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
          style={{ backgroundColor: "#c9a84c", color: "#1a2035" }}
        >
          {enviando ? "Enviando…" : "Enviar evaluación"}
        </button>
      </div>
    </div>
  );
}

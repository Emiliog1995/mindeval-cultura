"use client";

import { useState } from "react";
import type { ResultadoConsolidado360 } from "@/lib/360-types";

interface Props {
  resultado: ResultadoConsolidado360;
  onNarrativaLista: (texto: string) => void;
}

export default function ClaudeNarrativa360({ resultado, onNarrativaLista }: Props) {
  const [narrativa, setNarrativa] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);

  async function generar() {
    setCargando(true);
    setError("");
    try {
      const res = await fetch("/api/360-narrativa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultado }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al generar narrativa");
      setNarrativa(json.narrativa);
      onNarrativaLista(json.narrativa);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setCargando(false);
    }
  }

  function copiar() {
    navigator.clipboard.writeText(narrativa);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Análisis con Inteligencia Artificial</h3>
        {!narrativa && (
          <button
            onClick={generar}
            disabled={cargando}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
            style={{ backgroundColor: "#c9a84c", color: "#1a2035" }}
          >
            {cargando ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-[#1a2035]/30 border-t-[#1a2035] rounded-full animate-spin" />
                Generando…
              </>
            ) : (
              "✨ Generar análisis con IA"
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {narrativa && (
        <div className="border border-[#c9a84c]/40 rounded-lg p-4 bg-[#1e2a42] space-y-3">
          <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-line">{narrativa}</p>
          <div className="flex gap-2 pt-2 border-t border-[#2d3a50]">
            <button
              onClick={copiar}
              className="px-3 py-1.5 text-xs rounded bg-[#2d3a50] text-gray-300 hover:bg-[#374151] transition-colors"
            >
              {copiado ? "✓ Copiado" : "Copiar texto"}
            </button>
            <button
              onClick={generar}
              disabled={cargando}
              className="px-3 py-1.5 text-xs rounded bg-[#2d3a50] text-gray-300 hover:bg-[#374151] transition-colors disabled:opacity-50"
            >
              Regenerar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

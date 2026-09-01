"use client";

import { useState } from "react";
import { upsert360Pdi, type Pdi360 } from "@/lib/supabase";
import type { ResultadoConsolidado360 } from "@/lib/360-types";
import { authHeaders } from "@/lib/auth-headers";

interface Props {
  evaluadoId: string;
  periodo: string;
  cuadrante: string;
  pdiInicial?: Pdi360;
  onGuardado: (pdi: Pdi360) => void;
  resultado: ResultadoConsolidado360;
}

interface SugerenciaPDI {
  areas: Array<{ area_mejora: string; objetivo_smart: string; accion: string }>;
  plazo: string;
  indicador: string;
}

const PLAZO_OPTIONS = ["1 mes", "3 meses", "6 meses", "12 meses"];

const CUADRANTE_COLORS: Record<string, string> = {
  ESTRELLA:                 "#10b981",
  "TALENTO EN CRECIMIENTO": "#84cc16",
  "ALTO DESEMPEÑO":         "#2dd4bf",
  EXPERTO:                  "#2dd4bf",
  "PROFESIONAL CLAVE":      "#eab308",
  "TRABAJADOR EFICAZ":      "#eab308",
  ENIGMA:                   "#f97316",
  INCONSISTENTE:            "#ef4444",
  RIESGO:                   "#ef4444",
};

export default function PDIForm({ evaluadoId, periodo, cuadrante, pdiInicial, onGuardado, resultado }: Props) {
  const [form, setForm] = useState({
    area_mejora_1:    pdiInicial?.area_mejora_1    ?? "",
    objetivo_smart_1: pdiInicial?.objetivo_smart_1 ?? "",
    accion_1:         pdiInicial?.accion_1         ?? "",
    area_mejora_2:    pdiInicial?.area_mejora_2    ?? "",
    objetivo_smart_2: pdiInicial?.objetivo_smart_2 ?? "",
    accion_2:         pdiInicial?.accion_2         ?? "",
    area_mejora_3:    pdiInicial?.area_mejora_3    ?? "",
    objetivo_smart_3: pdiInicial?.objetivo_smart_3 ?? "",
    accion_3:         pdiInicial?.accion_3         ?? "",
    plazo:            pdiInicial?.plazo             ?? "3 meses",
    indicador:        pdiInicial?.indicador         ?? "",
  });
  const [open, setOpen] = useState<number[]>([1]);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [errorSugerencia, setErrorSugerencia] = useState("");
  const [sugerido, setSugerido] = useState(false);

  async function sugerirConIA() {
    setSugiriendo(true);
    setErrorSugerencia("");
    try {
      const res = await fetch("/api/360-pdi-sugerido", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ resultado }),
      });
      const json: SugerenciaPDI & { error?: string } = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al generar la sugerencia");

      setForm((prev) => {
        const next = { ...prev, plazo: json.plazo || prev.plazo, indicador: json.indicador || prev.indicador };
        json.areas?.slice(0, 3).forEach((a, i) => {
          const n = i + 1;
          next[`area_mejora_${n}` as keyof typeof next] = a.area_mejora ?? "";
          next[`objetivo_smart_${n}` as keyof typeof next] = a.objetivo_smart ?? "";
          next[`accion_${n}` as keyof typeof next] = a.accion ?? "";
        });
        return next;
      });
      setOpen([1, 2, 3]);
      setSugerido(true);
    } catch (e) {
      setErrorSugerencia(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSugiriendo(false);
    }
  }

  function toggle(n: number) {
    setOpen((prev) => prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]);
  }

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleGuardar() {
    setGuardando(true);
    try {
      const pdi = await upsert360Pdi({ evaluado_id: evaluadoId, periodo, cuadrante, ...form });
      setGuardado(true);
      onGuardado(pdi);
      setTimeout(() => setGuardado(false), 3000);
    } finally {
      setGuardando(false);
    }
  }

  const color = CUADRANTE_COLORS[cuadrante] ?? "#10b981";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-semibold">Plan de Desarrollo Individual</h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: color + "22", color, border: `1px solid ${color}` }}>
            {cuadrante}
          </span>
        </div>
        <button
          onClick={sugerirConIA}
          disabled={sugiriendo}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
          style={{ backgroundColor: "#10b981", color: "#0A1A32" }}
        >
          {sugiriendo ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-[#0A1A32]/30 border-t-[#0A1A32] rounded-full animate-spin" />
              Generando…
            </>
          ) : (
            "✨ Sugerir con IA"
          )}
        </button>
      </div>

      {errorSugerencia && (
        <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-4 py-3 text-red-300 text-sm">
          {errorSugerencia}
        </div>
      )}

      {sugerido && (
        <p className="text-[11px] text-gray-500">
          Sugerencia generada con IA a partir de las brechas y el cuadrante de esta persona. Revisa, ajusta y valida cada campo antes de guardar el plan definitivo.
        </p>
      )}

      {[1, 2, 3].map((n) => (
        <div key={n} className="border border-[#2d3a50] rounded-lg overflow-hidden">
          <button
            onClick={() => toggle(n)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#1e2a42] text-left"
          >
            <span className="text-sm font-medium text-gray-200">Área de mejora {n}</span>
            <span className="text-gray-400">{open.includes(n) ? "▲" : "▼"}</span>
          </button>
          {open.includes(n) && (
            <div className="p-4 bg-[#162032] space-y-3">
              {(["area_mejora", "objetivo_smart", "accion"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs text-gray-400 mb-1">
                    {field === "area_mejora" ? "Área de mejora" : field === "objetivo_smart" ? "Objetivo SMART" : "Acción concreta"}
                  </label>
                  <textarea
                    value={form[`${field}_${n}` as keyof typeof form]}
                    onChange={(e) => set(`${field}_${n}`, e.target.value)}
                    rows={2}
                    className="w-full bg-[#0A1A32] border border-[#2d3a50] rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#2dd4bf] resize-none"
                    placeholder={field === "area_mejora" ? "Ej: Comunicación asertiva" : field === "objetivo_smart" ? "Ej: Mejorar en 0.5 pts para Q3 2025" : "Ej: Participar en taller de comunicación"}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Plazo</label>
          <select
            value={form.plazo}
            onChange={(e) => set("plazo", e.target.value)}
            className="w-full bg-[#0A1A32] border border-[#2d3a50] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf]"
          >
            {PLAZO_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Indicador de éxito</label>
          <input
            type="text"
            value={form.indicador}
            onChange={(e) => set("indicador", e.target.value)}
            className="w-full bg-[#0A1A32] border border-[#2d3a50] rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#2dd4bf]"
            placeholder="Ej: Puntaje ≥ 4.0 en siguiente evaluación"
          />
        </div>
      </div>

      <button
        onClick={handleGuardar}
        disabled={guardando}
        className="w-full py-2.5 rounded-lg font-semibold text-sm transition-colors"
        style={{ backgroundColor: guardado ? "#10b981" : "#10b981", color: "#0A1A32" }}
      >
        {guardando ? "Guardando…" : guardado ? "✓ PDI guardado" : "Guardar PDI"}
      </button>
    </div>
  );
}

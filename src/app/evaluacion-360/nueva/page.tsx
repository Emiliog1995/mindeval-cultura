"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crear360Evaluado, crear360Evaluacion } from "@/lib/supabase";
import { COMPETENCIAS_360, POTENCIAL_CRITERIOS, type FuenteEvaluacion, type CompetenciaKey, type PotencialKey } from "@/lib/360-types";
import { calcularPuntaje360, clasificarNivelDesempeno } from "@/lib/360-scoring";
import type { Evaluacion360 } from "@/lib/supabase";

const FUENTES: Array<{ key: FuenteEvaluacion; label: string; peso: string }> = [
  { key: "autoevaluacion",  label: "Autoevaluación",   peso: "10%" },
  { key: "jefe",            label: "Jefe Directo",     peso: "40%" },
  { key: "par",             label: "Par",              peso: "20%" },
  { key: "colaborador",     label: "Colaborador",      peso: "20%" },
  { key: "cliente_interno", label: "Cliente Interno",  peso: "10%" },
];

type CompetenciasMap = Record<CompetenciaKey, number>;
type PotencialMap    = Record<PotencialKey, number>;

function emptyCompetencias(): CompetenciasMap {
  return Object.fromEntries(COMPETENCIAS_360.map((c) => [c.key, 3])) as CompetenciasMap;
}
function emptyPotencial(): PotencialMap {
  return Object.fromEntries(POTENCIAL_CRITERIOS.map((c) => [c.key, 3])) as PotencialMap;
}

export default function NuevaEvaluacion360() {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [datos, setDatos] = useState({
    nombre: "", cargo: "", departamento: "", jefe: "", fecha_ingreso: "", periodo: "",
  });

  const [calificaciones, setCalificaciones] = useState<Record<FuenteEvaluacion, CompetenciasMap>>({
    autoevaluacion:  emptyCompetencias(),
    jefe:            emptyCompetencias(),
    par:             emptyCompetencias(),
    colaborador:     emptyCompetencias(),
    cliente_interno: emptyCompetencias(),
  });
  const [potencial, setPotencial] = useState<PotencialMap>(emptyPotencial());
  const [fuenteAbierta, setFuenteAbierta] = useState<FuenteEvaluacion>("jefe");

  function setComp(fuente: FuenteEvaluacion, key: CompetenciaKey, val: number) {
    setCalificaciones((prev) => ({
      ...prev,
      [fuente]: { ...prev[fuente], [key]: val },
    }));
  }
  function setPot(key: PotencialKey, val: number) {
    setPotencial((prev) => ({ ...prev, [key]: val }));
  }

  // Cálculo en tiempo real
  const evsPrevias: Omit<Evaluacion360, "id" | "created_at">[] = FUENTES.map((f) => ({
    evaluado_id: "preview",
    periodo: datos.periodo || "preview",
    fuente: f.key,
    competencias: calificaciones[f.key],
    potencial: f.key === "jefe" ? potencial : undefined,
  }));
  const { puntaje360 } = calcularPuntaje360(evsPrevias as Evaluacion360[]);
  const { nivel, color } = clasificarNivelDesempeno(puntaje360);

  async function handleGuardar() {
    if (!datos.nombre || !datos.cargo || !datos.departamento || !datos.periodo) {
      setError("Completa nombre, cargo, departamento y período.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const evaluado = await crear360Evaluado({
        nombre: datos.nombre,
        cargo: datos.cargo,
        departamento: datos.departamento,
        jefe: datos.jefe || undefined,
        fecha_ingreso: datos.fecha_ingreso || undefined,
      });

      await Promise.all(
        FUENTES.map((f) =>
          crear360Evaluacion({
            evaluado_id: evaluado.id,
            periodo: datos.periodo,
            fuente: f.key,
            competencias: calificaciones[f.key],
            potencial: f.key === "jefe" ? potencial : undefined,
            puntaje_total: undefined,
            nivel: undefined,
          })
        )
      );

      router.push(`/evaluacion-360/${evaluado.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#1a2035" }}>
      <div className="border-b border-[#2d3a50] px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm">← Volver</button>
        <h1 className="text-lg font-bold text-white">Nueva Evaluación 360°</h1>
        <div className="ml-auto flex gap-2">
          {[1, 2].map((n) => (
            <button
              key={n}
              onClick={() => setPaso(n)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={{ backgroundColor: paso === n ? "#c9a84c" : "#1e2a42", color: paso === n ? "#1a2035" : "#9ca3af" }}
            >
              Paso {n}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {paso === 1 && (
          <div className="bg-[#1e2a42] rounded-xl p-6 border border-[#2d3a50] space-y-4">
            <h2 className="text-white font-semibold">Datos del evaluado</h2>
            {[
              { field: "nombre",         label: "Nombre completo *",   type: "text" },
              { field: "cargo",          label: "Cargo *",             type: "text" },
              { field: "departamento",   label: "Departamento *",      type: "text" },
              { field: "jefe",           label: "Jefe directo",        type: "text" },
              { field: "fecha_ingreso",  label: "Fecha de ingreso",    type: "date" },
              { field: "periodo",        label: "Período de evaluación * (ej: 2025-S1)", type: "text" },
            ].map(({ field, label, type }) => (
              <div key={field}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input
                  type={type}
                  value={datos[field as keyof typeof datos]}
                  onChange={(e) => setDatos((p) => ({ ...p, [field]: e.target.value }))}
                  className="w-full bg-[#1a2035] border border-[#2d3a50] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf]"
                />
              </div>
            ))}
            <button
              onClick={() => setPaso(2)}
              className="w-full py-2.5 rounded-lg font-semibold text-sm mt-2"
              style={{ backgroundColor: "#c9a84c", color: "#1a2035" }}
            >
              Continuar a calificaciones →
            </button>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            {/* Puntaje en tiempo real */}
            <div className="bg-[#1e2a42] rounded-xl p-4 border border-[#2d3a50] flex items-center justify-between">
              <span className="text-gray-400 text-sm">Puntaje 360° calculado en tiempo real</span>
              <div className="text-right">
                <span className="text-2xl font-bold" style={{ color }}>{puntaje360.toFixed(2)}</span>
                <span className="text-xs ml-2" style={{ color }}>{nivel}</span>
              </div>
            </div>

            {FUENTES.map((fuente) => (
              <div key={fuente.key} className="bg-[#1e2a42] rounded-xl border border-[#2d3a50] overflow-hidden">
                <button
                  onClick={() => setFuenteAbierta(fuenteAbierta === fuente.key ? ("" as FuenteEvaluacion) : fuente.key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <span className="text-white font-medium text-sm">{fuente.label}</span>
                    <span className="text-gray-500 text-xs ml-2">peso {fuente.peso}</span>
                  </div>
                  <span className="text-gray-400">{fuenteAbierta === fuente.key ? "▲" : "▼"}</span>
                </button>

                {fuenteAbierta === fuente.key && (
                  <div className="px-4 pb-4 space-y-3 border-t border-[#2d3a50]">
                    <p className="text-xs text-gray-500 pt-3">Competencias (1.0 – 5.0)</p>
                    {COMPETENCIAS_360.map((comp) => (
                      <div key={comp.key} className="flex items-center gap-3">
                        <span className="text-xs text-gray-300 w-40 shrink-0">{comp.label}</span>
                        <input
                          type="range" min={1} max={5} step={0.1}
                          value={calificaciones[fuente.key][comp.key]}
                          onChange={(e) => setComp(fuente.key, comp.key, parseFloat(e.target.value))}
                          className="flex-1 accent-[#2dd4bf]"
                        />
                        <span className="text-[#2dd4bf] text-sm font-bold w-10 text-right">
                          {calificaciones[fuente.key][comp.key].toFixed(1)}
                        </span>
                      </div>
                    ))}

                    {fuente.key === "jefe" && (
                      <>
                        <p className="text-xs text-gray-500 pt-2 border-t border-[#2d3a50]">Potencial (1.0 – 5.0)</p>
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
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}

            {error && (
              <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
            )}

            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-60"
              style={{ backgroundColor: "#c9a84c", color: "#1a2035" }}
            >
              {guardando ? "Guardando evaluación…" : "Guardar y ver resultados"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

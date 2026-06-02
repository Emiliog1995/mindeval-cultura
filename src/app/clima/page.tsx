"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLIMA_ITEMS, CLIMA_DIMENSIONS, type ClimaDimension } from "@/lib/clima-items";
import { calcularClimaScores } from "@/lib/clima-scoring";
import { guardarClima } from "@/lib/supabase";

// Cada paso muestra 2 dimensiones (10 ítems)
const STEP_DIMS: ClimaDimension[][] = [
  ["A", "B"],
  ["C", "D"],
  ["E", "F"],
];

const STEP_LABELS = [
  "Liderazgo y Comunicación",
  "Equipo y Reconocimiento",
  "Condiciones y Desarrollo",
];

export default function ClimaPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const dimsEnStep = STEP_DIMS[step];
  const itemsEnStep = CLIMA_ITEMS.filter((i) => dimsEnStep.includes(i.dimension));
  const todosRespondidos = itemsEnStep.every((i) => respuestas[String(i.id)] !== undefined);
  const totalRespondidos = Object.keys(respuestas).length;
  const progreso = Math.round((totalRespondidos / 30) * 100);

  function responder(id: number, val: number) {
    setRespuestas((prev) => ({ ...prev, [String(id)]: val }));
  }

  async function handleSiguiente() {
    if (step < 2) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const allAnswered = CLIMA_ITEMS.every((item) => respuestas[String(item.id)] !== undefined);
    if (!allAnswered) {
      setError("Por favor responde todos los ítems antes de enviar.");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      const scores = calcularClimaScores(respuestas);
      await guardarClima({ respuestas, scores });
      router.push("/clima/gracias");
    } catch {
      setError("No se pudo registrar tu respuesta. Por favor intenta nuevamente.");
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#f0f4f8" }}>
      {/* Header */}
      <header style={{ background: "#1a2035" }} className="py-4 px-6 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <span style={{ color: "#c9a84c" }} className="text-xl font-bold tracking-wide">MINDTALENT</span>
            <p className="text-white text-xs mt-0.5 opacity-70">Clima Laboral · Encuesta Anónima</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold" style={{ color: "#c9a84c" }}>
              Parte 2 · Sección {step + 1} de 3
            </p>
            <p className="text-white text-xs opacity-60">{totalRespondidos} de 30 respondidas</p>
          </div>
        </div>
      </header>

      {/* Barra de progreso */}
      <div className="h-1.5" style={{ background: "#243447" }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progreso}%`, background: "#c9a84c" }}
        />
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* Instrucción */}
        <div className="bg-white rounded-2xl shadow p-5 mb-6">
          <h2 className="text-base font-bold mb-1" style={{ color: "#1a2035" }}>
            {STEP_LABELS[step]}
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Esta encuesta es <strong>completamente anónima</strong>. Indica tu nivel de acuerdo con cada
            afirmación del <strong>1</strong> (Totalmente en desacuerdo) al <strong>5</strong> (Totalmente de acuerdo).
          </p>
        </div>

        {/* Ítems agrupados por dimensión */}
        {dimsEnStep.map((dim) => {
          const itemsDim = CLIMA_ITEMS.filter((i) => i.dimension === dim);
          return (
            <div key={dim} className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3 px-1" style={{ color: "#1a2035" }}>
                {CLIMA_DIMENSIONS[dim]}
              </h3>
              <div className="space-y-3">
                {itemsDim.map((item) => {
                  const selected = respuestas[String(item.id)];
                  return (
                    <div key={item.id} className="bg-white rounded-xl shadow p-4">
                      <p className="text-sm text-gray-800 mb-3 leading-relaxed">
                        <span className="font-semibold" style={{ color: "#c9a84c" }}>{item.id}.</span>{" "}
                        {item.text}
                      </p>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((val) => {
                          const isSelected = selected === val;
                          return (
                            <button
                              key={val}
                              onClick={() => responder(item.id, val)}
                              className="flex-1 flex flex-col items-center py-2.5 rounded-lg border-2 transition-all text-sm font-bold focus:outline-none"
                              style={{
                                borderColor: isSelected ? "#1a2035" : "#e5e7eb",
                                background:  isSelected ? "#1a2035" : "white",
                                color:       isSelected ? "#c9a84c" : "#9ca3af",
                              }}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 px-0.5">
                        <span>Totalmente en desacuerdo</span>
                        <span>Totalmente de acuerdo</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Navegación */}
        <div className="flex justify-between items-center mt-6">
          <button
            onClick={() => { setStep((s) => s - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            disabled={step === 0}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all disabled:opacity-30"
            style={{ borderColor: "#1a2035", color: "#1a2035" }}
          >
            ← Anterior
          </button>
          <button
            onClick={handleSiguiente}
            disabled={!todosRespondidos || enviando}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: "#1a2035", color: "#c9a84c" }}
          >
            {enviando ? "Enviando..." : step < 2 ? "Siguiente →" : "Enviar respuestas"}
          </button>
        </div>

        {!todosRespondidos && (
          <p className="text-center text-xs text-gray-400 mt-3">
            Responde todos los ítems de esta sección para continuar.
          </p>
        )}
      </main>
    </div>
  );
}

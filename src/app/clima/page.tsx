"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CLIMA_ITEMS, CLIMA_DIMENSIONS, type ClimaDimension } from "@/lib/clima-items";
import { calcularClimaScores } from "@/lib/clima-scoring";
import { guardarClima } from "@/lib/supabase";

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

type DatosClima = { nombre: string; cargo: string; area: string; empresa: string };

export default function ClimaPage() {
  const router = useRouter();
  const [datos, setDatos] = useState<DatosClima>({ nombre: "", cargo: "", area: "", empresa: "" });
  const [heredado, setHeredado] = useState(false);
  const [consentimiento, setConsentimiento] = useState(false);
  const [paso, setPaso] = useState<"datos" | "items">("datos");
  const [step, setStep] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("clima_datos_heredados");
    if (raw) {
      try {
        const parsed: DatosClima = JSON.parse(raw);
        setDatos(parsed);
        setHeredado(true);
        setPaso("items");
        sessionStorage.removeItem("clima_datos_heredados");
      } catch {
        // datos corruptos — mostrar formulario normal
      }
    }
  }, []);

  const dimsEnStep = STEP_DIMS[step];
  const itemsEnStep = CLIMA_ITEMS.filter((i) => dimsEnStep.includes(i.dimension));
  const todosRespondidos = itemsEnStep.every((i) => respuestas[String(i.id)] !== undefined);
  const totalRespondidos = Object.keys(respuestas).length;
  const progreso = Math.round((totalRespondidos / 30) * 100);

  function responder(id: number, val: number) {
    setRespuestas((prev) => ({ ...prev, [String(id)]: val }));
  }

  function handleDatos(e: React.FormEvent) {
    e.preventDefault();
    if (!datos.nombre.trim() || !datos.cargo.trim() || !datos.area.trim() || !datos.empresa.trim()) {
      setError("Por favor completa todos los campos.");
      return;
    }
    if (!consentimiento) {
      setError("Debes aceptar el aviso de privacidad para continuar.");
      return;
    }
    setError("");
    setPaso("items");
    window.scrollTo(0, 0);
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
      await guardarClima({ respuestas, scores, ...datos });
      const sesionId = new URLSearchParams(window.location.search).get("sesion");
      router.push(sesionId ? `/clima/gracias?sesion=${sesionId}` : "/clima/gracias");
    } catch {
      setError("No se pudo registrar tu respuesta. Por favor intenta nuevamente.");
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#f0f4f8" }}>
      {/* Header */}
      <header style={{ background: "#0A1A32" }} className="py-4 px-6 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <span style={{ color: "#10b981" }} className="text-xl font-bold tracking-wide">MINDTALENT</span>
            <p className="text-white text-xs mt-0.5 opacity-70">Clima Laboral · Encuesta Anónima</p>
          </div>
          <div className="text-right">
            {paso === "items" ? (
              <>
                <p className="text-xs font-semibold" style={{ color: "#10b981" }}>
                  Sección {step + 1} de 3
                </p>
                <p className="text-white text-xs opacity-60">{totalRespondidos} de 30 respondidas</p>
              </>
            ) : (
              <p className="text-white text-xs opacity-60">Encuesta de Clima Laboral</p>
            )}
          </div>
        </div>
      </header>

      {/* Barra de progreso — solo visible en ítems */}
      {paso === "items" && (
        <div className="h-1.5" style={{ background: "#1E2D5A" }}>
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${progreso}%`, background: "#10b981" }}
          />
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* ── PASO DATOS (solo si viene directo, no desde Cultura) ── */}
        {paso === "datos" && (
          <div className="bg-white rounded-2xl shadow-md p-8">
            <h1 className="text-2xl font-bold mb-1 text-gray-900">Encuesta de Clima Laboral</h1>
            <p className="text-gray-600 mb-8 text-sm">
              Completa tus datos para comenzar. La encuesta es anónima y toma aproximadamente 5 minutos.
            </p>
            {error && <p className="text-red-600 bg-red-50 rounded-lg px-4 py-3 mb-6 text-sm">{error}</p>}
            <form onSubmit={handleDatos} className="space-y-5">
              {[
                { field: "nombre",  label: "Nombre completo",       placeholder: "Ej. María García López" },
                { field: "cargo",   label: "Cargo",                  placeholder: "Ej. Gerente de Operaciones" },
                { field: "area",    label: "Área / Departamento",    placeholder: "Ej. Recursos Humanos" },
                { field: "empresa", label: "Empresa",                placeholder: "Ej. MINDTALENT" },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={datos[field as keyof DatosClima]}
                    onChange={(e) => setDatos((p) => ({ ...p, [field]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </div>
              ))}
              <div
                className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                style={{ background: "#f8f6f0", borderLeft: "3px solid #10b981" }}
              >
                <p style={{ color: "#0A1A32" }}>
                  Tu nombre se registra solo para validar tu participación. Tus respuestas son
                  confidenciales y los resultados se reportan únicamente de forma grupal por área.
                  Tu nombre nunca aparecerá ligado a tus respuestas.
                </p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentimiento}
                  onChange={(e) => setConsentimiento(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-yellow-600 flex-shrink-0"
                />
                <span className="text-xs text-gray-600 leading-relaxed">
                  He leído y acepto el{" "}
                  <a
                    href="/privacidad"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold"
                    style={{ color: "#0A1A32" }}
                  >
                    Aviso de Privacidad
                  </a>{" "}
                  y autorizo el tratamiento de mis datos personales conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP).
                </span>
              </label>
              <button
                type="submit"
                disabled={!consentimiento}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "#0A1A32", color: "#10b981" }}
              >
                Comenzar encuesta →
              </button>
            </form>
          </div>
        )}

        {/* ── ÍTEMS ── */}
        {paso === "items" && (
          <>
            {/* Banner de datos heredados */}
            {heredado && (
              <div
                className="rounded-xl px-4 py-3 mb-6 text-sm flex items-center gap-2"
                style={{ background: "#f8f6f0", borderLeft: "3px solid #10b981", color: "#0A1A32" }}
              >
                <span>✓</span>
                <span>Datos heredados de Cultura Organizacional — <strong>{datos.nombre}</strong>, {datos.cargo}, {datos.area}</span>
              </div>
            )}

            {/* Instrucción */}
            <div className="bg-white rounded-2xl shadow p-5 mb-6">
              <h2 className="text-base font-bold mb-1" style={{ color: "#0A1A32" }}>
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
                  <h3 className="text-xs font-bold uppercase tracking-widest mb-3 px-1" style={{ color: "#0A1A32" }}>
                    {CLIMA_DIMENSIONS[dim]}
                  </h3>
                  <div className="space-y-3">
                    {itemsDim.map((item) => {
                      const selected = respuestas[String(item.id)];
                      return (
                        <div key={item.id} className="bg-white rounded-xl shadow p-4">
                          <p className="text-sm text-gray-800 mb-3 leading-relaxed">
                            <span className="font-semibold" style={{ color: "#10b981" }}>{item.id}.</span>{" "}
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
                                    borderColor: isSelected ? "#0A1A32" : "#e5e7eb",
                                    background:  isSelected ? "#0A1A32" : "white",
                                    color:       isSelected ? "#10b981" : "#9ca3af",
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
                style={{ borderColor: "#0A1A32", color: "#0A1A32" }}
              >
                ← Anterior
              </button>
              <button
                onClick={handleSiguiente}
                disabled={!todosRespondidos || enviando}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: "#0A1A32", color: "#10b981" }}
              >
                {enviando ? "Enviando..." : step < 2 ? "Siguiente →" : "Enviar respuestas"}
              </button>
            </div>

            {!todosRespondidos && (
              <p className="text-center text-xs text-gray-400 mt-3">
                Responde todos los ítems de esta sección para continuar.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

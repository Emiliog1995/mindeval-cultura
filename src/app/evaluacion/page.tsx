"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ITEMS, DIMENSIONS, SUBSCALES } from "@/lib/items";
import { calcularScores } from "@/lib/scoring";
import { guardarEvaluacion } from "@/lib/supabase";

type Respuestas = Record<string, number>;
type Paso = "datos" | "foto" | "items" | "enviando";

const OPCIONES = [
  { valor: 1, label: "Totalmente en desacuerdo" },
  { valor: 2, label: "En desacuerdo" },
  { valor: 3, label: "Ni de acuerdo ni en desacuerdo" },
  { valor: 4, label: "De acuerdo" },
  { valor: 5, label: "Totalmente de acuerdo" },
];

const DIMS = ["I", "II", "III", "IV"] as const;

export default function Cuestionario() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [paso, setPaso] = useState<Paso>("datos");
  const [datos, setDatos] = useState({ nombre: "", cargo: "", area: "", empresa: "MINDTALENT" });
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [dimActual, setDimActual] = useState(0);
  const [error, setError] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [camaraActiva, setCamaraActiva] = useState(false);

  // ── Datos del evaluado ──────────────────────────────────
  function handleDatos(e: React.FormEvent) {
    e.preventDefault();
    if (!datos.nombre.trim() || !datos.cargo.trim() || !datos.area.trim()) {
      setError("Por favor completa todos los campos.");
      return;
    }
    setError("");
    setPaso("foto");
    window.scrollTo(0, 0);
  }

  // ── Cámara ──────────────────────────────────────────────
  async function activarCamara() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamaraActiva(true);
    } catch {
      setError("No se pudo acceder a la cámara. Verifica los permisos del navegador.");
    }
  }

  function tomarFoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    setFoto(canvasRef.current.toDataURL("image/jpeg", 0.8));
    detenerCamara();
  }

  function retomar() {
    setFoto(null);
    activarCamara();
  }

  function detenerCamara() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamaraActiva(false);
  }

  function continuarSinFoto() {
    detenerCamara();
    setPaso("items");
    window.scrollTo(0, 0);
  }

  function continuarConFoto() {
    detenerCamara();
    setPaso("items");
    window.scrollTo(0, 0);
  }

  // ── Ítems ───────────────────────────────────────────────
  function handleRespuesta(itemId: number, valor: number) {
    setRespuestas((prev) => ({ ...prev, [String(itemId)]: valor }));
  }

  const dimensiones = DIMS.map((dim) => ({
    code: dim,
    label: DIMENSIONS[dim],
    subscales: (Object.keys(SUBSCALES) as (keyof typeof SUBSCALES)[])
      .filter((s) => SUBSCALES[s].dimension === dim)
      .map((s) => ({
        code: s,
        label: SUBSCALES[s].label,
        items: ITEMS.filter((i) => i.subscale === s),
      })),
  }));

  const dimData = dimensiones[dimActual];
  const itemsDimActual = dimData.subscales.flatMap((s) => s.items);
  const respondidosDim = itemsDimActual.filter((i) => respuestas[String(i.id)] !== undefined).length;
  const totalRespondidos = Object.keys(respuestas).length;
  const progreso = Math.round((totalRespondidos / 60) * 100);

  function handleSiguienteDim() {
    if (respondidosDim < itemsDimActual.length) {
      const faltantes = itemsDimActual.filter((i) => !respuestas[String(i.id)]).map((i) => i.id);
      setError(`Responde todos los ítems de esta dimensión antes de continuar. Faltan: ${faltantes.join(", ")}`);
      window.scrollTo(0, 0);
      return;
    }
    setError("");
    setDimActual((d) => d + 1);
    window.scrollTo(0, 0);
  }

  function handleAnteriorDim() {
    setError("");
    setDimActual((d) => d - 1);
    window.scrollTo(0, 0);
  }

  async function handleEnviar() {
    if (respondidosDim < itemsDimActual.length) {
      const faltantes = itemsDimActual.filter((i) => !respuestas[String(i.id)]).map((i) => i.id);
      setError(`Responde todos los ítems antes de enviar. Faltan: ${faltantes.join(", ")}`);
      window.scrollTo(0, 0);
      return;
    }
    setPaso("enviando");
    try {
      const scores = calcularScores(respuestas);
      await guardarEvaluacion({ ...datos, respuestas, scores });
      router.push(`/gracias`);
    } catch {
      setError("Error al guardar. Verifica tu conexión y las credenciales de Supabase en .env.local");
      setPaso("items");
      window.scrollTo(0, 0);
    }
  }

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "#f0f4f8" }}>
      {/* Header */}
      <header style={{ background: "#1a2035" }} className="py-4 px-6 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <span style={{ color: "#c9a84c" }} className="text-xl font-bold tracking-wide">MINDTALENT</span>
            <p className="text-white text-xs mt-0.5 opacity-70">Assessment Center Digital · Quito, Ecuador</p>
          </div>
          <div className="text-right">
            <p className="text-white text-sm font-semibold">DOCS – Cultura Organizacional</p>
            <p style={{ color: "#c9a84c" }} className="text-xs">Modelo Denison</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* ── PASO 1: DATOS ── */}
        {paso === "datos" && (
          <div className="bg-white rounded-2xl shadow-md p-8">
            <h1 className="text-2xl font-bold mb-1 text-gray-900">Diagnóstico de Cultura Organizacional</h1>
            <p className="text-gray-600 mb-8 text-sm">
              Completa tus datos para comenzar. El cuestionario tiene 60 afirmaciones y toma aproximadamente 15 minutos.
            </p>
            {error && <p className="text-red-600 bg-red-50 rounded-lg px-4 py-3 mb-6 text-sm">{error}</p>}
            <form onSubmit={handleDatos} className="space-y-5">
              {[
                { field: "nombre", label: "Nombre completo", placeholder: "Ej. María García López" },
                { field: "cargo", label: "Cargo", placeholder: "Ej. Gerente de Operaciones" },
                { field: "area", label: "Área / Departamento", placeholder: "Ej. Recursos Humanos" },
                { field: "empresa", label: "Empresa", placeholder: "MINDTALENT" },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={datos[field as keyof typeof datos]}
                    onChange={(e) => setDatos((p) => ({ ...p, [field]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </div>
              ))}
              <button
                type="submit"
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
                style={{ background: "#1a2035" }}
              >
                Comenzar cuestionario →
              </button>
            </form>
          </div>
        )}

        {/* ── PASO 2: FOTO ── */}
        {paso === "foto" && (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Foto del evaluado</h2>
            <p className="text-gray-500 text-sm mb-6">
              Opcional — Activa tu cámara para registrar una foto que quedará en tu informe.
            </p>
            {error && <p className="text-red-600 bg-red-50 rounded-lg px-4 py-3 mb-4 text-sm">{error}</p>}

            {!foto && !camaraActiva && (
              <div className="space-y-3">
                <button
                  onClick={activarCamara}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 text-white"
                  style={{ background: "#1a2035" }}
                >
                  📷 Activar cámara
                </button>
                <button
                  onClick={continuarSinFoto}
                  className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Continuar sin foto
                </button>
              </div>
            )}

            {camaraActiva && !foto && (
              <div className="space-y-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-xl"
                  style={{ maxHeight: 320, objectFit: "cover" }}
                />
                <button
                  onClick={tomarFoto}
                  className="w-full py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: "#c9a84c", color: "#1a2035" }}
                >
                  📸 Tomar foto
                </button>
                <button onClick={continuarSinFoto} className="w-full py-2 text-sm text-gray-500 underline">
                  Continuar sin foto
                </button>
              </div>
            )}

            {foto && (
              <div className="space-y-4">
                <img src={foto} alt="Foto evaluado" className="w-48 h-48 object-cover rounded-full mx-auto border-4" style={{ borderColor: "#c9a84c" }} />
                <p className="text-green-600 font-semibold text-sm">Foto capturada correctamente</p>
                <div className="flex gap-3">
                  <button onClick={retomar} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50">
                    Retomar
                  </button>
                  <button
                    onClick={continuarConFoto}
                    className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90"
                    style={{ background: "#1a2035" }}
                  >
                    Continuar →
                  </button>
                </div>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {/* ── PASO 3: ÍTEMS (una dimensión por vez) ── */}
        {(paso === "items" || paso === "enviando") && (
          <>
            {/* Barra de progreso global */}
            <div className="bg-white rounded-xl shadow px-5 py-3 mb-5 flex items-center gap-4">
              <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progreso}%`, background: "#c9a84c", minWidth: progreso > 0 ? 8 : 0 }}
                />
              </div>
              <span className="text-sm font-bold whitespace-nowrap text-gray-800">{totalRespondidos}/60</span>
            </div>

            {/* Indicador de dimensión actual */}
            <div className="flex gap-2 mb-5 justify-center">
              {DIMS.map((d, i) => (
                <div
                  key={d}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={
                    i === dimActual
                      ? { background: "#1a2035", color: "#c9a84c" }
                      : i < dimActual
                      ? { background: "#e7f3e8", color: "#16a34a" }
                      : { background: "#f3f4f6", color: "#9ca3af" }
                  }
                >
                  {i < dimActual ? "✓" : `${i + 1}`} {DIMENSIONS[d]}
                </div>
              ))}
            </div>

            {error && <p className="text-red-600 bg-red-50 rounded-lg px-4 py-3 mb-5 text-sm">{error}</p>}

            {/* Cabecera de la dimensión */}
            <div className="rounded-xl px-5 py-4 mb-5" style={{ background: "#1a2035" }}>
              <p className="text-white text-xs opacity-60 mb-0.5">Dimensión {dimActual + 1} de 4</p>
              <span className="text-white font-bold">
                {dimData.code}. {dimData.label.toUpperCase()}
              </span>
              <p className="text-white text-xs opacity-60 mt-1">
                {respondidosDim}/{itemsDimActual.length} ítems respondidos en esta dimensión
              </p>
            </div>

            <p className="text-xs text-gray-500 mb-5 text-center">
              <strong>1</strong> = Totalmente en desacuerdo · <strong>5</strong> = Totalmente de acuerdo
            </p>

            {dimData.subscales.map((sub) => (
              <div key={sub.code} className="mb-6">
                <p className="text-xs font-bold uppercase tracking-widest mb-3 px-1" style={{ color: "#c9a84c" }}>
                  {sub.code}. {sub.label}
                </p>
                {sub.items.map((item) => {
                  const selected = respuestas[String(item.id)];
                  return (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 mb-3">
                      <p className="text-sm font-medium text-gray-900 mb-3">
                        <span className="font-bold text-gray-400 mr-2">{item.id}.</span>
                        {item.text}
                      </p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {OPCIONES.map((op) => (
                          <button
                            key={op.valor}
                            onClick={() => handleRespuesta(item.id, op.valor)}
                            title={op.label}
                            className="flex flex-col items-center py-2.5 px-1 rounded-lg border-2 text-xs transition-all"
                            style={
                              selected === op.valor
                                ? { background: "#1a2035", borderColor: "#c9a84c", color: "#c9a84c", fontWeight: 700 }
                                : { borderColor: "#e5e7eb", color: "#374151", background: "#f9fafb" }
                            }
                          >
                            <span className="text-lg font-bold leading-none">{op.valor}</span>
                            <span className="hidden sm:block text-center leading-tight mt-1" style={{ fontSize: "0.6rem" }}>
                              {op.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Navegación entre dimensiones */}
            <div className="flex gap-3 mt-6">
              {dimActual > 0 && (
                <button
                  onClick={handleAnteriorDim}
                  className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50"
                >
                  ← Dimensión anterior
                </button>
              )}
              {dimActual < 3 ? (
                <button
                  onClick={handleSiguienteDim}
                  className="flex-1 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90"
                  style={{ background: "#1a2035" }}
                >
                  Siguiente dimensión →
                </button>
              ) : (
                <button
                  onClick={handleEnviar}
                  disabled={paso === "enviando"}
                  className="flex-1 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#c9a84c", color: "#1a2035" }}
                >
                  {paso === "enviando" ? "Procesando..." : "Enviar y ver resultados →"}
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

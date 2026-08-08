"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import AntiFraudeMonitor from "@/components/mindeval/AntiFraudeMonitor";
import { BATERIAS_EJEMPLO } from "@/lib/mindeval-baterias";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

const DURACION_MIN: Record<string, number> = { tecnica: 90, psicometrica: 30 };

interface DatosTecnica {
  tipo: "tecnica";
  candidato_id: string;
  candidato_nombre: string;
  caso_generado: string;
  criterios: { analisis: number; estrategia: number; kpis: number; claridad: number };
}
interface DatosPsicometrica {
  tipo: "psicometrica";
  candidato_id: string;
  candidato_nombre: string;
  items: Record<string, string[]>;
}

function useCuentaRegresiva(minutos: number, activo: boolean, onAgotado: () => void) {
  const [segundos, setSegundos] = useState(minutos * 60);
  const disparado = useRef(false);

  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => {
      setSegundos((s) => {
        if (s <= 1 && !disparado.current) {
          disparado.current = true;
          onAgotado();
        }
        return Math.max(0, s - 1);
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  const mm = String(Math.floor(segundos / 60)).padStart(2, "0");
  const ss = String(segundos % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function PruebaTokenPage() {
  const { token } = useParams<{ token: string }>();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [datos, setDatos] = useState<DatosTecnica | DatosPsicometrica | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [respuestaTecnica, setRespuestaTecnica] = useState("");
  const [respuestasPsico, setRespuestasPsico] = useState<Record<string, number[]>>({});

  useEffect(() => {
    fetch(`/api/mindeval-prueba/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? "Este link no es válido.");
        }
        return r.json();
      })
      .then((d) => {
        setDatos(d);
        if (d.tipo === "psicometrica") {
          const iniciales: Record<string, number[]> = {};
          Object.keys(d.items).forEach((k) => {
            iniciales[k] = d.items[k].map(() => 3);
          });
          setRespuestasPsico(iniciales);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  async function enviar() {
    if (!datos) return;
    setEnviando(true);
    setError("");
    try {
      const body =
        datos.tipo === "tecnica" ? { respuesta_candidato: respuestaTecnica } : { respuestas: respuestasPsico };
      const res = await fetch(`/api/mindeval-prueba/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la prueba.");
    } finally {
      setEnviando(false);
    }
  }

  const duracion = datos ? DURACION_MIN[datos.tipo] : 30;
  const tiempo = useCuentaRegresiva(duracion, !!datos && !enviado, () => enviar());

  if (cargando) return null;

  if (error && !datos) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FA" }}>
        <div style={{ textAlign: "center", color: "#C4402F", maxWidth: 380, padding: 20 }}>{error}</div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FA", padding: 20 }}>
        <div style={{ textAlign: "center", background: "#FFFFFF", padding: "3rem 2rem", borderRadius: 16, maxWidth: 420 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <h2 style={{ color: NAVY, marginBottom: 8 }}>Prueba enviada</h2>
          <p style={{ color: "#7C89A8", fontSize: 13.5 }}>
            Gracias, {datos?.candidato_nombre}. El equipo de reclutamiento revisará tus resultados y te contactará
            con los siguientes pasos.
          </p>
        </div>
      </div>
    );
  }

  if (!datos) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, color: "#FFFFFF", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 1.2, color: GOLD, fontWeight: 700 }}>MINDEVAL · BY MINDTALENT</div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{datos.tipo === "tecnica" ? "Prueba Técnica" : "Prueba Psicométrica"}</div>
        </div>
        <div style={{ marginLeft: "auto", background: "rgba(255,255,255,0.1)", padding: "8px 16px", borderRadius: 8, fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
          ⏱ {tiempo}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem" }}>
        {error && <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}

        <div style={{ marginBottom: 16 }}>
          <AntiFraudeMonitor candidatoId={datos.candidato_id} sesionTipo={datos.tipo === "tecnica" ? "tecnica" : "psicometricas"} />
        </div>

        {datos.tipo === "tecnica" ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 22 }}>
            <div style={{ background: NAVY, color: "#FFFFFF", borderRadius: 10, padding: 18, marginBottom: 16, fontSize: 14, lineHeight: 1.6 }}>
              {datos.caso_generado}
            </div>
            <div style={{ fontSize: 11.5, color: "#7C89A8", marginBottom: 12 }}>
              Criterios de evaluación: Análisis {datos.criterios.analisis} · Estrategia {datos.criterios.estrategia} ·
              KPIs {datos.criterios.kpis} · Claridad {datos.criterios.claridad}
            </div>
            <textarea
              value={respuestaTecnica}
              onChange={(e) => setRespuestaTecnica(e.target.value)}
              placeholder="Escribe tu respuesta aquí…"
              style={{ width: "100%", minHeight: 260, padding: 14, border: "1.5px solid #D5DCEB", borderRadius: 10, fontSize: 13.5, boxSizing: "border-box", marginBottom: 14 }}
            />
            <button
              onClick={enviar}
              disabled={enviando || !respuestaTecnica.trim()}
              style={{ background: GOLD, color: NAVY, border: "none", padding: "12px 22px", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: enviando ? 0.6 : 1 }}
            >
              {enviando ? "Enviando…" : "Enviar respuesta"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#FFFBEF", border: "1px solid #F3E0AE", borderRadius: 10, padding: 12, fontSize: 12, color: "#8A6400" }}>
              Batería de ejemplo — mientras se integra el banco real de reactivos.
            </div>
            {Object.entries(datos.items).map(([bateriaKey, items]) => (
              <div key={bateriaKey} style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 20 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 14, color: NAVY }}>
                  {BATERIAS_EJEMPLO.find((b) => b.key === bateriaKey)?.nombre ?? bateriaKey}
                </h3>
                {items.map((texto, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12.5, color: "#41507A", marginBottom: 6 }}>{texto}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          onClick={() =>
                            setRespuestasPsico((prev) => {
                              const arr = [...(prev[bateriaKey] ?? [])];
                              arr[i] = v;
                              return { ...prev, [bateriaKey]: arr };
                            })
                          }
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            border: respuestasPsico[bateriaKey]?.[i] === v ? `2px solid ${GOLD}` : "1.5px solid #D5DCEB",
                            background: respuestasPsico[bateriaKey]?.[i] === v ? "#FFFBEF" : "#FFFFFF",
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: NAVY,
                            cursor: "pointer",
                          }}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <button
              onClick={enviar}
              disabled={enviando}
              style={{ background: GOLD, color: NAVY, border: "none", padding: "12px 22px", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: enviando ? 0.6 : 1 }}
            >
              {enviando ? "Enviando…" : "Enviar respuestas"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

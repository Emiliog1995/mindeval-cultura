"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { authHeaders } from "@/lib/auth-headers";
import type { OpcionPregunta, PreguntaBanco, Vacante } from "@/lib/mindeval-types";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";
const LETRAS = ["a", "b", "c", "d"] as const;

const card: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 22, marginBottom: 18 };
const inputStyle: React.CSSProperties = { padding: "8px 10px", border: "1.5px solid #D5DCEB", borderRadius: 7, fontSize: 12.5, boxSizing: "border-box", width: "100%" };
const btnPrimario: React.CSSProperties = { background: NAVY, color: "#FFFFFF", border: "none", padding: "9px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const btnGold: React.CSSProperties = { background: GOLD, color: NAVY, border: "none", padding: "9px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" };
const btnSecundario: React.CSSProperties = { background: "none", border: `1.5px solid ${NAVY}`, color: NAVY, padding: "7px 12px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer" };

interface FormPregunta {
  enunciado: string;
  opciones: Record<string, string>;
  respuesta_correcta: string;
  puntos: number;
}

function formVacio(): FormPregunta {
  return { enunciado: "", opciones: { a: "", b: "", c: "", d: "" }, respuesta_correcta: "a", puntos: 10 };
}

export default function BancoPreguntasVacante() {
  const params = useParams<{ vacanteId: string }>();
  const router = useRouter();
  const { verificando } = useAuthGuard();

  const [vacante, setVacante] = useState<Vacante | null>(null);
  const [preguntas, setPreguntas] = useState<PreguntaBanco[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [cantidad, setCantidad] = useState(10);
  const [generando, setGenerando] = useState(false);

  const [nueva, setNueva] = useState<FormPregunta>(formVacio());
  const [agregando, setAgregando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<FormPregunta>(formVacio());

  useEffect(() => {
    if (verificando) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificando]);

  async function cargar() {
    setLoading(true);
    const [{ data: v }, { data: p }] = await Promise.all([
      supabase.from("mindeval_vacantes").select("*").eq("id", params.vacanteId).single(),
      supabase.from("mindeval_banco_preguntas").select("*").eq("vacante_id", params.vacanteId).order("orden", { ascending: true }).order("created_at", { ascending: true }),
    ]);
    setVacante(v ?? null);
    setPreguntas(p ?? []);
    setLoading(false);
  }

  const activas = preguntas.filter((p) => p.estado === "activa");

  async function generarConIA() {
    setGenerando(true);
    setError("");
    try {
      const res = await fetch("/api/mindeval-generar-banco", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ vacante_id: params.vacanteId, cantidad }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreguntas((prev) => [...prev, ...data.preguntas]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar preguntas con IA");
    } finally {
      setGenerando(false);
    }
  }

  async function agregarManual() {
    if (!nueva.enunciado.trim() || LETRAS.some((l) => !nueva.opciones[l].trim())) {
      setError("Completa el enunciado y las 4 opciones antes de agregar la pregunta.");
      return;
    }
    setAgregando(true);
    setError("");
    try {
      const opciones: OpcionPregunta[] = LETRAS.map((l) => ({ id: l, texto: nueva.opciones[l] }));
      const { data, error: iErr } = await supabase
        .from("mindeval_banco_preguntas")
        .insert({
          vacante_id: params.vacanteId,
          enunciado: nueva.enunciado,
          opciones,
          respuesta_correcta: nueva.respuesta_correcta,
          puntos: nueva.puntos,
          origen: "manual",
          estado: "activa",
        })
        .select()
        .single();
      if (iErr || !data) throw new Error(iErr?.message ?? "No se pudo agregar la pregunta");
      setPreguntas((prev) => [...prev, data]);
      setNueva(formVacio());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al agregar la pregunta");
    } finally {
      setAgregando(false);
    }
  }

  function empezarEdicion(p: PreguntaBanco) {
    const opciones: Record<string, string> = {};
    LETRAS.forEach((l) => (opciones[l] = p.opciones.find((o) => o.id === l)?.texto ?? ""));
    setEdicion({ enunciado: p.enunciado, opciones, respuesta_correcta: p.respuesta_correcta, puntos: p.puntos });
    setEditandoId(p.id);
  }

  async function guardarEdicion(id: string) {
    setError("");
    if (!edicion.enunciado.trim() || LETRAS.some((l) => !edicion.opciones[l].trim())) {
      setError("Completa el enunciado y las 4 opciones antes de guardar.");
      return;
    }
    const opciones: OpcionPregunta[] = LETRAS.map((l) => ({ id: l, texto: edicion.opciones[l] }));
    const { data, error: uErr } = await supabase
      .from("mindeval_banco_preguntas")
      .update({ enunciado: edicion.enunciado, opciones, respuesta_correcta: edicion.respuesta_correcta, puntos: edicion.puntos })
      .eq("id", id)
      .select()
      .single();
    if (uErr || !data) {
      setError(uErr?.message ?? "No se pudo guardar la edición");
      return;
    }
    setPreguntas((prev) => prev.map((p) => (p.id === id ? data : p)));
    setEditandoId(null);
  }

  async function toggleEstado(p: PreguntaBanco) {
    const nuevoEstado = p.estado === "activa" ? "borrador" : "activa";
    const { data } = await supabase.from("mindeval_banco_preguntas").update({ estado: nuevoEstado }).eq("id", p.id).select().single();
    if (data) setPreguntas((prev) => prev.map((x) => (x.id === p.id ? data : x)));
  }

  async function borrar(id: string) {
    if (!window.confirm("¿Borrar esta pregunta del banco? No se puede deshacer.")) return;
    await supabase.from("mindeval_banco_preguntas").delete().eq("id", id);
    setPreguntas((prev) => prev.filter((p) => p.id !== id));
  }

  async function activarBanco() {
    if (!vacante) return;
    await supabase.from("mindeval_vacantes").update({ modo_tecnica: "banco" }).eq("id", vacante.id);
    setVacante({ ...vacante, modo_tecnica: "banco" });
  }

  async function volverACasoAbierto() {
    if (!vacante) return;
    await supabase.from("mindeval_vacantes").update({ modo_tecnica: "caso_abierto" }).eq("id", vacante.id);
    setVacante({ ...vacante, modo_tecnica: "caso_abierto" });
  }

  if (verificando || loading || !vacante) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, color: "#FFFFFF", padding: "1rem 1.5rem" }}>
        <div onClick={() => router.push(`/seleccion/${params.vacanteId}`)} style={{ fontSize: 11.5, color: "#8FA0CC", cursor: "pointer", marginBottom: 6 }}>
          ← Volver al proceso
        </div>
        <div style={{ fontSize: 19, fontWeight: 800 }}>Banco de preguntas técnicas — {vacante.titulo}</div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "1.75rem 1.5rem" }}>
        {error && (
          <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 13 }}>{error}</div>
        )}

        <section style={card}>
          <h2 style={{ margin: "0 0 4px", fontSize: 16, color: NAVY }}>Estado de la etapa técnica</h2>
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#7C89A8" }}>
            {vacante.modo_tecnica === "banco"
              ? "Esta vacante ya usa el banco de preguntas objetivo para calificar la prueba técnica."
              : "Esta vacante todavía usa el caso práctico abierto calificado por IA. Actívalo abajo cuando el banco esté listo."}
          </p>
          {vacante.modo_tecnica === "banco" ? (
            <button onClick={volverACasoAbierto} style={btnSecundario}>Volver al modo de caso abierto</button>
          ) : (
            <button onClick={activarBanco} disabled={activas.length === 0} style={{ ...btnGold, opacity: activas.length === 0 ? 0.5 : 1 }}>
              Activar banco de preguntas para esta vacante
            </button>
          )}
          {vacante.modo_tecnica !== "banco" && activas.length === 0 && (
            <div style={{ fontSize: 11.5, color: "#7C89A8", marginTop: 8 }}>Activa al menos una pregunta abajo para poder encender este modo.</div>
          )}
        </section>

        <section style={card}>
          <h2 style={{ margin: "0 0 4px", fontSize: 16, color: NAVY }}>Generar preguntas con IA</h2>
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#7C89A8" }}>
            Se generan a partir de la misión y competencias duras del Manual de Puestos de esta vacante, como borrador — revísalas y actívalas antes de que lleguen a un candidato.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="number" min={1} max={20} style={{ ...inputStyle, width: 80 }} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
            <button onClick={generarConIA} disabled={generando} style={btnPrimario}>{generando ? "Generando…" : "Generar con IA"}</button>
          </div>
        </section>

        <section style={card}>
          <h2 style={{ margin: "0 0 14px", fontSize: 16, color: NAVY }}>Agregar pregunta manual</h2>
          <div style={{ marginBottom: 10 }}>
            <textarea style={{ ...inputStyle, minHeight: 50 }} placeholder="Enunciado" value={nueva.enunciado} onChange={(e) => setNueva({ ...nueva, enunciado: e.target.value })} />
          </div>
          {LETRAS.map((l) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <input type="radio" checked={nueva.respuesta_correcta === l} onChange={() => setNueva({ ...nueva, respuesta_correcta: l })} />
              <input
                style={inputStyle}
                placeholder={`Opción ${l.toUpperCase()}`}
                value={nueva.opciones[l]}
                onChange={(e) => setNueva({ ...nueva, opciones: { ...nueva.opciones, [l]: e.target.value } })}
              />
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <label style={{ fontSize: 12, color: NAVY, fontWeight: 700 }}>Puntos</label>
            <input type="number" style={{ ...inputStyle, width: 80 }} value={nueva.puntos} onChange={(e) => setNueva({ ...nueva, puntos: Number(e.target.value) })} />
            <button onClick={agregarManual} disabled={agregando} style={{ ...btnPrimario, marginLeft: "auto" }}>Agregar pregunta</button>
          </div>
        </section>

        <section style={card}>
          <h2 style={{ margin: "0 0 14px", fontSize: 16, color: NAVY }}>Preguntas del banco ({preguntas.length})</h2>
          {preguntas.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#7C89A8" }}>Todavía no hay preguntas — genera con IA o agrega una manual arriba.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {preguntas.map((p) =>
                editandoId === p.id ? (
                  <div key={p.id} style={{ padding: 14, background: "#F7F9FD", borderRadius: 10 }}>
                    <textarea style={{ ...inputStyle, minHeight: 50, marginBottom: 8 }} value={edicion.enunciado} onChange={(e) => setEdicion({ ...edicion, enunciado: e.target.value })} />
                    {LETRAS.map((l) => (
                      <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <input type="radio" checked={edicion.respuesta_correcta === l} onChange={() => setEdicion({ ...edicion, respuesta_correcta: l })} />
                        <input style={inputStyle} value={edicion.opciones[l]} onChange={(e) => setEdicion({ ...edicion, opciones: { ...edicion.opciones, [l]: e.target.value } })} />
                      </div>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                      <label style={{ fontSize: 12, color: NAVY, fontWeight: 700 }}>Puntos</label>
                      <input type="number" style={{ ...inputStyle, width: 80 }} value={edicion.puntos} onChange={(e) => setEdicion({ ...edicion, puntos: Number(e.target.value) })} />
                      <button onClick={() => guardarEdicion(p.id)} style={{ ...btnPrimario, marginLeft: "auto" }}>Guardar</button>
                      <button onClick={() => setEditandoId(null)} style={btnSecundario}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div key={p.id} style={{ padding: 14, background: "#F7F9FD", borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ background: p.origen === "ia" ? "#EAF0FB" : "#E8F6EF", color: p.origen === "ia" ? "#2E4A96" : "#12805C", fontWeight: 700, fontSize: 10.5, padding: "3px 9px", borderRadius: 20 }}>
                        {p.origen === "ia" ? "IA" : "Manual"}
                      </span>
                      <span style={{ background: p.estado === "activa" ? "#E8F6EF" : "#FFF6DE", color: p.estado === "activa" ? "#12805C" : "#8A6400", fontWeight: 700, fontSize: 10.5, padding: "3px 9px", borderRadius: 20 }}>
                        {p.estado === "activa" ? "Activa" : "Borrador"}
                      </span>
                      <span style={{ fontSize: 11, color: "#7C89A8" }}>{p.puntos} pts</span>
                      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                        <button onClick={() => toggleEstado(p)} style={btnSecundario}>{p.estado === "activa" ? "Pasar a borrador" : "Activar"}</button>
                        <button onClick={() => empezarEdicion(p)} style={btnSecundario}>Editar</button>
                        <button onClick={() => borrar(p.id)} style={{ ...btnSecundario, borderColor: "#C4402F", color: "#C4402F" }}>Borrar</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{p.enunciado}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      {p.opciones.map((o) => (
                        <div key={o.id} style={{ fontSize: 12, color: o.id === p.respuesta_correcta ? "#12805C" : "#41507A", fontWeight: o.id === p.respuesta_correcta ? 700 : 400 }}>
                          {o.id.toUpperCase()}) {o.texto} {o.id === p.respuesta_correcta ? "✓" : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

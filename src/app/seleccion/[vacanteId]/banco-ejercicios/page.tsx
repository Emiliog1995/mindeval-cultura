"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { authHeaders } from "@/lib/auth-headers";
import type { EjercicioBanco, Vacante } from "@/lib/mindeval-types";

const NAVY = "#1B2A5B";

const card: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 22, marginBottom: 18 };
const inputStyle: React.CSSProperties = { padding: "8px 10px", border: "1.5px solid #D5DCEB", borderRadius: 7, fontSize: 12.5, boxSizing: "border-box", width: "100%" };
const btnPrimario: React.CSSProperties = { background: NAVY, color: "#FFFFFF", border: "none", padding: "9px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const btnSecundario: React.CSSProperties = { background: "none", border: `1.5px solid ${NAVY}`, color: NAVY, padding: "7px 12px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer" };

interface FormEjercicio {
  competencia: string;
  enunciado: string;
  criterios_evaluacion: string;
}

function formVacio(): FormEjercicio {
  return { competencia: "", enunciado: "", criterios_evaluacion: "" };
}

export default function BancoEjerciciosVacante() {
  const params = useParams<{ vacanteId: string }>();
  const router = useRouter();
  const { verificando } = useAuthGuard();

  const [vacante, setVacante] = useState<Vacante | null>(null);
  const [ejercicios, setEjercicios] = useState<EjercicioBanco[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [cantidad, setCantidad] = useState(5);
  const [generando, setGenerando] = useState(false);

  const [nuevo, setNuevo] = useState<FormEjercicio>(formVacio());
  const [agregando, setAgregando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<FormEjercicio>(formVacio());

  useEffect(() => {
    if (verificando) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificando]);

  async function cargar() {
    setLoading(true);
    const [{ data: v }, { data: e }] = await Promise.all([
      supabase.from("mindeval_vacantes").select("*").eq("id", params.vacanteId).single(),
      supabase.from("mindeval_banco_ejercicios").select("*").eq("vacante_id", params.vacanteId).order("orden", { ascending: true }).order("created_at", { ascending: true }),
    ]);
    setVacante(v ?? null);
    setEjercicios(e ?? []);
    setLoading(false);
  }

  const activos = ejercicios.filter((e) => e.estado === "activa");

  async function generarConIA() {
    setGenerando(true);
    setError("");
    try {
      const res = await fetch("/api/mindeval-generar-ejercicios", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ vacante_id: params.vacanteId, cantidad }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEjercicios((prev) => [...prev, ...data.ejercicios]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar ejercicios con IA");
    } finally {
      setGenerando(false);
    }
  }

  async function agregarManual() {
    if (!nuevo.competencia.trim() || !nuevo.enunciado.trim() || !nuevo.criterios_evaluacion.trim()) {
      setError("Completa competencia, enunciado y rúbrica antes de agregar el ejercicio.");
      return;
    }
    setAgregando(true);
    setError("");
    try {
      const { data, error: iErr } = await supabase
        .from("mindeval_banco_ejercicios")
        .insert({
          vacante_id: params.vacanteId,
          competencia: nuevo.competencia,
          enunciado: nuevo.enunciado,
          criterios_evaluacion: nuevo.criterios_evaluacion,
          origen: "manual",
          estado: "activa",
        })
        .select()
        .single();
      if (iErr || !data) throw new Error(iErr?.message ?? "No se pudo agregar el ejercicio");
      setEjercicios((prev) => [...prev, data]);
      setNuevo(formVacio());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al agregar el ejercicio");
    } finally {
      setAgregando(false);
    }
  }

  function empezarEdicion(e: EjercicioBanco) {
    setEdicion({ competencia: e.competencia, enunciado: e.enunciado, criterios_evaluacion: e.criterios_evaluacion });
    setEditandoId(e.id);
  }

  async function guardarEdicion(id: string) {
    setError("");
    if (!edicion.competencia.trim() || !edicion.enunciado.trim() || !edicion.criterios_evaluacion.trim()) {
      setError("Completa competencia, enunciado y rúbrica antes de guardar.");
      return;
    }
    const { data, error: uErr } = await supabase
      .from("mindeval_banco_ejercicios")
      .update({ competencia: edicion.competencia, enunciado: edicion.enunciado, criterios_evaluacion: edicion.criterios_evaluacion })
      .eq("id", id)
      .select()
      .single();
    if (uErr || !data) {
      setError(uErr?.message ?? "No se pudo guardar la edición");
      return;
    }
    setEjercicios((prev) => prev.map((e) => (e.id === id ? data : e)));
    setEditandoId(null);
  }

  async function toggleEstado(e: EjercicioBanco) {
    const nuevoEstado = e.estado === "activa" ? "borrador" : "activa";
    const { data } = await supabase.from("mindeval_banco_ejercicios").update({ estado: nuevoEstado }).eq("id", e.id).select().single();
    if (data) setEjercicios((prev) => prev.map((x) => (x.id === e.id ? data : x)));
  }

  async function borrar(id: string) {
    if (!window.confirm("¿Borrar este ejercicio del banco? No se puede deshacer.")) return;
    await supabase.from("mindeval_banco_ejercicios").delete().eq("id", id);
    setEjercicios((prev) => prev.filter((e) => e.id !== id));
  }

  if (verificando || loading || !vacante) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, color: "#FFFFFF", padding: "1rem 1.5rem" }}>
        <div onClick={() => router.push(`/seleccion/${params.vacanteId}`)} style={{ fontSize: 11.5, color: "#8FA0CC", cursor: "pointer", marginBottom: 6 }}>
          ← Volver al proceso
        </div>
        <div style={{ fontSize: 19, fontWeight: 800 }}>Banco de ejercicios Assessment Center — {vacante.titulo}</div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "1.75rem 1.5rem" }}>
        {error && (
          <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 13 }}>{error}</div>
        )}

        <section style={card}>
          <h2 style={{ margin: "0 0 4px", fontSize: 16, color: NAVY }}>Estado</h2>
          <p style={{ margin: 0, fontSize: 12.5, color: "#7C89A8" }}>
            {activos.length > 0
              ? `${activos.length} ejercicio(s) activo(s) — ya puedes agendar Assessment Center al candidato desde su perfil.`
              : "Agrega y activa al menos un ejercicio para poder agendar Assessment Center a un candidato. El registro manual de evaluaciones sigue disponible siempre, con o sin banco."}
          </p>
        </section>

        <section style={card}>
          <h2 style={{ margin: "0 0 4px", fontSize: 16, color: NAVY }}>Generar ejercicios con IA</h2>
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#7C89A8" }}>
            Se generan a partir de la misión y competencias blandas del Manual de Puestos de esta vacante, como borrador — revísalos y actívalos antes de que lleguen a un candidato.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="number" min={1} max={12} style={{ ...inputStyle, width: 80 }} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
            <button onClick={generarConIA} disabled={generando} style={btnPrimario}>{generando ? "Generando…" : "Generar con IA"}</button>
          </div>
        </section>

        <section style={card}>
          <h2 style={{ margin: "0 0 14px", fontSize: 16, color: NAVY }}>Agregar ejercicio manual</h2>
          <div style={{ marginBottom: 10 }}>
            <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Competencia (ej. Manejo de conflicto)" value={nuevo.competencia} onChange={(e) => setNuevo({ ...nuevo, competencia: e.target.value })} />
            <textarea style={{ ...inputStyle, minHeight: 60, marginBottom: 8 }} placeholder="Enunciado del escenario" value={nuevo.enunciado} onChange={(e) => setNuevo({ ...nuevo, enunciado: e.target.value })} />
            <textarea style={{ ...inputStyle, minHeight: 50 }} placeholder="Rúbrica: qué debe incluir una buena respuesta" value={nuevo.criterios_evaluacion} onChange={(e) => setNuevo({ ...nuevo, criterios_evaluacion: e.target.value })} />
          </div>
          <button onClick={agregarManual} disabled={agregando} style={btnPrimario}>Agregar ejercicio</button>
        </section>

        <section style={card}>
          <h2 style={{ margin: "0 0 14px", fontSize: 16, color: NAVY }}>Ejercicios del banco ({ejercicios.length})</h2>
          {ejercicios.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#7C89A8" }}>Todavía no hay ejercicios — genera con IA o agrega uno manual arriba.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ejercicios.map((e) =>
                editandoId === e.id ? (
                  <div key={e.id} style={{ padding: 14, background: "#F7F9FD", borderRadius: 10 }}>
                    <input style={{ ...inputStyle, marginBottom: 8 }} value={edicion.competencia} onChange={(ev) => setEdicion({ ...edicion, competencia: ev.target.value })} />
                    <textarea style={{ ...inputStyle, minHeight: 60, marginBottom: 8 }} value={edicion.enunciado} onChange={(ev) => setEdicion({ ...edicion, enunciado: ev.target.value })} />
                    <textarea style={{ ...inputStyle, minHeight: 50, marginBottom: 8 }} value={edicion.criterios_evaluacion} onChange={(ev) => setEdicion({ ...edicion, criterios_evaluacion: ev.target.value })} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => guardarEdicion(e.id)} style={btnPrimario}>Guardar</button>
                      <button onClick={() => setEditandoId(null)} style={btnSecundario}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div key={e.id} style={{ padding: 14, background: "#F7F9FD", borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ background: e.origen === "ia" ? "#EAF0FB" : "#E8F6EF", color: e.origen === "ia" ? "#2E4A96" : "#12805C", fontWeight: 700, fontSize: 10.5, padding: "3px 9px", borderRadius: 20 }}>
                        {e.origen === "ia" ? "IA" : "Manual"}
                      </span>
                      <span style={{ background: e.estado === "activa" ? "#E8F6EF" : "#FFF6DE", color: e.estado === "activa" ? "#12805C" : "#8A6400", fontWeight: 700, fontSize: 10.5, padding: "3px 9px", borderRadius: 20 }}>
                        {e.estado === "activa" ? "Activa" : "Borrador"}
                      </span>
                      <span style={{ fontSize: 11, color: "#7C89A8", fontWeight: 700 }}>{e.competencia}</span>
                      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                        <button onClick={() => toggleEstado(e)} style={btnSecundario}>{e.estado === "activa" ? "Pasar a borrador" : "Activar"}</button>
                        <button onClick={() => empezarEdicion(e)} style={btnSecundario}>Editar</button>
                        <button onClick={() => borrar(e.id)} style={{ ...btnSecundario, borderColor: "#C4402F", color: "#C4402F" }}>Borrar</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: NAVY, marginBottom: 6 }}>{e.enunciado}</div>
                    <div style={{ fontSize: 11.5, color: "#7C89A8" }}>Rúbrica: {e.criterios_evaluacion}</div>
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

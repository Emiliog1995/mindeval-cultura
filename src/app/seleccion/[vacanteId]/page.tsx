"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { authHeaders } from "@/lib/auth-headers";
import { calcularIdoneidadGlobal, categoriaSten, promedio } from "@/lib/mindeval-scoring";
import { resolverPerfilCargo } from "@/lib/mindeval-perfil";
import {
  ETAPAS,
  labelEtapa,
  vacanteAceptaPostulaciones,
  type Candidato,
  type EtapaCandidato,
  type TipoSesionPrueba,
  type Vacante,
} from "@/lib/mindeval-types";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

interface CandidatoConScore extends Candidato {
  matchCv?: number;
  stenPromedio?: number;
  tecnicaTotal?: number;
  assessmentPromedio?: number;
  idoneidad: number | null;
}

export default function ProcesoVacante() {
  const params = useParams<{ vacanteId: string }>();
  const router = useRouter();
  const { verificando } = useAuthGuard();

  const [vacante, setVacante] = useState<Vacante | null>(null);
  const [candidatos, setCandidatos] = useState<CandidatoConScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevoCv, setNuevoCv] = useState("");
  const [guardandoAlta, setGuardandoAlta] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [tipoLote, setTipoLote] = useState<TipoSesionPrueba>("psicometrica");
  const [fechaLote, setFechaLote] = useState("");
  const [agendandoLote, setAgendandoLote] = useState(false);
  const [resultadoLote, setResultadoLote] = useState<{ nombre: string; ok: boolean; motivo?: string }[]>([]);

  const [recalculando, setRecalculando] = useState(false);
  const [resultadoRecalculo, setResultadoRecalculo] = useState("");

  useEffect(() => {
    if (verificando) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificando, params.vacanteId]);

  async function cargar() {
    setLoading(true);
    const { data: v, error: vErr } = await supabase.from("mindeval_vacantes").select("*").eq("id", params.vacanteId).single();
    if (vErr || !v) {
      setError("No se encontró la vacante.");
      setLoading(false);
      return;
    }
    setVacante(v);

    const { data: cands } = await supabase
      .from("mindeval_candidatos")
      .select("*")
      .eq("vacante_id", params.vacanteId)
      .order("created_at", { ascending: false });

    const lista = cands ?? [];
    const ids = lista.map((c) => c.id);

    const [matches, psico, tecnicas, assess] = await Promise.all([
      ids.length ? supabase.from("mindeval_cv_matches").select("candidato_id, match_pct, generado_en").in("candidato_id", ids) : { data: [] },
      ids.length ? supabase.from("mindeval_pruebas_psicometricas").select("candidato_id, bateria, sten").in("candidato_id", ids) : { data: [] },
      ids.length ? supabase.from("mindeval_pruebas_tecnicas").select("candidato_id, puntaje_total").in("candidato_id", ids) : { data: [] },
      ids.length ? supabase.from("mindeval_assessment_evaluaciones").select("candidato_id, puntaje").in("candidato_id", ids) : { data: [] },
    ]);

    const conScore: CandidatoConScore[] = lista.map((c) => {
      const matchesC = (matches.data ?? []).filter((m: { candidato_id: string }) => m.candidato_id === c.id);
      const matchCv = matchesC.length ? matchesC[matchesC.length - 1].match_pct : undefined;

      const stenValores = (psico.data ?? [])
        // el conteo ipsativo de KOSTICK (0-9), el segmento de DISC (1-7) y el
        // puntaje estándar de VALANTI (media 50/DE 10) no son un STEN normado
        // — mezclarlos en este promedio daría un número sin sentido, se
        // excluyen del cálculo.
        .filter(
          (p: { candidato_id: string; bateria: string; sten: number | null }) =>
            p.candidato_id === c.id &&
            p.sten !== null &&
            !p.bateria.startsWith("kostick_") &&
            !p.bateria.startsWith("disc_") &&
            !p.bateria.startsWith("valanti_")
        )
        .map((p: { sten: number }) => p.sten);
      const stenPromedio = promedio(stenValores);

      const tecnicasC = (tecnicas.data ?? []).filter((t: { candidato_id: string }) => t.candidato_id === c.id);
      const tecnicaTotal = tecnicasC.length ? tecnicasC[tecnicasC.length - 1].puntaje_total : undefined;

      const assessValores = (assess.data ?? [])
        .filter((a: { candidato_id: string }) => a.candidato_id === c.id)
        .map((a: { puntaje: number }) => a.puntaje);
      const assessmentPromedio = promedio(assessValores);

      return {
        ...c,
        matchCv,
        stenPromedio,
        tecnicaTotal,
        assessmentPromedio,
        idoneidad: calcularIdoneidadGlobal({ matchCv, stenPromedio, tecnicaTotal, assessmentPromedio }),
      };
    });

    conScore.sort((a, b) => (b.idoneidad ?? -1) - (a.idoneidad ?? -1));
    setCandidatos(conScore);
    setLoading(false);
  }

  async function altaCandidato() {
    if (!nuevoNombre.trim()) return;
    setGuardandoAlta(true);
    try {
      await supabase.from("mindeval_candidatos").insert({
        vacante_id: params.vacanteId,
        nombre_completo: nuevoNombre,
        email: nuevoEmail || null,
        cv_texto: nuevoCv || null,
      });
      setNuevoNombre("");
      setNuevoEmail("");
      setNuevoCv("");
      setMostrarAlta(false);
      await cargar();
    } finally {
      setGuardandoAlta(false);
    }
  }

  function copiarLinkPostulacion() {
    const url = `${window.location.origin}/seleccion/${params.vacanteId}/postular`;
    navigator.clipboard.writeText(url);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  }

  function toggleSeleccionado(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function agendarLote() {
    if (!fechaLote || seleccionados.size === 0) return;
    setAgendandoLote(true);
    setResultadoLote([]);
    try {
      const res = await fetch("/api/mindeval-agendar-prueba", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          vacante_id: params.vacanteId,
          tipo: tipoLote,
          fecha_programada: new Date(fechaLote).toISOString(),
          candidato_ids: Array.from(seleccionados),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultadoLote(data.resultados ?? []);
      setSeleccionados(new Set());
      setFechaLote("");
    } catch (e) {
      setResultadoLote([{ nombre: "Error", ok: false, motivo: e instanceof Error ? e.message : "No se pudo agendar el lote" }]);
    } finally {
      setAgendandoLote(false);
    }
  }

  async function recalcularPendientes() {
    if (!vacante) return;
    const sinTexto = candidatos.filter((c) => c.matchCv === undefined && !c.cv_texto?.trim() && c.cv_url);
    const conTexto = candidatos.filter((c) => c.matchCv === undefined && c.cv_texto?.trim());
    if (!sinTexto.length && !conTexto.length) {
      setResultadoRecalculo("No hay candidatos pendientes de calcular.");
      return;
    }
    setRecalculando(true);
    setResultadoRecalculo("");
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      let ok = 0;

      // Candidatos cuyo archivo se subió pero nunca se pudo extraer texto la
      // primera vez (ej. el servidor se reinició a mitad de la postulación):
      // se reintenta la extracción completa en el servidor.
      for (const c of sinTexto) {
        try {
          const res = await fetch("/api/mindeval-reextraer-cv", { method: "POST", headers, body: JSON.stringify({ candidato_id: c.id }) });
          if (res.ok) ok += 1;
        } catch {
          // seguir con el resto del lote aunque uno falle
        }
      }

      const perfil = await resolverPerfilCargo(supabase, vacante);
      for (const c of conTexto) {
        try {
          const res = await fetch("/api/mindeval-cv-match", {
            method: "POST",
            headers,
            body: JSON.stringify({ cv_texto: c.cv_texto, perfil_cargo: perfil }),
          });
          const data = await res.json();
          if (!res.ok) continue;

          await supabase.from("mindeval_cv_matches").insert({ candidato_id: c.id, match_pct: data.match_pct, razones: data.razones });

          const faltante = (data.razones ?? []).find((r: { excluyente?: boolean; cumple: boolean }) => r.excluyente && !r.cumple);
          const descartar = !!faltante || data.match_pct < vacante.corte_match_cv;
          const motivo = faltante
            ? `No cumple requisito excluyente: ${faltante.criterio}`
            : descartar
              ? `Match de CV ${data.match_pct}% por debajo del corte de ${vacante.corte_match_cv}%`
              : undefined;

          await supabase
            .from("mindeval_candidatos")
            .update(descartar ? { etapa_actual: "descartado", estado: "descartado", motivo_descarte: motivo } : { etapa_actual: "filtro_cv" })
            .eq("id", c.id);

          ok += 1;
        } catch {
          // seguir con el resto del lote aunque uno falle
        }
      }
      setResultadoRecalculo(`Procesados ${ok} de ${sinTexto.length + conTexto.length} candidatos pendientes.`);
      await cargar();
    } finally {
      setRecalculando(false);
    }
  }

  if (verificando || loading) return null;
  if (error || !vacante) {
    return <div style={{ padding: 40, textAlign: "center", color: "#C4402F" }}>{error}</div>;
  }

  const conteoPorEtapa: Record<EtapaCandidato, number> = ETAPAS.reduce((acc, e) => ({ ...acc, [e.key]: 0 }), {} as Record<EtapaCandidato, number>);
  candidatos.forEach((c) => {
    if (c.etapa_actual in conteoPorEtapa) conteoPorEtapa[c.etapa_actual]++;
  });

  const aceptaPostulaciones = vacanteAceptaPostulaciones(vacante);
  const cerradaPorFecha = vacante.estado === "abierta" && !aceptaPostulaciones;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, color: "#FFFFFF", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: "#8FA0CC" }}>
            {vacante.empresa.toUpperCase()} {vacante.codigo_proceso ? `· ${vacante.codigo_proceso}` : ""}
          </div>
          <div style={{ fontSize: 19, fontWeight: 800 }}>{vacante.titulo}</div>
          {vacante.fecha_limite_postulacion && (
            <div style={{ fontSize: 11, color: "#8FA0CC", marginTop: 4 }}>
              Recibe CVs hasta {new Date(vacante.fecha_limite_postulacion).toLocaleString("es-EC")}
            </div>
          )}
        </div>
        <span
          style={{
            background: aceptaPostulaciones ? "#1E4D3C" : "#26386F",
            color: aceptaPostulaciones ? "#7BE3B4" : "#FFFFFF",
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 20,
          }}
        >
          {cerradaPorFecha ? "CERRADA · FECHA LÍMITE VENCIDA" : vacante.estado.toUpperCase()}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button onClick={() => router.push("/seleccion")} style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}>
            ← Vacantes
          </button>
          <button onClick={copiarLinkPostulacion} style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}>
            {linkCopiado ? "¡Copiado!" : "Copiar link de postulación"}
          </button>
          <button onClick={() => router.push(`/seleccion/${params.vacanteId}/monitoreo`)} style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}>
            Monitoreo en vivo
          </button>
          <button onClick={() => router.push(`/seleccion/${params.vacanteId}/banco-preguntas`)} style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}>
            Banco de preguntas técnicas
          </button>
          <button onClick={() => router.push(`/seleccion/${params.vacanteId}/banco-ejercicios`)} style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}>
            Banco de ejercicios Assessment Center
          </button>
          <button onClick={() => setMostrarAlta(true)} style={{ background: GOLD, color: NAVY, border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            + Añadir candidato
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1150, margin: "0 auto", padding: "1.75rem 1.5rem" }}>
        {mostrarAlta && (
          <section style={{ background: "#FFFFFF", border: `1px solid ${GOLD}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: NAVY }}>Añadir candidato manualmente</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <input placeholder="Nombre completo" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} style={{ padding: 9, border: "1.5px solid #D5DCEB", borderRadius: 8, fontSize: 13 }} />
              <input placeholder="Email (opcional)" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} style={{ padding: 9, border: "1.5px solid #D5DCEB", borderRadius: 8, fontSize: 13 }} />
            </div>
            <textarea placeholder="Pegar texto del CV (opcional, para el match con IA)" value={nuevoCv} onChange={(e) => setNuevoCv(e.target.value)} style={{ width: "100%", minHeight: 80, padding: 9, border: "1.5px solid #D5DCEB", borderRadius: 8, fontSize: 13, boxSizing: "border-box", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={altaCandidato} disabled={guardandoAlta} style={{ background: NAVY, color: "#FFFFFF", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}>
                {guardandoAlta ? "Guardando…" : "Guardar candidato"}
              </button>
              <button onClick={() => setMostrarAlta(false)} style={{ background: "none", border: "1px solid #D5DCEB", padding: "8px 16px", borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </section>
        )}

        <section style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 16, padding: "22px 24px", marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 15.5, fontWeight: 800, color: NAVY }}>Embudo del proceso de selección</h2>
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {ETAPAS.map((e) => (
              <div key={e.key} style={{ flex: "1 1 120px", minWidth: 120, textAlign: "center" }}>
                <div style={{ background: "#F7F9FD", borderRadius: 10, padding: "14px 8px" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: NAVY }}>{conteoPorEtapa[e.key]}</div>
                  <div style={{ fontSize: 10.5, color: "#7C89A8", marginTop: 4, lineHeight: 1.3 }}>{e.label}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: NAVY }}>Ranking de candidatos</h2>
            <span style={{ fontSize: 12, color: "#7C89A8" }}>Idoneidad calculada por IA sobre el Manual de Puestos · descarte automático bajo el corte o requisito excluyente</span>
            <button
              onClick={recalcularPendientes}
              disabled={recalculando}
              style={{ marginLeft: "auto", background: "none", border: `1px solid ${NAVY}`, color: NAVY, fontSize: 11.5, padding: "6px 12px", borderRadius: 6, cursor: "pointer" }}
            >
              {recalculando ? "Procesando…" : "Recalcular candidatos sin match"}
            </button>
          </div>
          {resultadoRecalculo && (
            <div style={{ margin: "0 24px 12px", fontSize: 12, color: "#41507A" }}>{resultadoRecalculo}</div>
          )}

          {seleccionados.size > 0 && (
            <div style={{ margin: "0 24px 16px", background: "#F7F9FD", border: `1px solid ${GOLD}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, marginBottom: 10 }}>
                {seleccionados.size} candidato{seleccionados.size > 1 ? "s" : ""} seleccionado{seleccionados.size > 1 ? "s" : ""} — agendar prueba y enviar correo a todos
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select value={tipoLote} onChange={(e) => setTipoLote(e.target.value as TipoSesionPrueba)} style={{ padding: "8px 10px", border: "1.5px solid #D5DCEB", borderRadius: 7, fontSize: 12.5 }}>
                  <option value="psicometrica">Prueba psicométrica</option>
                  <option value="tecnica">Prueba técnica</option>
                  <option value="assessment">Assessment Center</option>
                </select>
                <input
                  type="datetime-local"
                  value={fechaLote}
                  onChange={(e) => setFechaLote(e.target.value)}
                  style={{ padding: "8px 10px", border: "1.5px solid #D5DCEB", borderRadius: 7, fontSize: 12.5 }}
                />
                <button onClick={agendarLote} disabled={agendandoLote || !fechaLote} style={{ background: NAVY, color: "#FFFFFF", border: "none", padding: "9px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  {agendandoLote ? "Agendando y enviando…" : "Agendar y enviar por correo"}
                </button>
                <button onClick={() => setSeleccionados(new Set())} style={{ background: "none", border: "1px solid #D5DCEB", padding: "9px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}>
                  Limpiar selección
                </button>
              </div>
              {resultadoLote.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  {resultadoLote.map((r, i) => (
                    <div key={i} style={{ fontSize: 11.5, color: r.ok ? "#12805C" : "#C4402F" }}>
                      {r.ok ? "✓" : "✗"} {r.nombre}{r.motivo ? ` — ${r.motivo}` : r.ok ? " — correo enviado" : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr style={{ background: "#F7F9FD" }}>
                  <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#7C89A8" }} />
                  {["#", "Candidato", "% Idoneidad", "Etapa actual", "STEN", "Acciones"].map((h) => (
                    <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#7C89A8" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidatos.map((c, i) => {
                  const descartado = c.etapa_actual === "descartado";
                  return (
                    <tr key={c.id} style={{ borderTop: "1px solid #EEF1F7", opacity: descartado ? 0.55 : 1 }}>
                      <td style={{ padding: "12px 20px" }}>
                        <input type="checkbox" checked={seleccionados.has(c.id)} onChange={() => toggleSeleccionado(c.id)} disabled={descartado} style={{ cursor: descartado ? "not-allowed" : "pointer" }} />
                      </td>
                      <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 800, color: i === 0 && !descartado ? GOLD : "#A7B2CC" }}>
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 700, color: NAVY }}>
                        {c.nombre_completo}
                        {descartado && (
                          <span
                            title={c.motivo_descarte ?? "Descartado automáticamente"}
                            style={{ marginLeft: 8, background: "#FDEDEA", color: "#C4402F", fontWeight: 700, fontSize: 10, padding: "2px 8px", borderRadius: 20 }}
                          >
                            DESCARTADO
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        {c.idoneidad !== null ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 60, height: 7, borderRadius: 6, background: "#EDF0F7", overflow: "hidden" }}>
                              <div style={{ width: `${c.idoneidad}%`, height: "100%", background: GOLD }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 800 }}>{c.idoneidad}%</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#7C89A8" }}>Pendiente</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 20px", fontSize: 12.5, color: "#41507A" }}>{labelEtapa(c.etapa_actual)}</td>
                      <td style={{ padding: "12px 20px", fontSize: 12 }}>
                        {c.stenPromedio !== undefined ? `STEN ${c.stenPromedio.toFixed(1)} · ${categoriaSten(Math.round(c.stenPromedio))}` : "—"}
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <button
                          onClick={() => router.push(`/seleccion/${params.vacanteId}/candidato/${c.id}`)}
                          style={{ background: NAVY, color: "#FFFFFF", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 11.5, cursor: "pointer" }}
                        >
                          Ver perfil
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {candidatos.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#7C89A8", fontSize: 13 }}>
                      Sin candidatos todavía. Comparte el link de postulación o añade uno manualmente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

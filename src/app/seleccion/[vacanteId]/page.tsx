"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { calcularIdoneidadGlobal, categoriaSten, promedio } from "@/lib/mindeval-scoring";
import { ETAPAS, labelEtapa, type Candidato, type EtapaCandidato, type Vacante } from "@/lib/mindeval-types";

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
      ids.length ? supabase.from("mindeval_pruebas_psicometricas").select("candidato_id, sten").in("candidato_id", ids) : { data: [] },
      ids.length ? supabase.from("mindeval_pruebas_tecnicas").select("candidato_id, puntaje_total").in("candidato_id", ids) : { data: [] },
      ids.length ? supabase.from("mindeval_assessment_evaluaciones").select("candidato_id, puntaje").in("candidato_id", ids) : { data: [] },
    ]);

    const conScore: CandidatoConScore[] = lista.map((c) => {
      const matchesC = (matches.data ?? []).filter((m: { candidato_id: string }) => m.candidato_id === c.id);
      const matchCv = matchesC.length ? matchesC[matchesC.length - 1].match_pct : undefined;

      const stenValores = (psico.data ?? [])
        .filter((p: { candidato_id: string; sten: number | null }) => p.candidato_id === c.id && p.sten !== null)
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

  if (verificando || loading) return null;
  if (error || !vacante) {
    return <div style={{ padding: 40, textAlign: "center", color: "#C4402F" }}>{error}</div>;
  }

  const conteoPorEtapa: Record<EtapaCandidato, number> = ETAPAS.reduce((acc, e) => ({ ...acc, [e.key]: 0 }), {} as Record<EtapaCandidato, number>);
  candidatos.forEach((c) => {
    if (c.etapa_actual in conteoPorEtapa) conteoPorEtapa[c.etapa_actual]++;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, color: "#FFFFFF", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: "#8FA0CC" }}>
            {vacante.empresa.toUpperCase()} {vacante.codigo_proceso ? `· ${vacante.codigo_proceso}` : ""}
          </div>
          <div style={{ fontSize: 19, fontWeight: 800 }}>{vacante.titulo}</div>
        </div>
        <span
          style={{
            background: vacante.estado === "abierta" ? "#1E4D3C" : "#26386F",
            color: vacante.estado === "abierta" ? "#7BE3B4" : "#FFFFFF",
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 20,
          }}
        >
          {vacante.estado.toUpperCase()}
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
          <div style={{ padding: "18px 24px 12px", display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: NAVY }}>Ranking de candidatos</h2>
            <span style={{ fontSize: 12, color: "#7C89A8" }}>Idoneidad calculada por IA sobre el Manual de Puestos</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr style={{ background: "#F7F9FD" }}>
                  {["#", "Candidato", "% Idoneidad", "Etapa actual", "STEN", "Acciones"].map((h) => (
                    <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#7C89A8" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidatos.map((c, i) => (
                  <tr key={c.id} style={{ borderTop: "1px solid #EEF1F7" }}>
                    <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 800, color: i === 0 ? GOLD : "#A7B2CC" }}>
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 700, color: NAVY }}>{c.nombre_completo}</td>
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
                ))}
                {candidatos.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#7C89A8", fontSize: 13 }}>
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

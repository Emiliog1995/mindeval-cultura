"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { authHeaders } from "@/lib/auth-headers";
import AntiFraudeMonitor from "@/components/mindeval/AntiFraudeMonitor";
import { BATERIAS_EJEMPLO } from "@/lib/mindeval-baterias";
import { calcularIdoneidadGlobal, categoriaSten, promedio } from "@/lib/mindeval-scoring";
import { resolverPerfilCargo } from "@/lib/mindeval-perfil";
import { ETAPAS, labelEtapa, type Candidato, type EtapaCandidato, type SesionPrueba, type TipoSesionPrueba, type Vacante } from "@/lib/mindeval-types";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

const card: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 22, marginBottom: 18 };
const btnPrimario: React.CSSProperties = { background: NAVY, color: "#FFFFFF", border: "none", padding: "9px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const btnGold: React.CSSProperties = { background: GOLD, color: NAVY, border: "none", padding: "9px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" };
const inputStyle: React.CSSProperties = { padding: "8px 10px", border: "1.5px solid #D5DCEB", borderRadius: 7, fontSize: 12.5, boxSizing: "border-box" };

interface PsicoRow { bateria: string; sten: number | null; percentil: number | null }
interface AssessRow { id: string; ejercicio: string; competencia: string; puntaje: number; evaluador: string | null }
interface EntrevistaRow { fecha: string | null; entrevistadores: string | null; resultado: string | null; notas: string | null }

export default function PerfilCandidatoPage() {
  const params = useParams<{ vacanteId: string; id: string }>();
  const router = useRouter();
  const { verificando } = useAuthGuard();

  const [vacante, setVacante] = useState<Vacante | null>(null);
  const [candidato, setCandidato] = useState<Candidato | null>(null);
  const [cvTexto, setCvTexto] = useState("");
  const [matchCv, setMatchCv] = useState<{ match_pct: number; razones: { criterio: string; cumple: boolean; detalle: string }[] } | null>(null);
  const [calculandoMatch, setCalculandoMatch] = useState(false);

  const [psico, setPsico] = useState<Record<string, number>>({});
  const [guardandoPsico, setGuardandoPsico] = useState(false);
  const [psicoGuardados, setPsicoGuardados] = useState<PsicoRow[]>([]);
  const [mostrarFraudePsico, setMostrarFraudePsico] = useState(false);

  const [caso, setCaso] = useState<{ caso_generado: string; criterios: { analisis: number; estrategia: number; kpis: number; claridad: number } } | null>(null);
  const [generandoCaso, setGenerandoCaso] = useState(false);
  const [respuestaTecnica, setRespuestaTecnica] = useState("");
  const [correccion, setCorreccion] = useState<{ puntaje_analisis: number; puntaje_estrategia: number; puntaje_kpis: number; puntaje_claridad: number; justificacion: string } | null>(null);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [guardandoTecnica, setGuardandoTecnica] = useState(false);
  const [tecnicaGuardada, setTecnicaGuardada] = useState<number | null>(null);
  const [mostrarFraudeTecnica, setMostrarFraudeTecnica] = useState(false);

  const [assessRows, setAssessRows] = useState<AssessRow[]>([]);
  const [nuevoEjercicio, setNuevoEjercicio] = useState("");
  const [nuevaCompetencia, setNuevaCompetencia] = useState("");
  const [nuevoPuntaje, setNuevoPuntaje] = useState(7);
  const [nuevoEvaluador, setNuevoEvaluador] = useState("");

  const [entrevista, setEntrevista] = useState<EntrevistaRow>({ fecha: null, entrevistadores: "", resultado: null, notas: "" });
  const [guardandoEntrevista, setGuardandoEntrevista] = useState(false);

  const [informeIA, setInformeIA] = useState<string | null>(null);
  const [generandoInforme, setGenerandoInforme] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState("");

  const [sesiones, setSesiones] = useState<SesionPrueba[]>([]);
  const [fechaAgendar, setFechaAgendar] = useState<Record<TipoSesionPrueba, string>>({ psicometrica: "", tecnica: "" });
  const [agendando, setAgendando] = useState<Record<TipoSesionPrueba, boolean>>({ psicometrica: false, tecnica: false });
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null);

  useEffect(() => {
    if (verificando) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificando]);

  async function cargar() {
    const [{ data: v }, { data: c }] = await Promise.all([
      supabase.from("mindeval_vacantes").select("*").eq("id", params.vacanteId).single(),
      supabase.from("mindeval_candidatos").select("*").eq("id", params.id).single(),
    ]);
    setVacante(v ?? null);
    setCandidato(c ?? null);
    setCvTexto(c?.cv_texto ?? "");

    const [{ data: match }, { data: ps }, { data: tec }, { data: asse }, { data: entr }] = await Promise.all([
      supabase.from("mindeval_cv_matches").select("match_pct, razones").eq("candidato_id", params.id).order("generado_en", { ascending: false }).limit(1),
      supabase.from("mindeval_pruebas_psicometricas").select("bateria, sten, percentil").eq("candidato_id", params.id),
      supabase.from("mindeval_pruebas_tecnicas").select("puntaje_total").eq("candidato_id", params.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("mindeval_assessment_evaluaciones").select("id, ejercicio, competencia, puntaje, evaluador").eq("candidato_id", params.id),
      supabase.from("mindeval_entrevistas").select("fecha, entrevistadores, resultado, notas").eq("candidato_id", params.id).order("created_at", { ascending: false }).limit(1),
    ]);

    if (match?.[0]) setMatchCv(match[0]);
    setPsicoGuardados(ps ?? []);
    if (tec?.[0]) setTecnicaGuardada(tec[0].puntaje_total);
    setAssessRows(asse ?? []);
    if (entr?.[0]) setEntrevista(entr[0]);

    const { data: informes } = await supabase.from("mindeval_informes_ia").select("contenido").eq("candidato_id", params.id).order("generado_en", { ascending: false }).limit(1);
    if (informes?.[0]) setInformeIA(informes[0].contenido);

    const { data: sess } = await supabase
      .from("mindeval_sesiones_prueba")
      .select("*")
      .eq("candidato_id", params.id)
      .order("created_at", { ascending: false });
    setSesiones(sess ?? []);

    // Recargar resultados de psicométrica/técnica por si el candidato ya
    // completó su prueba agendada (el reclutador nunca ve el examen en vivo,
    // solo el resultado guardado por /api/mindeval-prueba/[token]).
    const [{ data: ps2 }, { data: tec2 }] = await Promise.all([
      supabase.from("mindeval_pruebas_psicometricas").select("bateria, sten, percentil").eq("candidato_id", params.id),
      supabase.from("mindeval_pruebas_tecnicas").select("puntaje_total").eq("candidato_id", params.id).not("respuesta_candidato", "is", null).order("created_at", { ascending: false }).limit(1),
    ]);
    if (ps2?.length) setPsicoGuardados(ps2);
    if (tec2?.[0]) setTecnicaGuardada(tec2[0].puntaje_total);
  }

  async function agendarPrueba(tipo: TipoSesionPrueba) {
    const fecha = fechaAgendar[tipo];
    if (!fecha) return;
    setAgendando((prev) => ({ ...prev, [tipo]: true }));
    try {
      const { data } = await supabase
        .from("mindeval_sesiones_prueba")
        .insert({ candidato_id: params.id, vacante_id: params.vacanteId, tipo, fecha_programada: new Date(fecha).toISOString() })
        .select()
        .single();
      if (data) setSesiones((prev) => [data, ...prev]);
      setFechaAgendar((prev) => ({ ...prev, [tipo]: "" }));
    } finally {
      setAgendando((prev) => ({ ...prev, [tipo]: false }));
    }
  }

  function copiarLinkPrueba(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/seleccion/prueba/${token}`);
    setLinkCopiado(token);
    setTimeout(() => setLinkCopiado(null), 2000);
  }

  async function moverEtapa(nueva: EtapaCandidato) {
    await supabase.from("mindeval_candidatos").update({ etapa_actual: nueva }).eq("id", params.id);
    setCandidato((prev) => (prev ? { ...prev, etapa_actual: nueva } : prev));
  }

  async function calcularMatch() {
    if (!vacante || !cvTexto.trim()) return;
    setCalculandoMatch(true);
    setErrorGlobal("");
    try {
      const perfil = await resolverPerfilCargo(supabase, vacante);
      const res = await fetch("/api/mindeval-cv-match", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ cv_texto: cvTexto, perfil_cargo: perfil }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMatchCv(data);
      await supabase.from("mindeval_candidatos").update({ cv_texto: cvTexto }).eq("id", params.id);
      await supabase.from("mindeval_cv_matches").insert({ candidato_id: params.id, match_pct: data.match_pct, razones: data.razones });
    } catch (e) {
      setErrorGlobal(e instanceof Error ? e.message : "Error al calcular el match de CV");
    } finally {
      setCalculandoMatch(false);
    }
  }

  async function guardarPsicometricas() {
    setGuardandoPsico(true);
    try {
      const filas = Object.entries(psico)
        .filter(([, sten]) => sten >= 1 && sten <= 10)
        .map(([bateria, sten]) => ({
          candidato_id: params.id,
          bateria,
          sten,
          percentil: Math.round(((sten - 1) / 9) * 100),
        }));
      if (filas.length) await supabase.from("mindeval_pruebas_psicometricas").insert(filas);
      const { data: ps } = await supabase.from("mindeval_pruebas_psicometricas").select("bateria, sten, percentil").eq("candidato_id", params.id);
      setPsicoGuardados(ps ?? []);
      setPsico({});
    } finally {
      setGuardandoPsico(false);
    }
  }

  async function generarCaso() {
    if (!vacante) return;
    setGenerandoCaso(true);
    setErrorGlobal("");
    try {
      const perfil = await resolverPerfilCargo(supabase, vacante);
      const res = await fetch("/api/mindeval-generar-caso", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ titulo_vacante: vacante.titulo, perfil_cargo: perfil }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCaso(data);
      setCorreccion(null);
    } catch (e) {
      setErrorGlobal(e instanceof Error ? e.message : "Error al generar el caso técnico");
    } finally {
      setGenerandoCaso(false);
    }
  }

  async function corregirCaso() {
    if (!caso || !respuestaTecnica.trim()) return;
    setCorrigiendo(true);
    setErrorGlobal("");
    try {
      const res = await fetch("/api/mindeval-corregir-caso", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ caso_generado: caso.caso_generado, criterios: caso.criterios, respuesta_candidato: respuestaTecnica }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCorreccion(data);
    } catch (e) {
      setErrorGlobal(e instanceof Error ? e.message : "Error al corregir el caso técnico");
    } finally {
      setCorrigiendo(false);
    }
  }

  async function guardarTecnica() {
    if (!caso || !correccion) return;
    setGuardandoTecnica(true);
    try {
      const { data } = await supabase
        .from("mindeval_pruebas_tecnicas")
        .insert({
          candidato_id: params.id,
          caso_generado: caso.caso_generado,
          criterios: caso.criterios,
          respuesta_candidato: respuestaTecnica,
          puntaje_analisis: correccion.puntaje_analisis,
          puntaje_estrategia: correccion.puntaje_estrategia,
          puntaje_kpis: correccion.puntaje_kpis,
          puntaje_claridad: correccion.puntaje_claridad,
          corregido_por: "ia",
        })
        .select("puntaje_total")
        .single();
      setTecnicaGuardada(data?.puntaje_total ?? null);
    } finally {
      setGuardandoTecnica(false);
    }
  }

  async function agregarAssessment() {
    if (!nuevoEjercicio.trim() || !nuevaCompetencia.trim()) return;
    const { data } = await supabase
      .from("mindeval_assessment_evaluaciones")
      .insert({ candidato_id: params.id, ejercicio: nuevoEjercicio, competencia: nuevaCompetencia, puntaje: nuevoPuntaje, evaluador: nuevoEvaluador || null })
      .select()
      .single();
    if (data) setAssessRows((prev) => [...prev, data]);
    setNuevoEjercicio("");
    setNuevaCompetencia("");
    setNuevoEvaluador("");
    setNuevoPuntaje(7);
  }

  async function guardarEntrevista() {
    setGuardandoEntrevista(true);
    try {
      await supabase.from("mindeval_entrevistas").insert({
        candidato_id: params.id,
        fecha: entrevista.fecha,
        entrevistadores: entrevista.entrevistadores,
        resultado: entrevista.resultado,
        notas: entrevista.notas,
      });
      if (entrevista.resultado === "oferta" || entrevista.resultado === "contratado") {
        await moverEtapa(entrevista.resultado === "contratado" ? "contratado" : "finalista");
      }
    } finally {
      setGuardandoEntrevista(false);
    }
  }

  async function generarInformeEjecutivo() {
    if (!candidato || !vacante) return;
    setGenerandoInforme(true);
    setErrorGlobal("");
    try {
      const res = await fetch("/api/mindeval-informe-ejecutivo", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          candidato,
          titulo_vacante: vacante.titulo,
          matchCv: matchCv?.match_pct,
          stenPromedio,
          tecnicaTotal: tecnicaGuardada ?? undefined,
          assessmentPromedio,
          idoneidadGlobal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInformeIA(data.contenido);
      await supabase.from("mindeval_informes_ia").insert({ candidato_id: params.id, tipo: "perfil", contenido: data.contenido });
    } catch (e) {
      setErrorGlobal(e instanceof Error ? e.message : "Error al generar el informe ejecutivo");
    } finally {
      setGenerandoInforme(false);
    }
  }

  if (verificando || !candidato || !vacante) return null;

  const stenPromedio = promedio(psicoGuardados.filter((p) => p.sten !== null).map((p) => p.sten as number));
  const assessmentPromedio = promedio(assessRows.map((a) => a.puntaje));
  const idoneidadGlobal = calcularIdoneidadGlobal({
    matchCv: matchCv?.match_pct,
    stenPromedio,
    tecnicaTotal: tecnicaGuardada ?? undefined,
    assessmentPromedio,
  });

  const badgeEstado: Record<SesionPrueba["estado"], { label: string; bg: string; color: string }> = {
    programada: { label: "Programada", bg: "#EAF0FB", color: "#2E4A96" },
    en_curso: { label: "En curso", bg: "#FFF6DE", color: "#8A6400" },
    completada: { label: "Completada", bg: "#E8F6EF", color: "#12805C" },
    expirada: { label: "Expirada", bg: "#FDEDEA", color: "#C4402F" },
  };

  function renderAgendamiento(tipo: TipoSesionPrueba) {
    const propias = sesiones.filter((s) => s.tipo === tipo);
    return (
      <div style={{ background: "#F7F9FD", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
          Agendar prueba — el candidato la rinde por su cuenta en su enlace
        </div>
        {propias.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {propias.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span
                  style={{ background: badgeEstado[s.estado].bg, color: badgeEstado[s.estado].color, fontWeight: 700, fontSize: 10.5, padding: "3px 8px", borderRadius: 20 }}
                >
                  {badgeEstado[s.estado].label}
                </span>
                <span style={{ color: "#41507A" }}>{new Date(s.fecha_programada).toLocaleString("es-EC")}</span>
                {s.estado !== "completada" && (
                  <button
                    onClick={() => copiarLinkPrueba(s.token)}
                    style={{ marginLeft: "auto", background: "none", border: `1px solid ${NAVY}`, color: NAVY, fontSize: 11, padding: "3px 9px", borderRadius: 6, cursor: "pointer" }}
                  >
                    {linkCopiado === s.token ? "¡Copiado!" : "Copiar enlace"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="datetime-local"
            style={{ ...inputStyle, flex: 1 }}
            value={fechaAgendar[tipo]}
            onChange={(e) => setFechaAgendar((prev) => ({ ...prev, [tipo]: e.target.value }))}
          />
          <button onClick={() => agendarPrueba(tipo)} disabled={agendando[tipo] || !fechaAgendar[tipo]} style={btnPrimario}>
            {agendando[tipo] ? "Agendando…" : "Agendar y generar enlace"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#7C89A8", marginTop: 8 }}>
          Copia el enlace y envíaselo al candidato (envío de correo automático pendiente de conectar un proveedor de email).
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, padding: "24px 28px", color: "#FFFFFF" }}>
        <div onClick={() => router.push(`/seleccion/${params.vacanteId}`)} style={{ fontSize: 12, color: "#8FA0CC", cursor: "pointer", marginBottom: 10 }}>
          ← Volver al proceso
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{candidato.nombre_completo}</div>
            <div style={{ fontSize: 12.5, color: "#A9B6D8", marginTop: 4 }}>
              {[candidato.ciudad, candidato.anios_experiencia ? `${candidato.anios_experiencia} años exp.` : null, candidato.educacion].filter(Boolean).join(" · ") || "Sin datos adicionales"}
            </div>
            <select
              value={candidato.etapa_actual}
              onChange={(e) => moverEtapa(e.target.value as EtapaCandidato)}
              style={{ marginTop: 10, padding: "6px 10px", borderRadius: 6, fontSize: 12, border: "none" }}
            >
              {[...ETAPAS.map((e) => e.key), "finalista", "contratado", "descartado"].map((k) => (
                <option key={k} value={k}>{labelEtapa(k as EtapaCandidato)}</option>
              ))}
            </select>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#A9B6D8", fontWeight: 700 }}>IDONEIDAD IA</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: GOLD }}>{idoneidadGlobal !== null ? `${idoneidadGlobal}%` : "—"}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.75rem 1.5rem" }}>
        {errorGlobal && <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{errorGlobal}</div>}

        {/* Etapa 2 — Filtro CV */}
        <section style={card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14.5, color: NAVY }}>Etapa 2 — Filtro de CVs con IA</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#7C89A8" }}>Match semántico del CV contra el Manual de Puestos.</p>
          <textarea value={cvTexto} onChange={(e) => setCvTexto(e.target.value)} placeholder="Pega aquí el texto del CV" style={{ width: "100%", minHeight: 100, ...inputStyle, marginBottom: 10 }} />
          <button onClick={calcularMatch} disabled={calculandoMatch} style={btnPrimario}>
            {calculandoMatch ? "Calculando…" : "Calcular match con IA"}
          </button>
          {matchCv && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: matchCv.match_pct >= vacante.corte_match_cv ? "#12805C" : "#C4402F" }}>
                {matchCv.match_pct}% match {matchCv.match_pct >= vacante.corte_match_cv ? "· sobre el corte" : "· bajo el corte"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {matchCv.razones?.map((r, i) => (
                  <span key={i} style={{ fontSize: 11, padding: "4px 9px", borderRadius: 20, background: r.cumple ? "#E8F6EF" : "#FDEDEA", color: r.cumple ? "#12805C" : "#C4402F" }} title={r.detalle}>
                    {r.criterio} {r.cumple ? "✓" : "✗"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Etapa 3 — Psicométricas */}
        <section style={card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14.5, color: NAVY }}>Etapa 3 — Pruebas Psicométricas</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#7C89A8" }}>
            <span style={{ background: "#FFF6DE", color: "#8A6400", padding: "2px 8px", borderRadius: 10, fontWeight: 700, fontSize: 10.5 }}>BATERÍA DE EJEMPLO</span>{" "}
            pendiente banco real — registra el STEN (1–10) obtenido en cada batería.
          </p>
          {renderAgendamiento("psicometrica")}
          {psicoGuardados.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {psicoGuardados.map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0", borderBottom: "1px solid #EEF1F7" }}>
                  <span>{BATERIAS_EJEMPLO.find((b) => b.key === p.bateria)?.nombre ?? p.bateria}</span>
                  <span style={{ fontWeight: 700 }}>STEN {p.sten} · {categoriaSten(p.sten ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
            {BATERIAS_EJEMPLO.filter((b) => !psicoGuardados.some((p) => p.bateria === b.key)).map((b) => (
              <div key={b.key}>
                <label style={{ fontSize: 11.5, color: "#41507A" }}>{b.nombre}</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  placeholder="STEN"
                  style={{ ...inputStyle, width: "100%" }}
                  value={psico[b.key] ?? ""}
                  onChange={(e) => setPsico((prev) => ({ ...prev, [b.key]: Number(e.target.value) }))}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={guardarPsicometricas} disabled={guardandoPsico} style={btnPrimario}>
              {guardandoPsico ? "Guardando…" : "Guardar resultados"}
            </button>
            <button onClick={() => setMostrarFraudePsico((v) => !v)} style={{ ...btnPrimario, background: "transparent", color: NAVY, border: `1px solid ${NAVY}` }}>
              {mostrarFraudePsico ? "Ocultar" : "Activar"} monitor anti-fraude
            </button>
          </div>
          {mostrarFraudePsico && <div style={{ marginTop: 12 }}><AntiFraudeMonitor candidatoId={params.id} sesionTipo="psicometricas" /></div>}
        </section>

        {/* Etapa 4 — Técnica */}
        <section style={card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14.5, color: NAVY }}>Etapa 4 — Pruebas Técnicas</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#7C89A8" }}>Caso generado por IA a partir del Manual de Puestos, corregido por IA + reclutador.</p>
          {renderAgendamiento("tecnica")}
          {tecnicaGuardada !== null && (
            <div style={{ marginBottom: 12, fontSize: 16, fontWeight: 800, color: tecnicaGuardada >= vacante.corte_tecnica ? "#12805C" : "#C4402F" }}>
              Puntaje guardado: {tecnicaGuardada}/100 {tecnicaGuardada >= vacante.corte_tecnica ? "· Aprueba" : "· Bajo el corte"}
            </div>
          )}
          {!caso ? (
            <button onClick={generarCaso} disabled={generandoCaso} style={btnPrimario}>
              {generandoCaso ? "Generando…" : "Generar caso con IA"}
            </button>
          ) : (
            <div>
              <div style={{ background: "#F7F9FD", padding: 14, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{caso.caso_generado}</div>
              <div style={{ fontSize: 11.5, color: "#7C89A8", marginBottom: 10 }}>
                Rúbrica: Análisis {caso.criterios.analisis} · Estrategia {caso.criterios.estrategia} · KPIs {caso.criterios.kpis} · Claridad {caso.criterios.claridad}
              </div>
              <textarea value={respuestaTecnica} onChange={(e) => setRespuestaTecnica(e.target.value)} placeholder="Respuesta del candidato" style={{ width: "100%", minHeight: 100, ...inputStyle, marginBottom: 10 }} />
              <button onClick={corregirCaso} disabled={corrigiendo} style={btnPrimario}>
                {corrigiendo ? "Corrigiendo…" : "Corregir con IA"}
              </button>
              {correccion && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 8 }}>
                    <div>Análisis: <strong>{correccion.puntaje_analisis}</strong>/{caso.criterios.analisis}</div>
                    <div>Estrategia: <strong>{correccion.puntaje_estrategia}</strong>/{caso.criterios.estrategia}</div>
                    <div>KPIs: <strong>{correccion.puntaje_kpis}</strong>/{caso.criterios.kpis}</div>
                    <div>Claridad: <strong>{correccion.puntaje_claridad}</strong>/{caso.criterios.claridad}</div>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#41507A", marginBottom: 10 }}>{correccion.justificacion}</p>
                  <button onClick={guardarTecnica} disabled={guardandoTecnica} style={btnGold}>
                    {guardandoTecnica ? "Guardando…" : "Guardar puntaje"}
                  </button>
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <button onClick={() => setMostrarFraudeTecnica((v) => !v)} style={{ ...btnPrimario, background: "transparent", color: NAVY, border: `1px solid ${NAVY}` }}>
              {mostrarFraudeTecnica ? "Ocultar" : "Activar"} monitor anti-fraude
            </button>
          </div>
          {mostrarFraudeTecnica && <div style={{ marginTop: 12 }}><AntiFraudeMonitor candidatoId={params.id} sesionTipo="tecnica" /></div>}
        </section>

        {/* Etapa 5 — SENESCYT */}
        <section style={card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14.5, color: NAVY }}>Etapa 5 — Verificación SENESCYT</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#7C89A8" }}>Consulta pública de títulos — siempre requiere confirmación manual.</p>
          <button onClick={() => router.push(`/seleccion/${params.vacanteId}/candidato/${params.id}/verificacion`)} style={btnPrimario}>
            Abrir verificación de título →
          </button>
        </section>

        {/* Etapa 6 — Assessment */}
        <section style={card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14.5, color: NAVY }}>Etapa 6 — Assessment Center</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#7C89A8" }}>Registro de evaluación por ejercicio y competencia (escala 0–10).</p>
          {assessRows.length > 0 && (
            <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              {assessRows.map((a) => (
                <div key={a.id} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", borderBottom: "1px solid #EEF1F7", padding: "4px 0" }}>
                  <span>{a.ejercicio} · {a.competencia} {a.evaluador ? `(${a.evaluador})` : ""}</span>
                  <strong>{a.puntaje}/10</strong>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 0.6fr 1fr auto", gap: 8 }}>
            <input placeholder="Ejercicio" value={nuevoEjercicio} onChange={(e) => setNuevoEjercicio(e.target.value)} style={inputStyle} />
            <input placeholder="Competencia" value={nuevaCompetencia} onChange={(e) => setNuevaCompetencia(e.target.value)} style={inputStyle} />
            <input type="number" min={0} max={10} value={nuevoPuntaje} onChange={(e) => setNuevoPuntaje(Number(e.target.value))} style={inputStyle} />
            <input placeholder="Evaluador" value={nuevoEvaluador} onChange={(e) => setNuevoEvaluador(e.target.value)} style={inputStyle} />
            <button onClick={agregarAssessment} style={btnPrimario}>+ Añadir</button>
          </div>
        </section>

        {/* Etapa 7 — Entrevista */}
        <section style={card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14.5, color: NAVY }}>Etapa 7 — Entrevista Virtual</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input type="datetime-local" style={inputStyle} value={entrevista.fecha ?? ""} onChange={(e) => setEntrevista((prev) => ({ ...prev, fecha: e.target.value }))} />
            <input placeholder="Entrevistadores" style={inputStyle} value={entrevista.entrevistadores ?? ""} onChange={(e) => setEntrevista((prev) => ({ ...prev, entrevistadores: e.target.value }))} />
          </div>
          <select style={{ ...inputStyle, marginBottom: 10 }} value={entrevista.resultado ?? ""} onChange={(e) => setEntrevista((prev) => ({ ...prev, resultado: e.target.value || null }))}>
            <option value="">Resultado…</option>
            <option value="avanza">Avanza</option>
            <option value="no_avanza">No avanza</option>
            <option value="oferta">Oferta / Finalista</option>
            <option value="contratado">Contratado</option>
          </select>
          <textarea placeholder="Notas del panel" style={{ width: "100%", minHeight: 70, ...inputStyle, marginBottom: 10 }} value={entrevista.notas ?? ""} onChange={(e) => setEntrevista((prev) => ({ ...prev, notas: e.target.value }))} />
          <button onClick={guardarEntrevista} disabled={guardandoEntrevista} style={btnGold}>
            {guardandoEntrevista ? "Guardando…" : "Guardar entrevista"}
          </button>
        </section>

        {/* Informe ejecutivo IA */}
        <section style={{ ...card, borderTop: `3px solid ${GOLD}` }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14.5, color: NAVY }}>Informe ejecutivo redactado por IA</h3>
          <button onClick={generarInformeEjecutivo} disabled={generandoInforme} style={btnGold}>
            {generandoInforme ? "Generando…" : "Generar informe ejecutivo"}
          </button>
          {informeIA && (
            <div style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.7, color: "#33405F", whiteSpace: "pre-wrap" }}>{informeIA}</div>
          )}
        </section>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { authHeaders } from "@/lib/auth-headers";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import AntiFraudeMonitor from "@/components/mindeval/AntiFraudeMonitor";
import InformeMarkdown from "@/components/mindeval/InformeMarkdown";
import { exportarInformeCandidatoPDF } from "@/lib/exportar-informe-candidato-pdf";
import { BATERIAS_EJEMPLO } from "@/lib/mindeval-baterias";
import { NOMBRES_ESCALA_16PF5, type Escala16PF5 } from "@/lib/mindeval-16pf5";
import { NOMBRES_FACTOR_KOSTICK, type FactorKostick } from "@/lib/mindeval-kostick";
import { NOMBRES_RASGO_DISC, PATRONES_DISC, TEXTOS_PATRON_DISC, NOMBRES_CATEGORIA_TEXTO_DISC } from "@/lib/mindeval-disc";
import { NOMBRES_ESCALA_VALANTI, type EscalaVALANTI } from "@/lib/mindeval-valanti";
import { avanzarASenescytSiAplica, calcularIdoneidadGlobal, categoriaSten, evaluarDescarteCv, promedio } from "@/lib/mindeval-scoring";
import { resolverPerfilCargo } from "@/lib/mindeval-perfil";
import { ETAPAS, labelEtapa, type Candidato, type EtapaCandidato, type PreguntaBanco, type RespuestaBancoDetalle, type SesionPrueba, type TipoSesionPrueba, type Vacante, type VerificacionTitulo } from "@/lib/mindeval-types";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

const card: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 22, marginBottom: 18 };
const btnPrimario: React.CSSProperties = { background: NAVY, color: "#FFFFFF", border: "none", padding: "9px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const btnGold: React.CSSProperties = { background: GOLD, color: NAVY, border: "none", padding: "9px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" };
const inputStyle: React.CSSProperties = { padding: "8px 10px", border: "1.5px solid #D5DCEB", borderRadius: 7, fontSize: 12.5, boxSizing: "border-box" };

interface PsicoRow { bateria: string; sten: number | null; percentil: number | null }
interface DatoBarra { clave: string; nombre: string; valor: number }

const NOMBRE_TEST_PSICOMETRICO: Record<"16pf5" | "kostick" | "disc" | "valanti", string> = {
  "16pf5": "16PF-5",
  kostick: "KOSTICK",
  disc: "DISC",
  valanti: "VALANTI",
};
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
  const [resultadoBanco, setResultadoBanco] = useState<{ preguntas: PreguntaBanco[]; respuestas: RespuestaBancoDetalle[] } | null>(null);

  const [assessRows, setAssessRows] = useState<AssessRow[]>([]);
  const [nuevoEjercicio, setNuevoEjercicio] = useState("");
  const [nuevaCompetencia, setNuevaCompetencia] = useState("");
  const [nuevoPuntaje, setNuevoPuntaje] = useState(7);
  const [nuevoEvaluador, setNuevoEvaluador] = useState("");

  const [verificacionTitulo, setVerificacionTitulo] = useState<VerificacionTitulo | null>(null);

  const [entrevista, setEntrevista] = useState<EntrevistaRow>({ fecha: null, entrevistadores: "", resultado: null, notas: "" });
  const [guardandoEntrevista, setGuardandoEntrevista] = useState(false);

  const [informeIA, setInformeIA] = useState<string | null>(null);
  const [generandoInforme, setGenerandoInforme] = useState(false);
  const [enviandoRechazo, setEnviandoRechazo] = useState(false);
  const [resultadoRechazo, setResultadoRechazo] = useState("");
  const [errorGlobal, setErrorGlobal] = useState("");
  const [avisoGlobal, setAvisoGlobal] = useState("");

  const [editandoCedula, setEditandoCedula] = useState(false);
  const [cedulaEditada, setCedulaEditada] = useState("");
  const [guardandoCedula, setGuardandoCedula] = useState(false);

  const [sesiones, setSesiones] = useState<SesionPrueba[]>([]);
  const [fechaAgendar, setFechaAgendar] = useState<Record<TipoSesionPrueba, string>>({ psicometrica: "", tecnica: "", assessment: "" });
  const [agendando, setAgendando] = useState<Record<TipoSesionPrueba, boolean>>({ psicometrica: false, tecnica: false, assessment: false });
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null);
  const [resultadoAgendamiento, setResultadoAgendamiento] = useState<Record<TipoSesionPrueba, string>>({ psicometrica: "", tecnica: "", assessment: "" });

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

    const [{ data: match }, { data: ps }, { data: tec }, { data: asse }, { data: entr }, { data: verif }] = await Promise.all([
      supabase.from("mindeval_cv_matches").select("match_pct, razones").eq("candidato_id", params.id).order("generado_en", { ascending: false }).limit(1),
      supabase.from("mindeval_pruebas_psicometricas").select("bateria, sten, percentil").eq("candidato_id", params.id),
      supabase.from("mindeval_pruebas_tecnicas").select("puntaje_total, modo, preguntas_snapshot, respuestas_banco").eq("candidato_id", params.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("mindeval_assessment_evaluaciones").select("id, ejercicio, competencia, puntaje, evaluador").eq("candidato_id", params.id),
      supabase.from("mindeval_entrevistas").select("fecha, entrevistadores, resultado, notas").eq("candidato_id", params.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("mindeval_verificaciones_titulo").select("*").eq("candidato_id", params.id).order("created_at", { ascending: false }).limit(1),
    ]);

    if (match?.[0]) setMatchCv(match[0]);
    setPsicoGuardados(ps ?? []);
    if (verif?.[0]) setVerificacionTitulo(verif[0]);
    if (tec?.[0]) {
      setTecnicaGuardada(tec[0].puntaje_total);
      if (tec[0].modo === "banco" && tec[0].respuestas_banco) {
        setResultadoBanco({ preguntas: tec[0].preguntas_snapshot ?? [], respuestas: tec[0].respuestas_banco });
      }
    }
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
      supabase
        .from("mindeval_pruebas_tecnicas")
        .select("puntaje_total, modo, preguntas_snapshot, respuestas_banco")
        .eq("candidato_id", params.id)
        .or("respuesta_candidato.not.is.null,respuestas_banco.not.is.null")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    if (ps2?.length) setPsicoGuardados(ps2);
    if (tec2?.[0]) {
      setTecnicaGuardada(tec2[0].puntaje_total);
      if (tec2[0].modo === "banco" && tec2[0].respuestas_banco) {
        setResultadoBanco({ preguntas: tec2[0].preguntas_snapshot ?? [], respuestas: tec2[0].respuestas_banco });
      }
    }
  }

  async function agendarPrueba(tipo: TipoSesionPrueba) {
    const fecha = fechaAgendar[tipo];
    if (!fecha) return;
    setAgendando((prev) => ({ ...prev, [tipo]: true }));
    setResultadoAgendamiento((prev) => ({ ...prev, [tipo]: "" }));
    try {
      const res = await fetch("/api/mindeval-agendar-prueba", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          vacante_id: params.vacanteId,
          tipo,
          fecha_programada: new Date(fecha).toISOString(),
          candidato_ids: [params.id],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const resultado = data.resultados?.[0];
      if (resultado?.sesion) setSesiones((prev) => [resultado.sesion, ...prev]);
      setResultadoAgendamiento((prev) => ({
        ...prev,
        [tipo]: resultado?.ok ? "Correo enviado al candidato." : (resultado?.motivo ?? "No se pudo agendar la prueba."),
      }));
      setFechaAgendar((prev) => ({ ...prev, [tipo]: "" }));
    } catch (e) {
      setResultadoAgendamiento((prev) => ({ ...prev, [tipo]: e instanceof Error ? e.message : "No se pudo agendar la prueba." }));
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

  /**
   * Único lugar autorizado para corregir la cédula de un candidato — la
   * pantalla de Verificación SENESCYT la muestra de solo lectura a propósito
   * (para que nadie consulte/guarde por accidente con un número distinto al
   * que el candidato declaró al postular). Si de verdad está mal, se corrige
   * aquí, con el consultor identificado por su sesión.
   */
  async function guardarCedula() {
    if (!/^\d{10}$/.test(cedulaEditada)) {
      setErrorGlobal("La cédula debe tener 10 dígitos.");
      return;
    }
    setGuardandoCedula(true);
    try {
      await supabase.from("mindeval_candidatos").update({ cedula: cedulaEditada }).eq("id", params.id);
      setCandidato((prev) => (prev ? { ...prev, cedula: cedulaEditada } : prev));
      setEditandoCedula(false);
    } finally {
      setGuardandoCedula(false);
    }
  }

  async function toggleTestPsicometrico(test: "16pf5" | "kostick" | "disc" | "valanti") {
    if (!vacante) return;
    const activos = vacante.tests_psicometricos.includes(test)
      ? vacante.tests_psicometricos.filter((t) => t !== test)
      : [...vacante.tests_psicometricos, test];
    await supabase.from("mindeval_vacantes").update({ tests_psicometricos: activos }).eq("id", vacante.id);
    setVacante({ ...vacante, tests_psicometricos: activos });
  }

  function nombreBateria(bateria: string): string {
    if (bateria.startsWith("16pf5_")) {
      const escala = bateria.replace("16pf5_", "") as keyof typeof NOMBRES_ESCALA_16PF5;
      return `16PF-5 · ${NOMBRES_ESCALA_16PF5[escala] ?? escala}`;
    }
    if (bateria.startsWith("kostick_")) {
      const factor = bateria.replace("kostick_", "") as keyof typeof NOMBRES_FACTOR_KOSTICK;
      return `KOSTICK · ${NOMBRES_FACTOR_KOSTICK[factor] ?? factor}`;
    }
    if (bateria.startsWith("disc_")) {
      const rasgo = bateria.replace("disc_", "") as keyof typeof NOMBRES_RASGO_DISC;
      return `DISC · ${NOMBRES_RASGO_DISC[rasgo] ?? rasgo}`;
    }
    if (bateria.startsWith("valanti_")) {
      const escala = bateria.replace("valanti_", "") as keyof typeof NOMBRES_ESCALA_VALANTI;
      return `VALANTI · ${NOMBRES_ESCALA_VALANTI[escala] ?? escala}`;
    }
    return BATERIAS_EJEMPLO.find((b) => b.key === bateria)?.nombre ?? bateria;
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

      const { descartar, motivo } = evaluarDescarteCv(data, vacante.corte_match_cv);
      await supabase
        .from("mindeval_candidatos")
        .update(descartar ? { etapa_actual: "descartado", estado: "descartado", motivo_descarte: motivo } : { etapa_actual: "filtro_cv" })
        .eq("id", params.id);
      setCandidato((prev) => (prev ? { ...prev, etapa_actual: descartar ? "descartado" : "filtro_cv", motivo_descarte: motivo ?? null } : prev));
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
      await revisarAvanceSenescyt();
    } finally {
      setGuardandoPsico(false);
    }
  }

  async function revisarAvanceSenescyt() {
    if (!vacante) return;
    const avanzo = await avanzarASenescytSiAplica(supabase, params.id, vacante);
    if (avanzo) {
      setCandidato((prev) => (prev ? { ...prev, etapa_actual: "verificacion_titulo" } : prev));
      setAvisoGlobal("Aprobó psicométricas y técnica por encima del corte — avanzó automáticamente a Verificación SENESCYT.");
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
      await revisarAvanceSenescyt();
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
          estadoSenescyt: verificacionTitulo?.estado,
          stenPromedio,
          tecnicaTotal: tecnicaGuardada ?? undefined,
          assessmentPromedio,
          datos16pf5: datos16pf5.length ? datos16pf5.map((d) => ({ nombre: d.nombre, valor: d.valor })) : undefined,
          datosKostick: datosKostick.length ? datosKostick.map((d) => ({ nombre: d.nombre, valor: d.valor })) : undefined,
          datosDisc: datosDisc.length ? datosDisc.map((d) => ({ nombre: d.nombre, valor: d.valor })) : undefined,
          patronDisc,
          textosPatronDisc,
          datosValanti: datosValanti.length ? datosValanti.map((d) => ({ nombre: d.nombre, valor: d.valor })) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInformeIA(data.contenido);
      // "finalista": este es el contenido de la Etapa 7 (Informe Final) --
      // se guarda y avanza la etapa, nunca se genera automáticamente para
      // todo el que postuló.
      await supabase.from("mindeval_informes_ia").insert({ candidato_id: params.id, tipo: "finalista", contenido: data.contenido });
      if (candidato.etapa_actual !== "descartado" && candidato.etapa_actual !== "contratado") {
        await moverEtapa("informe_final");
      }
    } catch (e) {
      setErrorGlobal(e instanceof Error ? e.message : "Error al generar el informe ejecutivo");
    } finally {
      setGenerandoInforme(false);
    }
  }

  function descargarInformePDF() {
    if (!informeIA || !candidato || !vacante) return;
    exportarInformeCandidatoPDF(
      {
        nombreCompleto: candidato.nombre_completo,
        vacante: vacante.titulo,
        empresa: vacante.empresa,
        matchCv: matchCv?.match_pct,
        stenPromedio: psicoGuardados.length ? stenPromedio : undefined,
        tecnicaTotal: tecnicaGuardada ?? undefined,
        assessmentPromedio: assessRows.length ? assessmentPromedio : undefined,
        estadoSenescyt: verificacionTitulo?.estado,
      },
      informeIA
    );
  }

  async function enviarCorreoRechazo() {
    if (!candidato || !vacante) return;
    setEnviandoRechazo(true);
    setResultadoRechazo("");
    try {
      const res = await fetch("/api/mindeval-enviar-rechazo", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ candidato_id: params.id, titulo_vacante: vacante.titulo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultadoRechazo("Correo enviado.");
    } catch (e) {
      setResultadoRechazo(e instanceof Error ? e.message : "No se pudo enviar el correo.");
    } finally {
      setEnviandoRechazo(false);
    }
  }

  if (verificando || !candidato || !vacante) return null;

  // el conteo ipsativo de KOSTICK (0-9), el segmento de DISC (1-7) y el
  // puntaje estándar de VALANTI (media 50/DE 10) no son un STEN normado, se
  // excluyen del promedio.
  const stenPromedio = promedio(
    psicoGuardados
      .filter((p) => p.sten !== null && !p.bateria.startsWith("kostick_") && !p.bateria.startsWith("disc_") && !p.bateria.startsWith("valanti_"))
      .map((p) => p.sten as number)
  );

  // orden canónico de las claves (el de NOMBRES_*, no el de llegada de la DB) para que el gráfico se lea igual siempre.
  const datos16pf5: DatoBarra[] = (Object.keys(NOMBRES_ESCALA_16PF5) as Escala16PF5[])
    .map((escala) => {
      const fila = psicoGuardados.find((p) => p.bateria === `16pf5_${escala}`);
      return fila ? { clave: escala as string, nombre: NOMBRES_ESCALA_16PF5[escala], valor: fila.sten ?? 0 } : null;
    })
    .filter((d): d is DatoBarra => d !== null);

  const datosKostick: DatoBarra[] = (Object.keys(NOMBRES_FACTOR_KOSTICK) as FactorKostick[])
    .map((factor) => {
      const fila = psicoGuardados.find((p) => p.bateria === `kostick_${factor}`);
      return fila ? { clave: factor as string, nombre: NOMBRES_FACTOR_KOSTICK[factor], valor: fila.sten ?? 0 } : null;
    })
    .filter((d): d is DatoBarra => d !== null);

  const datosDisc: DatoBarra[] = (Object.keys(NOMBRES_RASGO_DISC) as ("D" | "I" | "S" | "C")[])
    .map((rasgo) => {
      const fila = psicoGuardados.find((p) => p.bateria === `disc_${rasgo}`);
      return fila ? { clave: rasgo as string, nombre: NOMBRES_RASGO_DISC[rasgo], valor: fila.sten ?? 0 } : null;
    })
    .filter((d): d is DatoBarra => d !== null);

  // el patrón DISC no se guarda en la DB — se deriva aquí de los 4 segmentos ya
  // guardados, igual que el resto de nombres se derivan de la clave guardada.
  const codigoSegmentoDisc = datosDisc.length === 4 ? datosDisc.map((d) => d.valor).join("") : null;
  const patronDisc = codigoSegmentoDisc ? PATRONES_DISC[codigoSegmentoDisc] : undefined;
  const textosPatronDisc = patronDisc ? TEXTOS_PATRON_DISC[patronDisc] : undefined;

  const datosValanti: DatoBarra[] = (Object.keys(NOMBRES_ESCALA_VALANTI) as EscalaVALANTI[])
    .map((escala) => {
      const fila = psicoGuardados.find((p) => p.bateria === `valanti_${escala}`);
      return fila ? { clave: escala as string, nombre: NOMBRES_ESCALA_VALANTI[escala], valor: fila.sten ?? 0 } : null;
    })
    .filter((d): d is DatoBarra => d !== null);

  function colorPorDecatipo(decatipo: number): string {
    if (decatipo >= 9) return "#12805C";
    if (decatipo >= 7) return "#4E9E7B";
    if (decatipo >= 5) return GOLD;
    if (decatipo >= 3) return "#E08A3C";
    return "#C4402F";
  }
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
          Agendar prueba — se envía automáticamente por correo al candidato
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
            {agendando[tipo] ? "Agendando y enviando…" : "Agendar y enviar por correo"}
          </button>
        </div>
        {resultadoAgendamiento[tipo] ? (
          <div style={{ fontSize: 11.5, color: resultadoAgendamiento[tipo].startsWith("Correo enviado") ? "#12805C" : "#C4402F", marginTop: 8, fontWeight: 600 }}>
            {resultadoAgendamiento[tipo]}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#7C89A8", marginTop: 8 }}>
            {candidato?.email ? `Se enviará a ${candidato.email}. Si falla, usa "Copiar enlace" arriba.` : 'Este candidato no tiene correo registrado — usa "Copiar enlace" para enviarlo tú mismo.'}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, padding: "24px 28px", color: "#FFFFFF" }}>
        <button
          onClick={() => router.push(`/seleccion/${params.vacanteId}`)}
          style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.25)", padding: "6px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer", marginBottom: 10 }}
        >
          ← Volver al proceso
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
              {candidato.nombre_completo}
              {candidato.etapa_actual === "descartado" && (
                <span style={{ background: "#FDEDEA", color: "#C4402F", fontWeight: 700, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
                  DESCARTADO
                </span>
              )}
            </div>
            {candidato.etapa_actual === "descartado" && candidato.motivo_descarte && (
              <div style={{ fontSize: 12, color: "#FF8A78", marginTop: 4 }}>{candidato.motivo_descarte}</div>
            )}
            {candidato.etapa_actual === "descartado" && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={enviarCorreoRechazo}
                  disabled={enviandoRechazo || !candidato.email}
                  style={{
                    background: "transparent",
                    border: `1px solid ${GOLD}`,
                    color: GOLD,
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: enviandoRechazo || !candidato.email ? "not-allowed" : "pointer",
                    opacity: enviandoRechazo || !candidato.email ? 0.5 : 1,
                  }}
                >
                  {enviandoRechazo ? "Enviando…" : "Enviar correo de no seleccionado"}
                </button>
                {resultadoRechazo && (
                  <span style={{ fontSize: 11.5, color: resultadoRechazo === "Correo enviado." ? "#0FA85F" : "#FF8A78", fontWeight: 600 }}>
                    {resultadoRechazo}
                  </span>
                )}
                {!candidato.email && <span style={{ fontSize: 11, color: "#A9B6D8" }}>Sin correo registrado</span>}
              </div>
            )}
            <div style={{ fontSize: 12.5, color: "#A9B6D8", marginTop: 4 }}>
              {[candidato.ciudad, candidato.anios_experiencia ? `${candidato.anios_experiencia} años exp.` : null, candidato.educacion].filter(Boolean).join(" · ") || "Sin datos adicionales"}
            </div>
            <div style={{ fontSize: 12.5, color: "#A9B6D8", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              {editandoCedula ? (
                <>
                  <input
                    value={cedulaEditada}
                    maxLength={10}
                    inputMode="numeric"
                    onChange={(e) => setCedulaEditada(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    style={{ padding: "4px 8px", borderRadius: 6, border: "1.5px solid #3A4A7A", fontSize: 12, width: 130 }}
                  />
                  <button onClick={guardarCedula} disabled={guardandoCedula} style={{ background: GOLD, color: NAVY, border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {guardandoCedula ? "…" : "Guardar"}
                  </button>
                  <button onClick={() => setEditandoCedula(false)} style={{ background: "transparent", color: "#A9B6D8", border: "1px solid #3A4A7A", padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <span>Cédula: {candidato.cedula ?? <span style={{ color: "#FF8A78" }}>sin registrar (necesaria para verificar SENESCYT)</span>}</span>
                  <button
                    onClick={() => {
                      setCedulaEditada(candidato.cedula ?? "");
                      setEditandoCedula(true);
                    }}
                    style={{ background: "transparent", color: "#8FA0CC", border: "1px solid #3A4A7A", padding: "2px 8px", borderRadius: 6, fontSize: 10.5, cursor: "pointer" }}
                  >
                    {candidato.cedula ? "Corregir" : "Registrar"}
                  </button>
                </>
              )}
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
        {avisoGlobal && <div style={{ background: "#EAF7F1", color: "#12805C", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>{avisoGlobal}</div>}

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

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(["16pf5", "kostick", "disc", "valanti"] as const).map((t) => (
              <button
                key={t}
                onClick={() => toggleTestPsicometrico(t)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: vacante.tests_psicometricos.includes(t) ? `1.5px solid ${GOLD}` : "1.5px solid #D5DCEB",
                  background: vacante.tests_psicometricos.includes(t) ? "#FFFBEF" : "#FFFFFF",
                  color: NAVY,
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {vacante.tests_psicometricos.includes(t) ? "✓ " : ""}
                {NOMBRE_TEST_PSICOMETRICO[t]}
              </button>
            ))}
          </div>

          {vacante.tests_psicometricos.length > 0 ? (
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#7C89A8" }}>
              El candidato responde{" "}
              {vacante.tests_psicometricos.map((t) => NOMBRE_TEST_PSICOMETRICO[t as keyof typeof NOMBRE_TEST_PSICOMETRICO] ?? t).join(" y ")}{" "}
              desde su propio link — la calificación es automática, no hay nada que registrar aquí manualmente.
            </p>
          ) : (
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#7C89A8" }}>
              <span style={{ background: "#FFF6DE", color: "#8A6400", padding: "2px 8px", borderRadius: 10, fontWeight: 700, fontSize: 10.5 }}>BATERÍA DE EJEMPLO</span>{" "}
              activa 16PF-5, KOSTICK, DISC o VALANTI arriba, o registra el STEN (1–10) manualmente abajo.
            </p>
          )}

          {renderAgendamiento("psicometrica")}

          {datos16pf5.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>16PF-5 · decatipo por escala (1–10)</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={datos16pf5} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F7" />
                  <XAxis dataKey="clave" tick={{ fontSize: 10.5, fill: "#41507A" }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10.5, fill: "#41507A" }} allowDecimals={false} />
                  <Tooltip
                    formatter={(valor) => [`Decatipo ${valor} · ${categoriaSten(Number(valor))}`, ""]}
                    labelFormatter={(clave) => datos16pf5.find((d) => d.clave === clave)?.nombre ?? String(clave)}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                    {datos16pf5.map((d) => (
                      <Cell key={d.clave} fill={colorPorDecatipo(d.valor)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {datosKostick.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>KOSTICK · conteo por factor (0–9, ipsativo)</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={datosKostick} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F7" />
                  <XAxis dataKey="clave" tick={{ fontSize: 10.5, fill: "#41507A" }} />
                  <YAxis domain={[0, 9]} tick={{ fontSize: 10.5, fill: "#41507A" }} allowDecimals={false} />
                  <Tooltip
                    formatter={(valor) => [`Conteo ${valor}/9`, ""]}
                    labelFormatter={(clave) => datosKostick.find((d) => d.clave === clave)?.nombre ?? String(clave)}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]} fill={NAVY} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {datosDisc.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>DISC · segmento por rasgo (1–7)</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={datosDisc} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F7" />
                  <XAxis dataKey="clave" tick={{ fontSize: 10.5, fill: "#41507A" }} />
                  <YAxis domain={[0, 7]} tick={{ fontSize: 10.5, fill: "#41507A" }} allowDecimals={false} />
                  <Tooltip
                    formatter={(valor) => [`Segmento ${valor}/7`, ""]}
                    labelFormatter={(clave) => datosDisc.find((d) => d.clave === clave)?.nombre ?? String(clave)}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]} fill={GOLD} />
                </BarChart>
              </ResponsiveContainer>
              {patronDisc && (
                <div style={{ marginTop: 10, padding: 12, background: "#F7F9FD", borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: textosPatronDisc ? 8 : 0 }}>
                    Patrón: {patronDisc}
                  </div>
                  {textosPatronDisc && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 8, fontSize: 11.5, color: "#41507A" }}>
                      {(Object.keys(NOMBRES_CATEGORIA_TEXTO_DISC) as (keyof typeof NOMBRES_CATEGORIA_TEXTO_DISC)[]).map((cat) => (
                        <div key={cat}>
                          <div style={{ fontWeight: 700, color: NAVY }}>{NOMBRES_CATEGORIA_TEXTO_DISC[cat]}</div>
                          <div>{textosPatronDisc[cat]}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {datosValanti.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>VALANTI · puntaje estándar por valor (media 50 / DE 10)</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={datosValanti} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F7" />
                  <XAxis dataKey="clave" tick={{ fontSize: 10.5, fill: "#41507A" }} />
                  <YAxis tick={{ fontSize: 10.5, fill: "#41507A" }} allowDecimals={false} />
                  <Tooltip
                    formatter={(valor) => [`Puntaje estándar ${valor}`, ""]}
                    labelFormatter={(clave) => datosValanti.find((d) => d.clave === clave)?.nombre ?? String(clave)}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]} fill="#7C4FE0" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {psicoGuardados.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {psicoGuardados.map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0", borderBottom: "1px solid #EEF1F7" }}>
                  <span>{nombreBateria(p.bateria)}</span>
                  <span style={{ fontWeight: 700 }}>
                    {p.bateria.startsWith("kostick_")
                      ? `Conteo ${p.sten}/9`
                      : p.bateria.startsWith("disc_")
                        ? `Segmento ${p.sten}/7`
                        : p.bateria.startsWith("valanti_")
                          ? `Estándar ${p.sten}`
                          : `STEN ${p.sten} · ${categoriaSten(p.sten ?? 0)}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {vacante.tests_psicometricos.length === 0 && (
            <>
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
            </>
          )}
          {mostrarFraudePsico && <div style={{ marginTop: 12 }}><AntiFraudeMonitor candidatoId={params.id} sesionTipo="psicometricas" /></div>}
        </section>

        {/* Etapa 4 — Técnica */}
        <section style={card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14.5, color: NAVY }}>Etapa 4 — Pruebas Técnicas</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#7C89A8" }}>
            {vacante.modo_tecnica === "banco"
              ? "Banco de preguntas de opción múltiple, calificado objetivamente (sin interpretación de IA)."
              : "Caso generado por IA a partir del Manual de Puestos, corregido por IA + reclutador."}
          </p>
          {renderAgendamiento("tecnica")}
          {tecnicaGuardada !== null && (
            <div style={{ marginBottom: 12, fontSize: 16, fontWeight: 800, color: tecnicaGuardada >= vacante.corte_tecnica ? "#12805C" : "#C4402F" }}>
              Puntaje guardado: {tecnicaGuardada}/100 {tecnicaGuardada >= vacante.corte_tecnica ? "· Aprueba" : "· Bajo el corte"}
            </div>
          )}

          {vacante.modo_tecnica === "banco" ? (
            resultadoBanco ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {resultadoBanco.preguntas.map((p) => {
                  const r = resultadoBanco.respuestas.find((x) => x.pregunta_id === p.id);
                  return (
                    <div key={p.id} style={{ background: "#F7F9FD", padding: 12, borderRadius: 8, fontSize: 12.5 }}>
                      <div style={{ fontWeight: 700, color: NAVY, marginBottom: 6 }}>{p.enunciado}</div>
                      <div style={{ color: "#41507A" }}>
                        Respuesta del candidato: <strong>{p.opciones.find((o) => o.id === r?.opcion_elegida)?.texto ?? "—"}</strong>
                      </div>
                      {!r?.correcta && (
                        <div style={{ color: "#41507A" }}>
                          Respuesta correcta: <strong>{p.opciones.find((o) => o.id === p.respuesta_correcta)?.texto}</strong>
                        </div>
                      )}
                      <div style={{ marginTop: 4, fontWeight: 700, color: r?.correcta ? "#12805C" : "#C4402F" }}>
                        {r?.correcta ? "✓ Correcta" : "✗ Incorrecta"} · {r?.puntos_obtenidos ?? 0}/{p.puntos} pts
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "#7C89A8" }}>El candidato todavía no completa la prueba técnica agendada.</div>
            )
          ) : !caso ? (
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
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#7C89A8" }}>Registro de evaluación por ejercicio y competencia (escala 0–10).</p>
          <button
            onClick={() => router.push(`/seleccion/${params.vacanteId}/banco-ejercicios`)}
            style={{ background: "none", border: "none", color: NAVY, fontWeight: 700, fontSize: 12, padding: 0, marginBottom: 12, cursor: "pointer" }}
          >
            Gestionar banco de ejercicios →
          </button>
          {renderAgendamiento("assessment")}
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

        {/* Etapa 7 — Informe Final. Va ANTES de la entrevista a propósito: se
            genera con SENESCYT + psicométricas + técnica + assessment para
            decidir a quién entrevistar -- nunca usa datos de la entrevista
            (Etapa 8, más abajo), que todavía no ha ocurrido en este punto. */}
        <section style={{ ...card, borderTop: `3px solid ${GOLD}` }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14.5, color: NAVY }}>Etapa 7 — Informe Final</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#7C89A8" }}>
            Informe ejecutivo por niveles de evidencia (SENESCYT, psicométricas, técnica, assessment) — nunca un índice
            compuesto ni datos de la entrevista. Insumo para decidir a quién entrevistar y presentar como mejor calificado.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={generarInformeEjecutivo} disabled={generandoInforme} style={btnGold}>
              {generandoInforme ? "Generando…" : "Generar Informe Final"}
            </button>
            {informeIA && (
              <button onClick={descargarInformePDF} style={{ ...btnPrimario, background: "transparent", color: NAVY, border: `1px solid ${NAVY}` }}>
                Descargar PDF
              </button>
            )}
          </div>
          {informeIA && (
            <div style={{ marginTop: 14 }}>
              <InformeMarkdown texto={informeIA} />
            </div>
          )}
        </section>

        {/* Etapa 8 — Entrevista Virtual, la última. Decisión humana del
            panel con el líder de área -- no retroalimenta ni regenera el
            Informe Final de arriba. */}
        <section style={card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14.5, color: NAVY }}>Etapa 8 — Entrevista Virtual</h3>
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
      </div>
    </div>
  );
}

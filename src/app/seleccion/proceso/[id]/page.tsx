"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/lib/useAuthGuard";
import BotonCerrarSesion from "@/components/mindeval/BotonCerrarSesion";
import { authHeaders } from "@/lib/auth-headers";
import PerfilBarras from "@/components/mindeval/PerfilBarras";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";
// Máximo de la escala que se grafica en cada prueba: decatipo 1-10 (16PF-5),
// segmento 1-7 (DISC), conteo 0-9 (KOSTICK), puntaje estándar 0-100 (VALANTI).
const MAX_GRAFICO: Record<string, { max: number; pie: string }> = {
  "16pf5": { max: 10, pie: "Decatipo de 1 a 10 por factor." },
  disc: { max: 7, pie: "Segmento de 1 a 7 por rasgo." },
  kostick: { max: 9, pie: "Conteo de 0 a 9 por factor." },
  valanti: { max: 100, pie: "Puntaje estándar (media 50) por escala." },
  holland: { max: 5, pie: "Respuestas afirmativas por área, de 0 a 5. 4-5 alto · 2-3 moderado · 0-1 bajo." },
};
const NOMBRE_TEST: Record<string, string> = { "16pf5": "16PF-5", kostick: "KOSTICK", disc: "DISC", valanti: "VALANTI", holland: "HOLLAND" };

interface Proceso {
  id: string;
  empresa_id: string | null;
  titulo: string;
  empresa: string;
  estado: "abierta" | "pausada" | "cerrada";
  tests_psicometricos: string[];
  tiempo_limite_min: number | null;
}
interface Evaluado {
  id: string;
  nombre_completo: string;
  cedula: string | null;
  email: string | null;
  perfil_evaluado: string | null;
}
interface Sesion {
  id: string;
  perfil_evaluado: string | null;
  grabacion_path: string | null;
  candidato_id: string;
  estado: "programada" | "en_curso" | "completada" | "expirada";
  fecha_programada: string;
  created_at: string;
}
interface ResultadoEvaluado {
  evaluado: { nombre: string; cedula: string | null };
  perfil: "estudiante" | "docente" | null;
  informe: { contenido: string; generado_en: string } | null;
  sesion: { estado: string; iniciada_en: string | null; completada_en: string | null } | null;
  pruebas: {
    prueba: string;
    codigo: string;
    escalas: { escala: string; sten: number | null; puntaje_estandar: number | null; percentil: number | null }[];
    completitud?: { respondidos: number | null; esperados: number | null; incompleta: boolean };
    patron: string | null;
  }[];
  alertas: { tipo_alerta: string; severidad: string; detalle: string | null; creado_en: string }[];
}
interface FilaGrupal {
  nombre: string;
  cedula: string | null;
  perfil: string | null;
  rindio: boolean;
  codigo: string | null;
  incompleta: boolean;
  observacion: string | null;
  puntajes: Record<string, number | null> | null;
}
interface ResultadoInvitar {
  candidato_id: string;
  nombre: string;
  ok: boolean;
  motivo?: string;
  clave_manual?: string;
}

const campo = { padding: "9px 12px", border: "1.5px solid #D5DCEB", borderRadius: 8, fontSize: 13.5, boxSizing: "border-box" as const, color: NAVY, width: "100%" };
const boton = (activo = true) => ({ background: GOLD, color: NAVY, border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: activo ? "pointer" : "not-allowed", opacity: activo ? 1 : 0.5 });

export default function ProcesoInstitucion() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { verificando } = useAuthGuard();
  const [rol, setRol] = useState<string | null>(null);
  const [proceso, setProceso] = useState<Proceso | null>(null);
  const [evaluados, setEvaluados] = useState<Evaluado[]>([]);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [correo, setCorreo] = useState("");
  const [perfilNuevo, setPerfilNuevo] = useState<"estudiante" | "docente" | "">("");
  const [agregando, setAgregando] = useState(false);

  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [fecha, setFecha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoInvitar[]>([]);
  const [video, setVideo] = useState<{ nombre: string; segmentos: { nombre: string; url: string }[] } | null>(null);
  const [cargandoVideo, setCargandoVideo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEvaluado | null>(null);
  const [cargandoResultado, setCargandoResultado] = useState(false);
  const [generandoInforme, setGenerandoInforme] = useState(false);
  const [grupal, setGrupal] = useState<{ institucion: string; proceso: string; filas: FilaGrupal[] } | null>(null);
  const [cargandoGrupal, setCargandoGrupal] = useState(false);
  const [otrosProcesos, setOtrosProcesos] = useState<{ id: string; titulo: string }[]>([]);
  const [origenCopia, setOrigenCopia] = useState("");
  const [copiando, setCopiando] = useState(false);
  const [candidatoResultado, setCandidatoResultado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [{ data: p }, { data: c }, { data: s }] = await Promise.all([
      supabase.from("mindeval_vacantes").select("id, empresa_id, titulo, empresa, estado, tests_psicometricos, tiempo_limite_min").eq("id", id).maybeSingle(),
      supabase.from("mindeval_candidatos").select("id, nombre_completo, cedula, email, perfil_evaluado").eq("vacante_id", id).order("nombre_completo"),
      supabase.from("mindeval_sesiones_prueba").select("id, perfil_evaluado, grabacion_path, candidato_id, estado, fecha_programada, created_at").eq("vacante_id", id).eq("tipo", "psicometrica").order("created_at", { ascending: false }),
    ]);
    if (!p) setError("No se encontró el proceso.");
    if (p?.empresa_id) {
      const { data: otros } = await supabase
        .from("mindeval_vacantes")
        .select("id, titulo")
        .eq("empresa_id", p.empresa_id)
        .neq("id", id)
        .order("created_at", { ascending: false });
      setOtrosProcesos((otros ?? []) as { id: string; titulo: string }[]);
    }
    setProceso(p as Proceso | null);
    setEvaluados((c ?? []) as Evaluado[]);
    setSesiones((s ?? []) as Sesion[]);
    setCargando(false);
  }, [id]);

  useEffect(() => {
    if (verificando) return;
    cargar();
    (async () => {
      const res = await fetch("/api/mindeval-usuarios?contexto=1", { headers: await authHeaders() });
      if (res.ok) setRol((await res.json()).rol);
    })();
  }, [verificando, cargar]);

  // Última invitación de cada evaluado (la lista ya viene de la más nueva a la más vieja).
  const ultima = useMemo(() => {
    const m = new Map<string, Sesion>();
    sesiones.forEach((s) => {
      if (!m.has(s.candidato_id)) m.set(s.candidato_id, s);
    });
    return m;
  }, [sesiones]);

  const cerrado = proceso?.estado === "cerrada";
  const puedeCerrar = rol === "super_admin" || rol === "administrador";

  async function agregar() {
    setError("");
    setAviso("");
    setAgregando(true);
    try {
      const res = await fetch("/api/mindeval-alta-candidato", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ vacante_id: id, nombre_completo: nombre, cedula, email: correo.trim().toLowerCase(), perfil_evaluado: perfilNuevo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo agregar al evaluado");
      setNombre("");
      setCedula("");
      setCorreo("");
      setPerfilNuevo("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar al evaluado");
    } finally {
      setAgregando(false);
    }
  }

  async function invitar() {
    setError("");
    setAviso("");
    setResultados([]);
    setEnviando(true);
    try {
      // En tandas de 20: con 100 evaluados una sola llamada podría pasar el
      // tiempo máximo del servidor y cortarse a la mitad.
      const TANDA = 20;
      const acumulados: typeof resultados = [];
      for (let i = 0; i < seleccion.length; i += TANDA) {
        setAviso(`Enviando invitaciones… ${Math.min(i + TANDA, seleccion.length)} de ${seleccion.length}`);
        const res = await fetch("/api/mindeval-institucion-invitar", {
          method: "POST",
          headers: { ...(await authHeaders()), "Content-Type": "application/json" },
          body: JSON.stringify({ vacante_id: id, candidato_ids: seleccion.slice(i, i + TANDA), fecha_programada: new Date(fecha).toISOString() }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          setResultados(acumulados);
          throw new Error(`${d.error ?? "No se pudieron enviar las invitaciones"}. Se enviaron ${acumulados.filter((r) => r.ok).length} antes del error.`);
        }
        acumulados.push(...d.resultados);
        setResultados([...acumulados]);
      }
      setAviso("");
      setSeleccion([]);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron enviar las invitaciones");
    } finally {
      setEnviando(false);
    }
  }

  async function verGrabacion(sesionId: string, nombreEvaluado: string) {
    setError("");
    setCargandoVideo(true);
    try {
      const res = await fetch(`/api/mindeval-institucion-grabacion?sesion_id=${sesionId}`, { headers: await authHeaders() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo cargar la grabación");
      if (!d.segmentos?.length) throw new Error("Esta sesión no tiene grabación.");
      setVideo({ nombre: nombreEvaluado, segmentos: d.segmentos });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la grabación");
    } finally {
      setCargandoVideo(false);
    }
  }

  async function verResultados(candidatoId: string) {
    setError("");
    setCargandoResultado(true);
    try {
      const res = await fetch(`/api/mindeval-institucion-resultados?vacante_id=${id}&candidato_id=${candidatoId}`, { headers: await authHeaders() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudieron cargar los resultados");
      setResultado(d);
      setCandidatoResultado(candidatoId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los resultados");
    } finally {
      setCargandoResultado(false);
    }
  }

  async function verInformeGrupal() {
    setError("");
    setCargandoGrupal(true);
    try {
      const res = await fetch(`/api/mindeval-institucion-informe-grupal?vacante_id=${id}`, { headers: await authHeaders() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo cargar el informe");
      setGrupal(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el informe");
    } finally {
      setCargandoGrupal(false);
    }
  }

  /** HTML del informe general (mismo contenido para imprimir y para Word). */
  function htmlGrupal(paraWord: boolean): string | null {
    if (!grupal) return null;
    const esc = (t: string | null | undefined) => (t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
    const filas = grupal.filas
      .filter((f) => f.rindio)
      .map((f) => `<tr><td>${esc(f.nombre)}</td><td>${esc(f.cedula)}</td><td style="text-align:center;font-weight:700">${esc(f.codigo)}${f.incompleta ? " *" : ""}</td><td>${esc(f.observacion)}</td></tr>`)
      .join("");
    const cabecera = paraWord
      ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]--><style>@page Section1{size:841.9pt 595.3pt;mso-page-orientation:landscape;margin:2cm}div.Section1{page:Section1}</style>`
      : `<!doctype html><html><head><meta charset="utf-8">`;
    return `${cabecera}<title>Informe general — ${esc(grupal.proceso)}</title>
      <style>body{font-family:Arial,sans-serif;color:#1B2A5B;margin:32px}h1{font-size:18px;margin:0}h2{font-size:13px;font-weight:400;color:#41507A;margin:4px 0 18px}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #9AA6C2;padding:7px 9px;vertical-align:top}th{background:#E9EDF6;text-align:left}
      .nota{font-size:10.5px;color:#41507A;margin-top:12px}</style></head><body>${paraWord ? '<div class="Section1">' : ""}
      <h1>Informe general — Test vocacional de Holland (RIASEC)</h1>
      <h2>Institución ${esc(grupal.institucion)} · ${esc(grupal.proceso)}</h2>
      <table><thead><tr><th>NOMBRE</th><th>CÉDULA</th><th>RESULTADO DEL TEST</th><th>OBSERVACIÓN</th></tr></thead><tbody>${filas}</tbody></table>
      <p class="nota">El resultado es el código formado por las tres áreas con más respuestas afirmativas.${grupal.filas.some((f) => f.incompleta) ? " * Test no respondido en su totalidad." : ""}</p>
      ${paraWord ? "</div>" : ""}</body></html>`;
  }

  /** Abre el informe general en una ventana limpia lista para imprimir o guardar como PDF. */
  function imprimirGrupal() {
    const html = htmlGrupal(false);
    if (!html) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  /** Descarga el informe general como documento de Word (.doc). */
  function descargarWordGrupal() {
    const html = htmlGrupal(true);
    if (!html || !grupal) return;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Informe general - ${grupal.proceso}.doc`.replace(/[\\/:*?"<>|]/g, "-");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copiarEvaluados() {
    if (!origenCopia) return;
    setError("");
    setAviso("");
    setCopiando(true);
    try {
      const res = await fetch("/api/mindeval-institucion-copiar", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ origen_id: origenCopia, destino_id: id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudieron copiar los evaluados");
      setAviso(`Se copiaron ${d.copiados} evaluado(s).${d.omitidos ? ` ${d.omitidos} ya estaban en este proceso.` : ""}`);
      setOrigenCopia("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron copiar los evaluados");
    } finally {
      setCopiando(false);
    }
  }

  async function generarInforme() {
    if (!candidatoResultado) return;
    setError("");
    setGenerandoInforme(true);
    try {
      const res = await fetch("/api/mindeval-institucion-informe", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ vacante_id: id, candidato_id: candidatoResultado }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo generar el informe");
      setResultado((r) => (r ? { ...r, informe: d.informe } : r));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el informe");
    } finally {
      setGenerandoInforme(false);
    }
  }

  async function cambiarEstado(estado: "cerrada" | "abierta") {
    if (estado === "cerrada" && !window.confirm("¿Cerrar el proceso? No se elimina nada: los resultados se conservan, pero ya no se podrán enviar invitaciones.")) return;
    const res = await fetch("/api/mindeval-institucion-proceso", {
      method: "PATCH",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "No se pudo actualizar el proceso");
    else await cargar();
  }

  if (verificando) return null;

  const etiqueta = (e: Evaluado) => {
    const s = ultima.get(e.id);
    if (!s) return { t: "Sin invitar", bg: "#F1F3F9", c: "#5A6785" };
    if (s.estado === "completada") return { t: "Completada", bg: "#E8F6EF", c: "#12805C" };
    if (s.estado === "en_curso") return { t: "Rindiendo", bg: "#FFF6DE", c: "#8A6400" };
    if (s.estado === "expirada") return { t: "Expirada", bg: "#FDEDEA", c: "#C4402F" };
    return { t: `Invitado · ${new Date(s.fecha_programada).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" })}`, bg: "#EAF0FF", c: NAVY };
  };

  const datosCompletos = nombre.trim().length > 2 && /^\d{10}$/.test(cedula) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()) && !!perfilNuevo;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, color: "#FFFFFF", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>
          MindEval <span style={{ color: GOLD }}>Selección</span>
        </div>
        <button
          onClick={() => router.push("/seleccion")}
          style={{ marginLeft: "auto", background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}
        >
          ← Procesos
        </button>
        <BotonCerrarSesion />
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {cargando && <div style={{ textAlign: "center", color: "#7C89A8", padding: "3rem" }}>Cargando…</div>}
        {error && <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
        {aviso && <div style={{ background: "#E8F6EF", color: "#12805C", padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{aviso}</div>}

        {proceso && (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7C89A8", letterSpacing: 1 }}>INSTITUCIÓN {proceso.empresa.toUpperCase()}</div>
                <h1 style={{ color: NAVY, fontSize: 22, margin: "2px 0 6px" }}>{proceso.titulo}</h1>
                <div style={{ fontSize: 12.5, color: "#41507A" }}>
                  {proceso.tests_psicometricos.map((t) => NOMBRE_TEST[t] ?? t).join(" · ")}
                  {proceso.tiempo_limite_min ? ` · ${proceso.tiempo_limite_min} min` : ""}
                </div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 20, background: cerrado ? "#F1F3F9" : "#E8F6EF", color: cerrado ? "#5A6785" : "#12805C" }}>
                  {cerrado ? "Cerrado" : "Abierto"}
                </span>
                {proceso.tests_psicometricos.includes("holland") && (
                  <button
                    onClick={verInformeGrupal}
                    disabled={cargandoGrupal}
                    style={{ background: GOLD, color: NAVY, border: "none", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                  >
                    {cargandoGrupal ? "Cargando…" : "Informe general"}
                  </button>
                )}
                <button
                  onClick={() => router.push(`/seleccion/${id}/monitoreo?inst=1`)}
                  style={{ background: NAVY, color: "#FFFFFF", border: "none", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                >
                  Monitoreo en vivo
                </button>
                {puedeCerrar && (
                  <button
                    onClick={() => cambiarEstado(cerrado ? "abierta" : "cerrada")}
                    style={{ background: "#FFFFFF", color: NAVY, border: "1.5px solid #D5DCEB", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                  >
                    {cerrado ? "Reabrir proceso" : "Cerrar proceso"}
                  </button>
                )}
              </div>
            </div>

            {!cerrado && (
              <div style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 12 }}>1 · Agregar evaluado</div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr auto", gap: 10, alignItems: "center" }}>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" style={campo} />
                  <input value={cedula} onChange={(e) => setCedula(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Cédula (10 dígitos)" inputMode="numeric" style={campo} />
                  <input value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="Correo electrónico" type="email" style={campo} />
                  <button onClick={agregar} disabled={!datosCompletos || agregando} style={boton(datosCompletos && !agregando)}>
                    {agregando ? "…" : "Agregar"}
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#7C89A8" }}>ES:</span>
                  {(["estudiante", "docente"] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setPerfilNuevo(op)}
                      style={{
                        padding: "8px 18px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: perfilNuevo === op ? `2px solid ${NAVY}` : "1.5px solid #D5DCEB",
                        background: perfilNuevo === op ? NAVY : "#FFFFFF",
                        color: perfilNuevo === op ? "#FFFFFF" : NAVY,
                      }}
                    >
                      {op === "estudiante" ? "Estudiante" : "Docente"}
                    </button>
                  ))}
                  {!perfilNuevo && <span style={{ fontSize: 12, color: "#A9B6D8" }}>Elige uno para poder agregar</span>}
                </div>
                {puedeCerrar && otrosProcesos.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid #EEF1F7", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>O copia la lista de otro proceso:</span>
                    <select value={origenCopia} onChange={(e) => setOrigenCopia(e.target.value)} style={{ ...campo, width: 280, background: "#FFFFFF" }}>
                      <option value="">Elige un proceso…</option>
                      {otrosProcesos.map((o) => (
                        <option key={o.id} value={o.id}>{o.titulo}</option>
                      ))}
                    </select>
                    <button onClick={copiarEvaluados} disabled={!origenCopia || copiando} style={boton(!!origenCopia && !copiando)}>
                      {copiando ? "Copiando…" : "Copiar evaluados"}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "14px 20px", fontSize: 13, fontWeight: 800, color: NAVY }}>
                {cerrado ? "Evaluados" : "2 · Elige quiénes rinden"} <span style={{ color: "#7C89A8", fontWeight: 600 }}>({evaluados.length})</span>
              </div>
              {!cerrado && (() => {
                const marcables = evaluados.filter((e) => ultima.get(e.id)?.estado !== "completada").map((e) => e.id);
                const sinInvitar = evaluados.filter((e) => { const st = ultima.get(e.id)?.estado; return !st || st === "expirada"; }).map((e) => e.id);
                const chip = (activo: boolean): import("react").CSSProperties => ({ background: activo ? "#EAF0FF" : "#F4F6FA", color: activo ? NAVY : "#A9B6D8", border: "1px solid #D5DCEB", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: activo ? "pointer" : "default" });
                return (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "0 20px 12px" }}>
                    <button onClick={() => setSeleccion(marcables)} disabled={!marcables.length} style={chip(!!marcables.length)}>Marcar todos ({marcables.length})</button>
                    <button onClick={() => setSeleccion(sinInvitar)} disabled={!sinInvitar.length} style={chip(!!sinInvitar.length)}>Marcar solo los sin invitar ({sinInvitar.length})</button>
                    <button onClick={() => setSeleccion([])} disabled={!seleccion.length} style={chip(!!seleccion.length)}>Desmarcar</button>
                    <span style={{ fontSize: 12, color: "#7C89A8", marginLeft: "auto" }}>{seleccion.length} marcado(s)</span>
                  </div>
                );
              })()}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F7F9FD" }}>
                    {["", "Nombre", "Cédula", "Correo", "Perfil", "Estado", "Resultados", "Grabación"].map((h) => (
                      <th key={h} style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#7C89A8" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {evaluados.map((e) => {
                    const et = etiqueta(e);
                    const completada = ultima.get(e.id)?.estado === "completada";
                    return (
                      <tr key={e.id} style={{ borderTop: "1px solid #EEF1F7" }}>
                        <td style={{ padding: "10px 16px" }}>
                          <input
                            type="checkbox"
                            disabled={cerrado || completada}
                            checked={seleccion.includes(e.id)}
                            onChange={(ev) => setSeleccion(ev.target.checked ? [...seleccion, e.id] : seleccion.filter((x) => x !== e.id))}
                          />
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: NAVY }}>{e.nombre_completo}</td>
                        <td style={{ padding: "10px 16px", fontSize: 12.5, color: "#41507A" }}>{e.cedula ?? "—"}</td>
                        <td style={{ padding: "10px 16px", fontSize: 12.5, color: "#41507A" }}>{e.email ?? "—"}</td>
                        <td style={{ padding: "10px 16px", fontSize: 12.5, color: "#41507A", textTransform: "capitalize" }}>
                          {e.perfil_evaluado ?? "—"}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: et.bg, color: et.c }}>{et.t}</span>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          {completada ? (
                            <button
                              onClick={() => verResultados(e.id)}
                              disabled={cargandoResultado}
                              style={{ background: GOLD, color: NAVY, border: "none", padding: "5px 12px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                            >
                              Ver resultados
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: "#A9B6D8" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          {ultima.get(e.id)?.grabacion_path ? (
                            <button
                              onClick={() => verGrabacion(ultima.get(e.id)!.id, e.nombre_completo)}
                              disabled={cargandoVideo}
                              style={{ background: NAVY, color: "#FFFFFF", border: "none", padding: "5px 12px", borderRadius: 6, fontSize: 11.5, cursor: "pointer" }}
                            >
                              Ver video
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: "#A9B6D8" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {evaluados.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#7C89A8", fontSize: 13 }}>Aún no hay evaluados. Agrégalos arriba.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {grupal && (
              <div onClick={() => setGrupal(null)} style={{ position: "fixed", inset: 0, background: "rgba(11,16,32,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div onClick={(e) => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 14, padding: 24, maxWidth: 1000, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800, color: NAVY, fontSize: 17 }}>Informe general — Test vocacional</div>
                      <div style={{ fontSize: 12, color: "#7C89A8" }}>Institución {grupal.institucion} · {grupal.proceso}</div>
                    </div>
                    <button onClick={descargarWordGrupal} style={{ marginLeft: "auto", ...boton(grupal.filas.some((f) => f.rindio)) }}>Descargar Word</button>
                    <button onClick={imprimirGrupal} style={{ ...boton(grupal.filas.some((f) => f.rindio)) }}>Imprimir / PDF</button>
                    <button onClick={() => setGrupal(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#7C89A8" }}>×</button>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#F7F9FD" }}>
                        {["Nombre", "Cédula", "Resultado", "R", "I", "A", "S", "E", "C", "Observación"].map((h) => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#7C89A8" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {grupal.filas.map((f, i) => (
                        <tr key={i} style={{ borderTop: "1px solid #EEF1F7" }}>
                          <td style={{ padding: "8px 10px", fontSize: 12.5, fontWeight: 700, color: NAVY }}>{f.nombre}</td>
                          <td style={{ padding: "8px 10px", fontSize: 12, color: "#41507A" }}>{f.cedula ?? "—"}</td>
                          <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 800, color: NAVY }}>
                            {f.rindio ? `${f.codigo ?? "—"}${f.incompleta ? " *" : ""}` : <span style={{ fontSize: 11.5, fontWeight: 600, color: "#A9B6D8" }}>Sin rendir</span>}
                          </td>
                          {["Realista", "Investigadora", "Artística", "Social", "Emprendedora", "Convencional"].map((a) => (
                            <td key={a} style={{ padding: "8px 6px", fontSize: 12, color: "#41507A", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{f.puntajes?.[a] ?? "—"}</td>
                          ))}
                          <td style={{ padding: "8px 10px", fontSize: 12, color: "#33405F" }}>{f.observacion ?? "—"}</td>
                        </tr>
                      ))}
                      {grupal.filas.length === 0 && (
                        <tr><td colSpan={10} style={{ padding: "1.5rem", textAlign: "center", color: "#7C89A8", fontSize: 13 }}>Aún no hay evaluados en este proceso.</td></tr>
                      )}
                    </tbody>
                  </table>
                  <p style={{ fontSize: 11.5, color: "#7C89A8", marginTop: 12 }}>
                    Resultado = las tres áreas con más respuestas afirmativas (0 a 5 por área). Si hay empate en el tercer lugar se desempata en el orden R-I-A-S-E-C. * Test no respondido en su totalidad.
                  </p>
                </div>
              </div>
            )}

            {resultado && (
              <div
                onClick={() => setResultado(null)}
                style={{ position: "fixed", inset: 0, background: "rgba(11,16,32,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
              >
                <div onClick={(e) => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 14, padding: 24, maxWidth: 760, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 800, color: NAVY, fontSize: 17 }}>{resultado.evaluado.nombre}</div>
                      <div style={{ fontSize: 12, color: "#7C89A8" }}>
                        Cédula {resultado.evaluado.cedula ?? "—"}
                        {resultado.perfil ? ` · Rindió como ${resultado.perfil}` : ""}
                        {resultado.sesion?.completada_en ? ` · Terminó ${new Date(resultado.sesion.completada_en).toLocaleString("es-EC")}` : ""}
                      </div>
                    </div>
                    <button onClick={() => setResultado(null)} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#7C89A8" }}>×</button>
                  </div>

                  {resultado.pruebas.length === 0 && <div style={{ fontSize: 13, color: "#7C89A8" }}>Aún no hay resultados guardados para este evaluado.</div>}

                  {resultado.pruebas.map((p) => (
                    <div key={p.codigo} style={{ border: "1px solid #E3E8F2", borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                      <div style={{ background: "#F7F9FD", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <strong style={{ color: NAVY, fontSize: 13.5 }}>{p.prueba}</strong>
                        {p.patron && <span style={{ fontSize: 12, color: "#41507A" }}>{p.codigo === "holland" ? "Código" : "Patrón"} {p.patron}</span>}
                        {p.completitud && p.completitud.respondidos !== null && (
                          <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: p.completitud.incompleta ? "#FFF6DE" : "#E8F6EF", color: p.completitud.incompleta ? "#8A6400" : "#12805C" }}>
                            {p.completitud.respondidos}/{p.completitud.esperados} ítems{p.completitud.incompleta ? " · incompleta" : ""}
                          </span>
                        )}
                      </div>
                      {p.completitud?.incompleta && (
                        <div style={{ padding: "8px 14px", fontSize: 12, color: "#8A6400", background: "#FFFBEF" }}>
                          No respondió todos los ítems (por ejemplo, se acabó el tiempo): estos puntajes se calcularon sobre una prueba parcial y no son comparables con los de una prueba completa.
                        </div>
                      )}
                      {!p.completitud?.incompleta && MAX_GRAFICO[p.codigo] && (
                        <PerfilBarras
                          max={MAX_GRAFICO[p.codigo].max}
                          pie={MAX_GRAFICO[p.codigo].pie}
                          filas={p.escalas.map((e) => {
                            const v = e.sten ?? e.puntaje_estandar;
                            return {
                              etiqueta: e.escala,
                              valor: v,
                              valorTexto: v === null ? "—" : e.sten !== null ? String(e.sten) : v.toFixed(1),
                              detalle: e.percentil !== null ? `Percentil ${e.percentil}` : undefined,
                            };
                          })}
                        />
                      )}
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            {["Escala", "Puntaje", "Percentil"].map((h) => (
                              <th key={h} style={{ padding: "7px 14px", textAlign: "left", fontSize: 11, color: "#7C89A8" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {p.escalas.map((e) => (
                            <tr key={e.escala} style={{ borderTop: "1px solid #EEF1F7" }}>
                              <td style={{ padding: "7px 14px", fontSize: 12.5, color: NAVY }}>{e.escala}</td>
                              <td style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 700, color: NAVY }}>{e.sten ?? (e.puntaje_estandar !== null ? e.puntaje_estandar.toFixed(1) : "—")}</td>
                              <td style={{ padding: "7px 14px", fontSize: 12.5, color: "#41507A" }}>{e.percentil ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}

                  <div style={{ border: "1px solid #E3E8F2", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ fontWeight: 800, color: NAVY, fontSize: 13, marginBottom: 6 }}>Alertas durante la prueba ({resultado.alertas.length})</div>
                    {resultado.alertas.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: "#7C89A8" }}>Sin alertas registradas.</div>
                    ) : (
                      resultado.alertas.map((a, i) => (
                        <div key={i} style={{ fontSize: 12.5, color: "#41507A", padding: "3px 0" }}>
                          {new Date(a.creado_en).toLocaleTimeString("es-EC")} · {a.tipo_alerta} <span style={{ color: "#7C89A8" }}>({a.severidad})</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ border: "1px solid #E3E8F2", borderRadius: 12, padding: "12px 14px", marginTop: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, color: NAVY, fontSize: 13 }}>Informe con IA</div>
                      <button
                        onClick={generarInforme}
                        disabled={generandoInforme || resultado.pruebas.length === 0}
                        style={{ marginLeft: "auto", background: NAVY, color: "#FFFFFF", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: generandoInforme ? "not-allowed" : "pointer", opacity: generandoInforme ? 0.6 : 1 }}
                      >
                        {generandoInforme ? "Generando…" : resultado.informe ? "Volver a generar" : "Generar informe"}
                      </button>
                    </div>
                    {resultado.informe ? (
                      <>
                        <div style={{ whiteSpace: "pre-wrap", fontSize: 12.5, color: "#33405F", lineHeight: 1.65 }}>{resultado.informe.contenido}</div>
                        <div style={{ fontSize: 11, color: "#7C89A8", marginTop: 8 }}>Generado el {new Date(resultado.informe.generado_en).toLocaleString("es-EC")}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12.5, color: "#7C89A8" }}>
                        Redacta un resumen descriptivo a partir de los puntajes. No decide aptitud ni validez, y no recibe el nombre ni la cédula del evaluado.
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: 11.5, color: "#7C89A8", marginTop: 12 }}>
                    Puntajes tal como salen de la calificación. No hay veredicto automático: la valoración la hace quien revisa, junto con el video.
                  </p>
                </div>
              </div>
            )}

            {video && (
              <div
                onClick={() => setVideo(null)}
                style={{ position: "fixed", inset: 0, background: "rgba(11,16,32,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
              >
                <div onClick={(e) => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 14, padding: 20, maxWidth: 720, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, color: NAVY }}>Grabación · {video.nombre}</div>
                    <button onClick={() => setVideo(null)} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#7C89A8" }}>×</button>
                  </div>
                  {video.segmentos.map((sg, i) => (
                    <div key={sg.nombre} style={{ marginBottom: 14 }}>
                      {video.segmentos.length > 1 && <div style={{ fontSize: 12, color: "#7C89A8", marginBottom: 4 }}>Tramo {i + 1} de {video.segmentos.length}</div>}
                      <video src={sg.url} controls preload="metadata" style={{ width: "100%", borderRadius: 8, background: "#000" }} />
                    </div>
                  ))}
                  <div style={{ fontSize: 11.5, color: "#7C89A8" }}>El enlace del video vence a los 10 minutos; si no carga, ciérralo y ábrelo de nuevo.</div>
                </div>
              </div>
            )}

            {!cerrado && (
              <div style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 12 }}>3 · Fecha, hora e invitación</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ ...campo, width: 240 }} />
                  <button onClick={invitar} disabled={!fecha || seleccion.length === 0 || enviando} style={boton(!!fecha && seleccion.length > 0 && !enviando)}>
                    {enviando ? "Enviando…" : `Enviar invitación a ${seleccion.length} evaluado${seleccion.length === 1 ? "" : "s"}`}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: "#7C89A8", marginTop: 10 }}>
                  Cada evaluado recibe un correo con su enlace y una contraseña temporal. Reinvitar a alguien anula su invitación anterior.
                </p>

                {resultados.length > 0 && (
                  <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
                    {resultados.map((r) => (
                      <div key={r.candidato_id} style={{ fontSize: 12.5, padding: "8px 12px", borderRadius: 8, background: r.ok ? "#E8F6EF" : "#FDEDEA", color: r.ok ? "#12805C" : "#C4402F" }}>
                        <strong>{r.nombre}</strong>: {r.ok ? (r.motivo ?? "invitación enviada") : r.motivo}
                        {r.clave_manual && <span> — Clave temporal: <strong style={{ fontFamily: "monospace", letterSpacing: 1 }}>{r.clave_manual}</strong></span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

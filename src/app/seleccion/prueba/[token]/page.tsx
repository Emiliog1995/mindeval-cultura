"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import AntiFraudeMonitor from "@/components/mindeval/AntiFraudeMonitor";
import { BATERIAS_EJEMPLO } from "@/lib/mindeval-baterias";
import type { OpcionPregunta } from "@/lib/mindeval-types";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

interface DatosTecnicaCasoAbierto {
  tipo: "tecnica";
  modo: "caso_abierto";
  candidato_id: string;
  candidato_nombre: string;
  iniciada_en: string;
  caso_generado: string;
  criterios: { analisis: number; estrategia: number; kpis: number; claridad: number };
}
interface DatosTecnicaBanco {
  tipo: "tecnica";
  modo: "banco";
  candidato_id: string;
  candidato_nombre: string;
  iniciada_en: string;
  preguntas: { id: string; enunciado: string; opciones: OpcionPregunta[] }[];
}
type DatosTecnica = DatosTecnicaCasoAbierto | DatosTecnicaBanco;
interface DatosPsicometricaPlaceholder {
  tipo: "psicometrica";
  modo: "placeholder";
  candidato_id: string;
  candidato_nombre: string;
  iniciada_en: string;
  items: Record<string, string[]>;
}
interface DatosPsicometricaReal {
  tipo: "psicometrica";
  modo: "real";
  candidato_id: string;
  candidato_nombre: string;
  iniciada_en: string;
  tests: {
    "16pf5"?: { num: number; texto: string; opciones: { letra: "a" | "b" | "c"; texto: string }[] }[];
    kostick?: { num: number; a: string; b: string }[];
    disc?: { num: number; palabras: string[] }[];
    valanti?: { num: number; fraseA: string; fraseB: string }[];
  };
}
type DatosPsicometrica = DatosPsicometricaPlaceholder | DatosPsicometricaReal;
interface DatosAssessment {
  tipo: "assessment";
  candidato_id: string;
  candidato_nombre: string;
  iniciada_en: string;
  ejercicios: { id: string; competencia: string; enunciado: string }[];
}

interface InfoSesion {
  tipo: "tecnica" | "psicometrica" | "assessment";
  candidato_nombre: string;
  requiere_cedula: boolean;
}

// Snapshot de todas las respuestas en curso, para el autoguardado local (ver
// claveBorrador). Todos los campos son opcionales porque solo aplican al
// tipo/modo de examen que le tocó a este candidato.
interface BorradorGuardado {
  respuestaTecnica?: string;
  respuestasBanco?: Record<string, string>;
  respuestasPsico?: Record<string, number[]>;
  respuestasAssessment?: Record<string, string>;
  sexo16pf5?: "H" | "F" | "";
  respuestas16pf5?: Record<number, "a" | "b" | "c">;
  respuestasKostick?: Record<number, "a" | "b">;
  respuestasDisc?: Record<number, { mas?: 1 | 2 | 3 | 4; menos?: 1 | 2 | 3 | 4 }>;
  respuestasValanti?: Record<number, 0 | 1 | 2 | 3>;
}

function claveBorrador(token: string): string {
  return `mindeval-prueba-borrador-${token}`;
}

function duracionMinutos(datos: DatosTecnica | DatosPsicometrica | DatosAssessment): number {
  if (datos.tipo === "psicometrica") {
    if (datos.modo === "real") {
      const tiene16pf5 = !!datos.tests["16pf5"];
      const tieneKostick = !!datos.tests.kostick;
      const tieneDisc = !!datos.tests.disc;
      const tieneValanti = !!datos.tests.valanti;
      const minutos = (tiene16pf5 ? 45 : 0) + (tieneKostick ? 15 : 0) + (tieneDisc ? 15 : 0) + (tieneValanti ? 15 : 0);
      return minutos || 30;
    }
    return 30;
  }
  if (datos.tipo === "assessment") return 45;
  return datos.modo === "banco" ? 40 : 90;
}

/**
 * Cronómetro anclado al servidor (auditoría 2026-09): antes, el estado
 * inicial de React se fijaba en el primer render (cuando `datos` todavía era
 * null y la duración por defecto era 30 min) y nunca se volvía a sincronizar
 * -- toda prueba mostraba 30:00 sin importar su duración real, y recargar la
 * página regalaba tiempo extra. Ahora recibe el total real en segundos y
 * cuánto tiempo real ya pasó desde que el candidato desbloqueó el contenido
 * (`iniciada_en`, fijado por el servidor) y se resincroniza cuando esos
 * valores llegan.
 *
 * `onAgotado` se guarda en un ref actualizado en cada render (no en un
 * efecto) para que, al agotarse el tiempo, el envío automático use SIEMPRE
 * las respuestas más recientes -- antes, el efecto solo se suscribía una vez
 * (cuando `activo` pasaba a true) y quedaba con un cierre de `enviar()` que
 * apuntaba al estado vacío del primer render, así que el envío por tiempo
 * agotado mandaba respuestas en blanco.
 */
function useCuentaRegresiva(segundosTotales: number, segundosTranscurridos: number, activo: boolean, onAgotado: () => void) {
  const [segundos, setSegundos] = useState(Math.max(0, segundosTotales - segundosTranscurridos));
  const disparado = useRef(false);
  const onAgotadoRef = useRef(onAgotado);
  onAgotadoRef.current = onAgotado;

  useEffect(() => {
    setSegundos(Math.max(0, segundosTotales - segundosTranscurridos));
    disparado.current = false;
  }, [segundosTotales, segundosTranscurridos]);

  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => {
      setSegundos((s) => {
        if (s <= 1 && !disparado.current) {
          disparado.current = true;
          onAgotadoRef.current();
        }
        return Math.max(0, s - 1);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activo]);

  const mm = String(Math.floor(segundos / 60)).padStart(2, "0");
  const ss = String(segundos % 60).padStart(2, "0");
  return { texto: `${mm}:${ss}`, segundos };
}

export default function PruebaTokenPage() {
  const { token } = useParams<{ token: string }>();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState<InfoSesion | null>(null);
  const [datos, setDatos] = useState<DatosTecnica | DatosPsicometrica | DatosAssessment | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);

  const [cedulaConfirmar, setCedulaConfirmar] = useState("");
  const [verificandoCedula, setVerificandoCedula] = useState(false);
  const [errorCedula, setErrorCedula] = useState("");

  const [respuestaTecnica, setRespuestaTecnica] = useState("");
  const [respuestasBanco, setRespuestasBanco] = useState<Record<string, string>>({});
  const [respuestasPsico, setRespuestasPsico] = useState<Record<string, number[]>>({});
  const [respuestasAssessment, setRespuestasAssessment] = useState<Record<string, string>>({});
  const [sexo16pf5, setSexo16pf5] = useState<"H" | "F" | "">("");
  const [respuestas16pf5, setRespuestas16pf5] = useState<Record<number, "a" | "b" | "c">>({});
  const [respuestasKostick, setRespuestasKostick] = useState<Record<number, "a" | "b">>({});
  const [respuestasDisc, setRespuestasDisc] = useState<Record<number, { mas?: 1 | 2 | 3 | 4; menos?: 1 | 2 | 3 | 4 }>>({});
  const [respuestasValanti, setRespuestasValanti] = useState<Record<number, 0 | 1 | 2 | 3>>({});

  useEffect(() => {
    fetch(`/api/mindeval-prueba/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? "Este link no es válido.");
        }
        return r.json();
      })
      .then((d: InfoSesion) => {
        setInfo(d);
        // si no hay cédula registrada para este candidato, no hay nada que
        // confirmar — se entrega el contenido directo, igual que antes.
        if (!d.requiere_cedula) desbloquearContenido("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function desbloquearContenido(cedula: string) {
    setErrorCedula("");
    setVerificandoCedula(true);
    try {
      const res = await fetch(`/api/mindeval-prueba/${token}/contenido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo verificar tu cédula.");

      setDatos(d);
      if (d.tipo === "psicometrica" && d.modo === "placeholder") {
        const iniciales: Record<string, number[]> = {};
        Object.keys(d.items).forEach((k) => {
          iniciales[k] = d.items[k].map(() => 3);
        });
        setRespuestasPsico(iniciales);
      }

      // Restaura un borrador local si existe (recarga, cierre accidental de
      // la pestaña, pérdida de conexión) -- ver el efecto de autoguardado
      // más abajo. Best-effort: un borrador corrupto o ausente simplemente
      // se ignora y el candidato empieza en blanco, igual que antes.
      try {
        const raw = localStorage.getItem(claveBorrador(token));
        if (raw) {
          const b: BorradorGuardado = JSON.parse(raw);
          let huboRestauracion = false;
          if (b.respuestaTecnica) { setRespuestaTecnica(b.respuestaTecnica); huboRestauracion = true; }
          if (b.respuestasBanco && Object.keys(b.respuestasBanco).length) { setRespuestasBanco(b.respuestasBanco); huboRestauracion = true; }
          if (b.respuestasAssessment && Object.keys(b.respuestasAssessment).length) { setRespuestasAssessment(b.respuestasAssessment); huboRestauracion = true; }
          if (b.sexo16pf5) { setSexo16pf5(b.sexo16pf5); huboRestauracion = true; }
          if (b.respuestas16pf5 && Object.keys(b.respuestas16pf5).length) { setRespuestas16pf5(b.respuestas16pf5); huboRestauracion = true; }
          if (b.respuestasKostick && Object.keys(b.respuestasKostick).length) { setRespuestasKostick(b.respuestasKostick); huboRestauracion = true; }
          if (b.respuestasDisc && Object.keys(b.respuestasDisc).length) { setRespuestasDisc(b.respuestasDisc); huboRestauracion = true; }
          if (b.respuestasValanti && Object.keys(b.respuestasValanti).length) { setRespuestasValanti(b.respuestasValanti); huboRestauracion = true; }
          if (b.respuestasPsico && Object.keys(b.respuestasPsico).length) { setRespuestasPsico(b.respuestasPsico); huboRestauracion = true; }
          if (huboRestauracion) setBorradorRestaurado(true);
        }
      } catch {
        // localStorage no disponible o borrador corrupto -- se ignora.
      }
    } catch (e) {
      setErrorCedula(e instanceof Error ? e.message : "No se pudo verificar tu cédula.");
    } finally {
      setVerificandoCedula(false);
    }
  }

  // Autoguardado local: cada cambio en las respuestas se persiste al toque
  // en este navegador, por token. Antes todo el examen vivía solo en
  // useState -- recargar, perder conexión o que el navegador mate la
  // pestaña (común en celular) borraba el intento completo sin aviso.
  // best-effort: si falla (modo privado, cuota llena) el examen sigue
  // funcionando igual, solo sin autoguardado.
  useEffect(() => {
    if (!datos || enviado) return;
    try {
      const snapshot: BorradorGuardado = {
        respuestaTecnica,
        respuestasBanco,
        respuestasPsico,
        respuestasAssessment,
        sexo16pf5,
        respuestas16pf5,
        respuestasKostick,
        respuestasDisc,
        respuestasValanti,
      };
      localStorage.setItem(claveBorrador(token), JSON.stringify(snapshot));
    } catch {
      // ver comentario arriba.
    }
  }, [
    token,
    datos,
    enviado,
    respuestaTecnica,
    respuestasBanco,
    respuestasPsico,
    respuestasAssessment,
    sexo16pf5,
    respuestas16pf5,
    respuestasKostick,
    respuestasDisc,
    respuestasValanti,
  ]);

  async function enviar() {
    if (!datos) return;
    setEnviando(true);
    setError("");
    try {
      const body =
        datos.tipo === "tecnica"
          ? datos.modo === "banco"
            ? { respuestas: Object.entries(respuestasBanco).map(([pregunta_id, opcion_elegida]) => ({ pregunta_id, opcion_elegida })) }
            : { respuesta_candidato: respuestaTecnica }
          : datos.tipo === "assessment"
            ? { respuestas: Object.entries(respuestasAssessment).map(([ejercicio_id, respuesta]) => ({ ejercicio_id, respuesta })) }
            : datos.modo === "real"
              ? {
                  sexo: sexo16pf5 || undefined,
                  respuestas16pf5: datos.tests["16pf5"]
                    ? Object.entries(respuestas16pf5).map(([num, letra]) => ({ num: Number(num), letra }))
                    : undefined,
                  respuestasKostick: datos.tests.kostick
                    ? Object.entries(respuestasKostick).map(([num, eleccion]) => ({ num: Number(num), eleccion }))
                    : undefined,
                  respuestasDisc: datos.tests.disc
                    ? Object.entries(respuestasDisc).map(([num, r]) => ({ num: Number(num), mas: r.mas, menos: r.menos }))
                    : undefined,
                  respuestasValanti: datos.tests.valanti
                    ? Object.entries(respuestasValanti).map(([num, puntosFraseA]) => ({ num: Number(num), puntosFraseA }))
                    : undefined,
                }
              : { respuestas: respuestasPsico };
      const res = await fetch(`/api/mindeval-prueba/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEnviado(true);
      try {
        localStorage.removeItem(claveBorrador(token));
      } catch {
        // ver comentario del autoguardado.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la prueba.");
    } finally {
      setEnviando(false);
    }
  }

  const duracionSegundos = (datos ? duracionMinutos(datos) : 30) * 60;
  // Se calcula una sola vez cuando llega `iniciada_en` (no en cada tick) --
  // es el ancla real contra la que se mide el tiempo restante.
  const segundosTranscurridos = useMemo(() => {
    if (!datos?.iniciada_en) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(datos.iniciada_en).getTime()) / 1000));
  }, [datos?.iniciada_en]);
  const { texto: tiempo, segundos: segundosRestantes } = useCuentaRegresiva(duracionSegundos, segundosTranscurridos, !!datos && !enviado, () => enviar());

  if (cargando) return null;

  if (error && !info) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FA" }}>
        <div style={{ textAlign: "center", color: "#C4402F", maxWidth: 380, padding: 20 }}>{error}</div>
      </div>
    );
  }

  if (info && !datos) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FA", padding: 20 }}>
        <div style={{ textAlign: "center", background: "#FFFFFF", padding: "2.5rem 2rem", borderRadius: 16, maxWidth: 400, width: "100%" }}>
          <div style={{ fontSize: 10, letterSpacing: 1.2, color: GOLD, fontWeight: 700, marginBottom: 6 }}>MINDEVAL · BY MINDTALENT</div>
          <h2 style={{ color: NAVY, marginBottom: 6 }}>Hola, {info.candidato_nombre}</h2>
          <p style={{ color: "#7C89A8", fontSize: 13, marginBottom: 12 }}>
            Antes de comenzar, confirma tu número de cédula para verificar que eres tú quien va a rendir la prueba.
          </p>
          <p style={{ color: "#A9B6D8", fontSize: 11, marginBottom: 20 }}>
            Esta prueba tiene monitoreo anti-fraude activo durante todo el intento. Tus respuestas se tratan
            conforme a nuestro{" "}
            <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: NAVY, fontWeight: 700, textDecoration: "underline" }}>
              Aviso de Privacidad
            </a>.
          </p>
          <input
            value={cedulaConfirmar}
            maxLength={10}
            inputMode="numeric"
            placeholder="Cédula (10 dígitos)"
            onChange={(e) => setCedulaConfirmar(e.target.value.replace(/\D/g, "").slice(0, 10))}
            style={{ width: "100%", padding: "11px 12px", border: "1.5px solid #D5DCEB", borderRadius: 8, fontSize: 14, boxSizing: "border-box", marginBottom: 12, textAlign: "center" }}
          />
          {errorCedula && (
            <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{errorCedula}</div>
          )}
          <button
            onClick={() => desbloquearContenido(cedulaConfirmar)}
            disabled={verificandoCedula || !/^\d{10}$/.test(cedulaConfirmar)}
            style={{
              width: "100%",
              background: GOLD,
              color: NAVY,
              border: "none",
              padding: "12px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 800,
              cursor: verificandoCedula ? "not-allowed" : "pointer",
              opacity: verificandoCedula || !/^\d{10}$/.test(cedulaConfirmar) ? 0.6 : 1,
            }}
          >
            {verificandoCedula ? "Verificando…" : "Continuar"}
          </button>
        </div>
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
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            {datos.tipo === "tecnica" ? "Prueba Técnica" : datos.tipo === "assessment" ? "Assessment Center" : "Prueba Psicométrica"}
          </div>
        </div>
        <div
          style={{
            marginLeft: "auto",
            background: segundosRestantes <= 120 ? "#C4402F" : "rgba(255,255,255,0.1)",
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ⏱ {tiempo}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem" }}>
        {error && <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}

        {segundosRestantes > 0 && segundosRestantes <= 120 && (
          <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 700 }}>
            Quedan menos de 2 minutos. Al llegar a 00:00 se enviarán tus respuestas automáticamente tal como estén.
          </div>
        )}

        {borradorRestaurado && (
          <div style={{ background: "#FFFBEF", color: "#8A6400", border: "1px solid #F3E0AE", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 12.5 }}>
            Recuperamos tus respuestas anteriores en este dispositivo. Revísalas antes de continuar.
          </div>
        )}

        <div style={{ fontSize: 11, color: "#A9B6D8", marginBottom: 16 }}>
          Tus respuestas se tratan conforme a nuestro{" "}
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: NAVY, fontWeight: 700, textDecoration: "underline" }}>
            Aviso de Privacidad
          </a>.
        </div>

        <div style={{ marginBottom: 16 }}>
          <AntiFraudeMonitor
            candidatoId={datos.candidato_id}
            sesionTipo={datos.tipo === "tecnica" ? "tecnica" : datos.tipo === "assessment" ? "assessment" : "psicometricas"}
            token={token}
          />
        </div>

        {datos.tipo === "tecnica" && datos.modo === "banco" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {datos.preguntas.map((p, i) => (
              <div key={p.id} style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 13.5, color: NAVY, fontWeight: 700, marginBottom: 12 }}>{i + 1}. {p.enunciado}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.opciones.map((o) => (
                    <label
                      key={o.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: respuestasBanco[p.id] === o.id ? `2px solid ${GOLD}` : "1.5px solid #D5DCEB",
                        background: respuestasBanco[p.id] === o.id ? "#FFFBEF" : "#FFFFFF",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#41507A",
                      }}
                    >
                      <input
                        type="radio"
                        name={p.id}
                        checked={respuestasBanco[p.id] === o.id}
                        onChange={() => setRespuestasBanco((prev) => ({ ...prev, [p.id]: o.id }))}
                      />
                      {o.texto}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={enviar}
              disabled={enviando || Object.keys(respuestasBanco).length < datos.preguntas.length}
              style={{ background: GOLD, color: NAVY, border: "none", padding: "12px 22px", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: enviando ? 0.6 : 1 }}
            >
              {enviando ? "Enviando…" : "Enviar respuestas"}
            </button>
          </div>
        ) : datos.tipo === "tecnica" ? (
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
        ) : datos.tipo === "assessment" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {datos.ejercicios.map((e, i) => (
              <div key={e.id} style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{e.competencia}</div>
                <div style={{ fontSize: 13.5, color: NAVY, fontWeight: 700, marginBottom: 12 }}>{i + 1}. {e.enunciado}</div>
                <textarea
                  value={respuestasAssessment[e.id] ?? ""}
                  onChange={(ev) => setRespuestasAssessment((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                  placeholder="Escribe tu respuesta aquí…"
                  style={{ width: "100%", minHeight: 140, padding: 14, border: "1.5px solid #D5DCEB", borderRadius: 10, fontSize: 13.5, boxSizing: "border-box" }}
                />
              </div>
            ))}
            <button
              onClick={enviar}
              disabled={enviando || Object.values(respuestasAssessment).filter((r) => r.trim()).length < datos.ejercicios.length}
              style={{ background: GOLD, color: NAVY, border: "none", padding: "12px 22px", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: enviando ? 0.6 : 1 }}
            >
              {enviando ? "Enviando…" : "Enviar respuestas"}
            </button>
          </div>
        ) : datos.tipo === "psicometrica" && datos.modo === "real" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {datos.tests["16pf5"] && (
              <>
                <div style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 20 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, color: NAVY }}>Antes de empezar</h3>
                  <div style={{ fontSize: 12.5, color: "#41507A", marginBottom: 8 }}>Sexo</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["H", "F"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSexo16pf5(s)}
                        style={{
                          padding: "8px 20px",
                          borderRadius: 8,
                          border: sexo16pf5 === s ? `2px solid ${GOLD}` : "1.5px solid #D5DCEB",
                          background: sexo16pf5 === s ? "#FFFBEF" : "#FFFFFF",
                          fontSize: 13,
                          fontWeight: 700,
                          color: NAVY,
                          cursor: "pointer",
                        }}
                      >
                        {s === "H" ? "Hombre" : "Mujer"}
                      </button>
                    ))}
                  </div>
                </div>
                {datos.tests["16pf5"]!.map((it, i) => (
                  <div key={it.num} style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 20 }}>
                    <div style={{ fontSize: 13.5, color: NAVY, fontWeight: 700, marginBottom: 12 }}>{i + 1}. {it.texto}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {it.opciones.map((o) => (
                        <label
                          key={o.letra}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: respuestas16pf5[it.num] === o.letra ? `2px solid ${GOLD}` : "1.5px solid #D5DCEB",
                            background: respuestas16pf5[it.num] === o.letra ? "#FFFBEF" : "#FFFFFF",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "#41507A",
                          }}
                        >
                          <input
                            type="radio"
                            name={`p16pf5-${it.num}`}
                            checked={respuestas16pf5[it.num] === o.letra}
                            onChange={() => setRespuestas16pf5((prev) => ({ ...prev, [it.num]: o.letra }))}
                          />
                          {o.texto}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            {datos.tests.kostick && (
              <>
                <div style={{ background: "#FFFBEF", border: "1px solid #F3E0AE", borderRadius: 10, padding: 12, fontSize: 12, color: "#8A6400" }}>
                  Elige, de cada par, la frase que más se parezca a tu forma de ser.
                </div>
                {datos.tests.kostick.map((it, i) => (
                  <div key={it.num} style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 20 }}>
                    <div style={{ fontSize: 11.5, color: "#7C89A8", marginBottom: 10 }}>{i + 1}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {([["a", it.a], ["b", it.b]] as const).map(([letra, texto]) => (
                        <label
                          key={letra}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: respuestasKostick[it.num] === letra ? `2px solid ${GOLD}` : "1.5px solid #D5DCEB",
                            background: respuestasKostick[it.num] === letra ? "#FFFBEF" : "#FFFFFF",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "#41507A",
                          }}
                        >
                          <input
                            type="radio"
                            name={`kostick-${it.num}`}
                            checked={respuestasKostick[it.num] === letra}
                            onChange={() => setRespuestasKostick((prev) => ({ ...prev, [it.num]: letra }))}
                          />
                          {texto}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            {datos.tests.disc && (
              <>
                <div style={{ background: "#FFFBEF", border: "1px solid #F3E0AE", borderRadius: 10, padding: 12, fontSize: 12, color: "#8A6400" }}>
                  En cada uno de los 28 grupos de 4 palabras, marca la que MÁS te representa y la que MENOS te representa.
                </div>
                {datos.tests.disc.map((it, i) => (
                  <div key={it.num} style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 20 }}>
                    <div style={{ fontSize: 11.5, color: "#7C89A8", marginBottom: 10 }}>Grupo {i + 1}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {it.palabras.map((palabra, idx) => {
                        const pos = (idx + 1) as 1 | 2 | 3 | 4;
                        const actual = respuestasDisc[it.num] ?? {};
                        const esMas = actual.mas === pos;
                        const esMenos = actual.menos === pos;
                        return (
                          <div
                            key={pos}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: esMas || esMenos ? `2px solid ${GOLD}` : "1.5px solid #D5DCEB",
                              background: esMas || esMenos ? "#FFFBEF" : "#FFFFFF",
                              fontSize: 13,
                              color: "#41507A",
                            }}
                          >
                            <span style={{ flex: 1 }}>{palabra}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setRespuestasDisc((prev) => {
                                  const item = prev[it.num] ?? {};
                                  return { ...prev, [it.num]: { ...item, mas: pos, menos: item.menos === pos ? undefined : item.menos } };
                                })
                              }
                              style={{
                                padding: "5px 10px",
                                borderRadius: 6,
                                border: esMas ? `1.5px solid ${GOLD}` : "1.5px solid #D5DCEB",
                                background: esMas ? GOLD : "#FFFFFF",
                                color: NAVY,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              MÁS
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setRespuestasDisc((prev) => {
                                  const item = prev[it.num] ?? {};
                                  return { ...prev, [it.num]: { ...item, menos: pos, mas: item.mas === pos ? undefined : item.mas } };
                                })
                              }
                              style={{
                                padding: "5px 10px",
                                borderRadius: 6,
                                border: esMenos ? `1.5px solid ${NAVY}` : "1.5px solid #D5DCEB",
                                background: esMenos ? NAVY : "#FFFFFF",
                                color: esMenos ? "#FFFFFF" : NAVY,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              MENOS
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}

            {datos.tests.valanti && (
              <>
                <div style={{ background: "#FFFBEF", border: "1px solid #F3E0AE", borderRadius: 10, padding: 12, fontSize: 12, color: "#8A6400" }}>
                  Reparte 3 puntos entre las dos frases de cada par, según qué tan importante es cada una para ti.
                </div>
                {datos.tests.valanti.map((it, i) => (
                  <div key={it.num} style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 20 }}>
                    <div style={{ fontSize: 11.5, color: "#7C89A8", marginBottom: 10 }}>{i + 1}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {([0, 1, 2, 3] as const).map((puntosA) => {
                        const seleccionado = respuestasValanti[it.num] === puntosA;
                        return (
                          <label
                            key={puntosA}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "10px 12px",
                              borderRadius: 8,
                              border: seleccionado ? `2px solid ${GOLD}` : "1.5px solid #D5DCEB",
                              background: seleccionado ? "#FFFBEF" : "#FFFFFF",
                              cursor: "pointer",
                              fontSize: 13,
                              color: "#41507A",
                            }}
                          >
                            <input
                              type="radio"
                              name={`valanti-${it.num}`}
                              checked={seleccionado}
                              onChange={() => setRespuestasValanti((prev) => ({ ...prev, [it.num]: puntosA }))}
                            />
                            <span style={{ flex: 1 }}>{it.fraseA}</span>
                            <span style={{ fontWeight: 800, color: NAVY, minWidth: 30, textAlign: "center" }}>
                              {puntosA}-{3 - puntosA}
                            </span>
                            <span style={{ flex: 1, textAlign: "right" }}>{it.fraseB}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}

            {(() => {
              const total16pf5 = datos.tests["16pf5"]?.length ?? 0;
              const totalKostick = datos.tests.kostick?.length ?? 0;
              const totalDisc = datos.tests.disc?.length ?? 0;
              const totalValanti = datos.tests.valanti?.length ?? 0;
              const faltaSexo = total16pf5 > 0 && !sexo16pf5;
              const falta16pf5 = Object.keys(respuestas16pf5).length < total16pf5;
              const faltaKostick = Object.keys(respuestasKostick).length < totalKostick;
              const faltaDisc = Object.values(respuestasDisc).filter((r) => r.mas && r.menos).length < totalDisc;
              const faltaValanti = Object.keys(respuestasValanti).length < totalValanti;
              return (
                <button
                  onClick={enviar}
                  disabled={enviando || faltaSexo || falta16pf5 || faltaKostick || faltaDisc || faltaValanti}
                  style={{ background: GOLD, color: NAVY, border: "none", padding: "12px 22px", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: enviando ? 0.6 : 1 }}
                >
                  {enviando ? "Enviando…" : "Enviar respuestas"}
                </button>
              );
            })()}
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

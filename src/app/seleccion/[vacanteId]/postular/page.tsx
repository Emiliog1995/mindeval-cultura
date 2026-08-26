"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const NAVY = "#1B2A5B";
const TAMANO_MAX_CV = 20 * 1024 * 1024; // 20MB — límite del bucket, ver supabase/mindeval-cvs-subida-directa.sql
const GOLD = "#F5B800";
const inputStyle: React.CSSProperties = { padding: "10px 12px", border: "1.5px solid #D5DCEB", borderRadius: 8, fontSize: 13.5, boxSizing: "border-box", width: "100%" };

export default function PostularPage() {
  const params = useParams<{ vacanteId: string }>();
  const [vacante, setVacante] = useState<{
    titulo: string;
    empresa: string;
    acepta_postulaciones: boolean;
    sedes?: string[] | null;
    salario_pregunta?: { monto: number } | null;
  } | null>(null);
  const [cargando, setCargando] = useState(true);

  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [anios, setAnios] = useState<number | "">("");
  const [educacion, setEducacion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [sede, setSede] = useState("");
  const [salarioAcuerdo, setSalarioAcuerdo] = useState<boolean | null>(null);
  const [consentimiento, setConsentimiento] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [matchPct, setMatchPct] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/mindeval-vacante-publica/${params.vacanteId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setVacante)
      .finally(() => setCargando(false));
  }, [params.vacanteId]);

  async function enviar() {
    setError("");
    if (!nombre.trim()) {
      setError("Escribe tu nombre completo.");
      return;
    }
    if (!/^\d{10}$/.test(cedula)) {
      setError("Escribe tu número de cédula (10 dígitos).");
      return;
    }
    if (vacante?.sedes && vacante.sedes.length > 0 && !sede) {
      setError("Selecciona la sede a la que estás postulando.");
      return;
    }
    if (vacante?.salario_pregunta && salarioAcuerdo === null) {
      setError("Indica si estás de acuerdo con el salario ofertado.");
      return;
    }
    if (!consentimiento) {
      setError("Debes aceptar el Aviso de Privacidad para continuar.");
      return;
    }
    if (archivo && archivo.size > TAMANO_MAX_CV) {
      setError("Tu hoja de vida pesa demasiado (máximo 20MB). Si la escaneaste con la cámara, intenta exportarla como PDF de texto en vez de fotos.");
      return;
    }
    setEnviando(true);
    try {
      // El CV se sube directo a Storage con una URL firmada, antes de enviar
      // el resto del formulario — así el archivo nunca pasa por el límite
      // de 4.5MB de las funciones serverless de Vercel.
      let cvPath: string | null = null;
      if (archivo) {
        const resUrl = await fetch("/api/mindeval-postular-cv-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vacante_id: params.vacanteId, nombre_archivo: archivo.name }),
        });
        const datosUrl = await resUrl.json();
        if (!resUrl.ok) throw new Error(datosUrl.error);

        const { error: upErr } = await supabase.storage.from("mindeval-cvs").uploadToSignedUrl(datosUrl.path, datosUrl.token, archivo);
        if (upErr) throw new Error("No se pudo subir tu hoja de vida. Verifica tu conexión e intenta de nuevo.");
        cvPath = datosUrl.path;
      }

      const res = await fetch("/api/mindeval-postular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacante_id: params.vacanteId,
          nombre_completo: nombre,
          cedula,
          consentimiento_lopdp: true,
          email: email || undefined,
          telefono: telefono || undefined,
          ciudad: ciudad || undefined,
          anios_experiencia: anios !== "" ? anios : undefined,
          educacion: educacion || undefined,
          cv_path: cvPath,
          sede: sede || undefined,
          salario_acuerdo: salarioAcuerdo === null ? undefined : salarioAcuerdo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMatchPct(data.match_pct ?? null);
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la postulación. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return null;

  if (!vacante || !vacante.acepta_postulaciones) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FA" }}>
        <div style={{ textAlign: "center", color: "#7C89A8" }}>Esta vacante ya no está disponible para postulaciones.</div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FA", padding: 20 }}>
        <div style={{ textAlign: "center", background: "#FFFFFF", padding: "3rem 2rem", borderRadius: 16, maxWidth: 420 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <h2 style={{ color: NAVY, marginBottom: 8 }}>¡Postulación enviada!</h2>
          <p style={{ color: "#7C89A8", fontSize: 13.5 }}>
            Gracias por postular a <strong>{vacante.titulo}</strong>. El equipo de {vacante.empresa} revisará tu perfil
            y te contactará si avanzas a la siguiente etapa.
          </p>
          {matchPct !== null && (
            <div style={{ marginTop: 16, fontSize: 12, color: "#A9B6D8", background: "#F7F9FD", borderRadius: 8, padding: "8px 12px" }}>
              Tu CV ya fue procesado por nuestro sistema de análisis.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, color: "#FFFFFF", padding: "2rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: 1.4, color: GOLD, fontWeight: 700 }}>MINDEVAL · BY MINDTALENT</div>
        <h1 style={{ margin: "8px 0 4px", fontSize: 24 }}>{vacante.titulo}</h1>
        <div style={{ color: "#A9B6D8", fontSize: 13 }}>{vacante.empresa}</div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {error && <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}

        <div style={{ background: "#FFFFFF", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={inputStyle} placeholder="Nombre completo *" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input
            style={inputStyle}
            placeholder="Cédula * (10 dígitos)"
            value={cedula}
            maxLength={10}
            inputMode="numeric"
            onChange={(e) => setCedula(e.target.value.replace(/\D/g, "").slice(0, 10))}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input style={inputStyle} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input style={inputStyle} placeholder="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input style={inputStyle} placeholder="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
            <input type="number" style={inputStyle} placeholder="Años de experiencia" value={anios} onChange={(e) => setAnios(e.target.value ? Number(e.target.value) : "")} />
          </div>
          <input style={inputStyle} placeholder="Educación (ej. Ing. Comercial - PUCE)" value={educacion} onChange={(e) => setEducacion(e.target.value)} />

          {vacante.sedes && vacante.sedes.length > 0 && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>Sede a la que aplicas *</label>
              <select style={inputStyle} value={sede} onChange={(e) => setSede(e.target.value)}>
                <option value="">Selecciona una opción</option>
                {vacante.sedes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>
              Hoja de vida (PDF o Word) *
            </label>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              style={{ ...inputStyle, padding: "8px" }}
            />
            <div style={{ fontSize: 11, color: "#7C89A8", marginTop: 4 }}>
              Nuestro sistema analiza tu CV automáticamente contra el perfil de la vacante.
            </div>
          </div>

          <div style={{ background: "#F7F9FD", borderLeft: "3px solid #F5B800", borderRadius: 6, padding: "10px 12px", marginTop: 4 }}>
            <p style={{ fontSize: 11.5, color: NAVY, margin: 0, lineHeight: 1.6 }}>
              Tus datos y tu hoja de vida se usan <strong>exclusivamente</strong> para evaluar tu postulación a esta vacante.
              Solo el equipo de {vacante.empresa} y el consultor de MINDTALENT tendrán acceso.
            </p>
          </div>
          {vacante.salario_pregunta && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>
                ¿Estás de acuerdo con un salario de ${vacante.salario_pregunta.monto}? *
              </label>
              <div style={{ display: "flex", gap: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="radio" name="salario_acuerdo" checked={salarioAcuerdo === true} onChange={() => setSalarioAcuerdo(true)} style={{ accentColor: GOLD }} />
                  Sí
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="radio" name="salario_acuerdo" checked={salarioAcuerdo === false} onChange={() => setSalarioAcuerdo(false)} style={{ accentColor: GOLD }} />
                  No
                </label>
              </div>
            </div>
          )}

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={consentimiento}
              onChange={(e) => setConsentimiento(e.target.checked)}
              style={{ marginTop: 3, width: 16, height: 16, accentColor: GOLD, flexShrink: 0 }}
            />
            <span style={{ fontSize: 11.5, color: "#374151", lineHeight: 1.6 }}>
              He leído y acepto el{" "}
              <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: NAVY, fontWeight: 700, textDecoration: "underline" }}>
                Aviso de Privacidad
              </a>{" "}
              y autorizo el tratamiento de mis datos personales conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP), incluyendo la verificación de mi(s) título(s) académico(s) declarado(s) en el registro público de la SENESCYT.
            </span>
          </label>

          {enviando && (
            <div style={{ background: "#FFF8E5", borderLeft: "3px solid #F5B800", borderRadius: 6, padding: "10px 12px" }}>
              <p style={{ fontSize: 11.5, color: NAVY, margin: 0, lineHeight: 1.6 }}>
                Estamos subiendo tu hoja de vida, puede tardar unos 30 segundos. No cierres esta pantalla ni vuelvas a hacer clic en enviar.
              </p>
            </div>
          )}

          <button
            onClick={enviar}
            disabled={enviando || !consentimiento}
            style={{ background: GOLD, color: NAVY, border: "none", padding: "12px", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: enviando || !consentimiento ? "not-allowed" : "pointer", opacity: enviando || !consentimiento ? 0.6 : 1, marginTop: 4 }}
          >
            {enviando ? "Enviando, espera unos segundos…" : "Enviar postulación"}
          </button>
        </div>
      </div>
    </div>
  );
}

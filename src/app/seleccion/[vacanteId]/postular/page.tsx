"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";
const inputStyle: React.CSSProperties = { padding: "10px 12px", border: "1.5px solid #D5DCEB", borderRadius: 8, fontSize: 13.5, boxSizing: "border-box", width: "100%" };

export default function PostularPage() {
  const params = useParams<{ vacanteId: string }>();
  const [vacante, setVacante] = useState<{ titulo: string; empresa: string; estado: string } | null>(null);
  const [cargando, setCargando] = useState(true);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [anios, setAnios] = useState<number | "">("");
  const [educacion, setEducacion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);

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
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("vacante_id", params.vacanteId);
      formData.append("nombre_completo", nombre);
      if (email) formData.append("email", email);
      if (telefono) formData.append("telefono", telefono);
      if (ciudad) formData.append("ciudad", ciudad);
      if (anios !== "") formData.append("anios_experiencia", String(anios));
      if (educacion) formData.append("educacion", educacion);
      if (archivo) formData.append("cv_file", archivo);

      const res = await fetch("/api/mindeval-postular", { method: "POST", body: formData });
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

  if (!vacante || vacante.estado !== "abierta") {
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input style={inputStyle} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input style={inputStyle} placeholder="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input style={inputStyle} placeholder="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
            <input type="number" style={inputStyle} placeholder="Años de experiencia" value={anios} onChange={(e) => setAnios(e.target.value ? Number(e.target.value) : "")} />
          </div>
          <input style={inputStyle} placeholder="Educación (ej. Ing. Comercial - PUCE)" value={educacion} onChange={(e) => setEducacion(e.target.value)} />

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>
              Hoja de vida (PDF o Word) *
            </label>
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              style={{ ...inputStyle, padding: "8px" }}
            />
            <div style={{ fontSize: 11, color: "#7C89A8", marginTop: 4 }}>
              Nuestro sistema analiza tu CV automáticamente contra el perfil de la vacante.
            </div>
          </div>

          <button
            onClick={enviar}
            disabled={enviando}
            style={{ background: GOLD, color: NAVY, border: "none", padding: "12px", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: enviando ? 0.6 : 1, marginTop: 8 }}
          >
            {enviando ? "Enviando…" : "Enviar postulación"}
          </button>
        </div>
      </div>
    </div>
  );
}

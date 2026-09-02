"use client";

import { useState } from "react";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

/**
 * Página pública para que el candidato recupere el enlace de su prueba si
 * perdió el correo o le cayó en spam (auditoría 2026-09, M-5). Antes su único
 * camino era escribirle al reclutador.
 *
 * No dice nunca si la cédula existe o no: el mensaje de éxito es el mismo en
 * ambos casos, para que esto no sirva para averiguar quién se postuló a una
 * vacante. El enlace viaja al correo ya registrado, no a uno que se escriba
 * aquí.
 */
export default function RecuperarAccesoPage() {
  const [cedula, setCedula] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function enviar() {
    setError("");
    setMensaje("");
    if (!/^\d{10}$/.test(cedula)) {
      setError("Escribe tu número de cédula (10 dígitos).");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/mindeval-recuperar-acceso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMensaje(data.mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo procesar tu solicitud. Intenta de nuevo en un momento.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, maxWidth: 440, width: "100%", overflow: "hidden" }}>
        <div style={{ background: NAVY, color: "#FFFFFF", padding: "22px 26px" }}>
          <div style={{ fontSize: 10, letterSpacing: 1.2, color: GOLD, fontWeight: 700 }}>MINDEVAL · BY MINDTALENT</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 19 }}>Recuperar el enlace de mi prueba</h1>
        </div>

        <div style={{ padding: "24px 26px" }}>
          {mensaje ? (
            <div style={{ background: "#E8F6EF", border: "1px solid #A9DCC6", color: "#0E6E4F", borderRadius: 10, padding: "14px 16px", fontSize: 13.5, lineHeight: 1.6 }}>
              {mensaje}
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13.5, color: "#41507A", lineHeight: 1.6, marginTop: 0 }}>
                Si no encuentras el correo con tu prueba, escribe tu cédula y te reenviamos el enlace al mismo correo
                con el que te postulaste.
              </p>
              <input
                value={cedula}
                maxLength={10}
                inputMode="numeric"
                placeholder="Cédula (10 dígitos)"
                onChange={(e) => setCedula(e.target.value.replace(/\D/g, "").slice(0, 10))}
                onKeyDown={(e) => e.key === "Enter" && enviar()}
                style={{ width: "100%", padding: "11px 12px", border: "1.5px solid #D5DCEB", borderRadius: 8, fontSize: 14, boxSizing: "border-box", marginBottom: 12, textAlign: "center" }}
              />
              {error && (
                <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "9px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>{error}</div>
              )}
              <button
                onClick={enviar}
                disabled={enviando || !/^\d{10}$/.test(cedula)}
                style={{
                  width: "100%",
                  background: GOLD,
                  color: NAVY,
                  border: "none",
                  padding: "12px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: enviando || !/^\d{10}$/.test(cedula) ? "not-allowed" : "pointer",
                  opacity: enviando || !/^\d{10}$/.test(cedula) ? 0.6 : 1,
                }}
              >
                {enviando ? "Enviando…" : "Reenviarme el enlace"}
              </button>
              <p style={{ fontSize: 11.5, color: "#7C89A8", lineHeight: 1.6, marginBottom: 0 }}>
                Solo funciona si tu prueba sigue dentro del plazo. Si ya se te venció, contacta al equipo de
                reclutamiento para que te agenden un nuevo horario.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

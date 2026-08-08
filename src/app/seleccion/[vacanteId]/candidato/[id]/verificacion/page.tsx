"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/lib/useAuthGuard";
import type { VerificacionTitulo } from "@/lib/mindeval-types";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";
const inputStyle: React.CSSProperties = { padding: "9px 12px", border: "1.5px solid #D5DCEB", borderRadius: 8, fontSize: 13, boxSizing: "border-box", width: "100%" };

export default function VerificacionSenescyt() {
  const params = useParams<{ vacanteId: string; id: string }>();
  const router = useRouter();
  const { verificando } = useAuthGuard();

  const [candidatoNombre, setCandidatoNombre] = useState("");
  const [titulo, setTitulo] = useState("");
  const [institucion, setInstitucion] = useState("");
  const [anio, setAnio] = useState<number | "">("");
  const [estado, setEstado] = useState<VerificacionTitulo["estado"]>("pendiente");
  const [verificadoPor, setVerificadoPor] = useState("");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (verificando) return;
    (async () => {
      const { data: c } = await supabase.from("mindeval_candidatos").select("nombre_completo, educacion").eq("id", params.id).single();
      if (c) {
        setCandidatoNombre(c.nombre_completo);
        setTitulo(c.educacion ?? "");
      }
      const { data: v } = await supabase.from("mindeval_verificaciones_titulo").select("*").eq("candidato_id", params.id).order("id", { ascending: false }).limit(1);
      if (v?.[0]) {
        setTitulo(v[0].titulo_declarado ?? "");
        setInstitucion(v[0].institucion ?? "");
        setAnio(v[0].anio ?? "");
        setEstado(v[0].estado);
        setVerificadoPor(v[0].verificado_por ?? "");
        setComprobanteUrl(v[0].comprobante_url ?? "");
      }
    })();
  }, [verificando, params.id]);

  async function guardar() {
    setGuardando(true);
    try {
      await supabase.from("mindeval_verificaciones_titulo").insert({
        candidato_id: params.id,
        titulo_declarado: titulo || null,
        institucion: institucion || null,
        anio: anio || null,
        estado,
        verificado_por: estado !== "pendiente" ? verificadoPor || null : null,
        verificado_en: estado !== "pendiente" ? new Date().toISOString() : null,
        comprobante_url: comprobanteUrl || null,
      });
      if (estado === "registrado") {
        await supabase.from("mindeval_candidatos").update({ etapa_actual: "psicometricas" }).eq("id", params.id);
      }
      setGuardado(true);
    } finally {
      setGuardando(false);
    }
  }

  if (verificando) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, color: "#FFFFFF", padding: "1rem 1.5rem" }}>
        <div onClick={() => router.push(`/seleccion/${params.vacanteId}/candidato/${params.id}`)} style={{ fontSize: 12, color: "#8FA0CC", cursor: "pointer", marginBottom: 6 }}>
          ← Volver al perfil
        </div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Verificación SENESCYT — {candidatoNombre}</div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ background: "#FFFBEF", border: "1px solid #F3E0AE", borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 12.5, color: "#8A6400" }}>
          Esta consulta es pública y no tiene una API oficial documentada. Ábrela en una pestaña
          nueva, revisa el resultado manualmente y regresa a marcarlo aquí. MindEval nunca simula
          este resultado automáticamente.
        </div>

        <a
          href="https://www.senescyt.gob.ec/consulta-titulos-web/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-block", background: GOLD, color: NAVY, fontWeight: 700, fontSize: 13, padding: "10px 18px", borderRadius: 8, textDecoration: "none", marginBottom: 24 }}
        >
          Abrir consulta oficial SENESCYT ↗
        </a>

        <div style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 22 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 5 }}>Título declarado</label>
            <input style={inputStyle} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 5 }}>Institución</label>
              <input style={inputStyle} value={institucion} onChange={(e) => setInstitucion(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 5 }}>Año</label>
              <input type="number" style={inputStyle} value={anio} onChange={(e) => setAnio(e.target.value ? Number(e.target.value) : "")} />
            </div>
          </div>

          <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 8 }}>Resultado de la consulta manual</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {(["pendiente", "registrado", "sin_registro"] as const).map((op) => (
              <button
                key={op}
                onClick={() => setEstado(op)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 8,
                  border: estado === op ? `2px solid ${NAVY}` : "1.5px solid #D5DCEB",
                  background: estado === op ? "#F0F3FA" : "#FFFFFF",
                  color: op === "registrado" ? "#12805C" : op === "sin_registro" ? "#C4402F" : NAVY,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {op === "pendiente" ? "Pendiente" : op === "registrado" ? "✓ Registrado" : "✗ Sin registro"}
              </button>
            ))}
          </div>

          {estado !== "pendiente" && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 5 }}>Verificado por</label>
              <input style={inputStyle} value={verificadoPor} onChange={(e) => setVerificadoPor(e.target.value)} placeholder="Tu nombre" />
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 5 }}>URL de evidencia (captura de la consulta, opcional)</label>
            <input style={inputStyle} value={comprobanteUrl} onChange={(e) => setComprobanteUrl(e.target.value)} placeholder="https://..." />
          </div>

          <button onClick={guardar} disabled={guardando} style={{ background: NAVY, color: "#FFFFFF", border: "none", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {guardando ? "Guardando…" : "Guardar verificación"}
          </button>
          {guardado && <span style={{ marginLeft: 12, color: "#12805C", fontSize: 12.5, fontWeight: 600 }}>Guardado ✓</span>}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { authHeaders } from "@/lib/auth-headers";
import type { VerificacionTitulo } from "@/lib/mindeval-types";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";
const inputStyle: React.CSSProperties = { padding: "9px 12px", border: "1.5px solid #D5DCEB", borderRadius: 8, fontSize: 13, boxSizing: "border-box", width: "100%" };

interface TituloSenescyt {
  institucion: string;
  titulo: string;
  tipo: string;
  registro: string;
  fecha_registro: string;
}

export default function VerificacionSenescyt() {
  const params = useParams<{ vacanteId: string; id: string }>();
  const router = useRouter();
  const { verificando } = useAuthGuard();

  const [candidatoNombre, setCandidatoNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [titulo, setTitulo] = useState("");
  const [institucion, setInstitucion] = useState("");
  const [anio, setAnio] = useState<number | "">("");
  const [estado, setEstado] = useState<VerificacionTitulo["estado"]>("pendiente");
  const [verificadoPor, setVerificadoPor] = useState("");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const [consultando, setConsultando] = useState(false);
  const [errorAuto, setErrorAuto] = useState("");
  const [titulosEncontrados, setTitulosEncontrados] = useState<TituloSenescyt[] | null>(null);

  useEffect(() => {
    if (verificando) return;
    (async () => {
      const { data: c } = await supabase.from("mindeval_candidatos").select("nombre_completo, educacion, cedula").eq("id", params.id).single();
      if (c) {
        setCandidatoNombre(c.nombre_completo);
        setTitulo(c.educacion ?? "");
        setCedula(c.cedula ?? "");
      }
      const { data: v } = await supabase.from("mindeval_verificaciones_titulo").select("*").eq("candidato_id", params.id).order("created_at", { ascending: false }).limit(1);
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

  async function consultarAutomatico() {
    setErrorAuto("");
    setTitulosEncontrados(null);
    if (!/^\d{10}$/.test(cedula)) {
      setErrorAuto("Este candidato no tiene una cédula válida registrada. Corrígela desde su ficha antes de consultar.");
      return;
    }
    setConsultando(true);
    try {
      // la cédula que se consulta es siempre la que el candidato declaró al
      // postular — este campo es de solo lectura a propósito, para que nadie
      // consulte/guarde por accidente con un número distinto. Si está mal de
      // verdad, se corrige desde la ficha del candidato, no aquí.
      const res = await fetch("/api/mindeval-verificar-senescyt", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ cedula, candidato_id: params.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTitulosEncontrados(data.titulos);
      if (data.estado === "registrado" && data.titulos.length > 0) {
        const t = data.titulos[0] as TituloSenescyt;
        setTitulo(t.titulo);
        setInstitucion(t.institucion);
        const anioRegistro = Number((t.fecha_registro ?? "").slice(0, 4));
        if (anioRegistro) setAnio(anioRegistro);
        setEstado("registrado");
      } else {
        setEstado("sin_registro");
      }
    } catch (e) {
      setErrorAuto(e instanceof Error ? e.message : "No se pudo consultar automáticamente. Usa el link manual de abajo.");
    } finally {
      setConsultando(false);
    }
  }

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
        // verificacion_titulo (etapa 5) avanza a assessment (etapa 6) — nunca
        // hacia atrás a psicometricas (etapa 3), que ya se completó antes de
        // llegar aquí (ver ETAPAS en mindeval-types.ts).
        await supabase.from("mindeval_candidatos").update({ etapa_actual: "assessment" }).eq("id", params.id);
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
        <button
          onClick={() => router.push(`/seleccion/${params.vacanteId}/candidato/${params.id}`)}
          style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.25)", padding: "6px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer", marginBottom: 6 }}
        >
          ← Volver al perfil
        </button>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Verificación SENESCYT — {candidatoNombre}</div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ background: "#FFFBEF", border: "1px solid #F3E0AE", borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 12.5, color: "#8A6400" }}>
          SENESCYT no tiene una API oficial documentada. La consulta automática de abajo usa
          <strong> webservices.ec</strong>, un proveedor externo de pago ($0.10 por consulta) que
          hace la búsqueda por ti — pero el resultado siempre queda pendiente de que tú lo
          confirmes y guardes abajo. Si prefieres, puedes seguir usando el link oficial y marcarlo
          a mano, como antes.
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 22, marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 5 }}>
            Cédula del candidato <span style={{ fontWeight: 400, color: "#7C89A8" }}>(la que declaró al postular — solo lectura aquí)</span>
          </label>
          <div style={{ display: "flex", gap: 10, marginBottom: 6, alignItems: "center" }}>
            <input style={{ ...inputStyle, maxWidth: 200, background: "#F4F6FA", color: "#41507A" }} value={cedula || "Sin registrar"} readOnly disabled />
            <button
              onClick={consultarAutomatico}
              disabled={consultando || !/^\d{10}$/.test(cedula)}
              style={{
                background: NAVY,
                color: "#FFFFFF",
                border: "none",
                padding: "9px 16px",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: consultando || !/^\d{10}$/.test(cedula) ? "not-allowed" : "pointer",
                opacity: consultando || !/^\d{10}$/.test(cedula) ? 0.6 : 1,
              }}
            >
              {consultando ? "Consultando…" : "Consultar automáticamente ($0.10)"}
            </button>
          </div>
          <div
            onClick={() => router.push(`/seleccion/${params.vacanteId}/candidato/${params.id}`)}
            style={{ fontSize: 11.5, color: "#7C89A8", cursor: "pointer", marginBottom: errorAuto || titulosEncontrados ? 12 : 0 }}
          >
            ¿La cédula está mal o falta? Corrígela en la ficha del candidato ↗
          </div>
          {errorAuto && (
            <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "8px 12px", borderRadius: 8, fontSize: 12 }}>{errorAuto}</div>
          )}
          {titulosEncontrados && titulosEncontrados.length > 0 && (
            <div style={{ background: "#EAF7F1", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#0F5132" }}>
              {titulosEncontrados.length} título(s) encontrado(s) — se precargó el primero abajo, revisa y ajusta si hace falta antes de guardar.
              {titulosEncontrados.map((t, i) => (
                <div key={i} style={{ marginTop: 4 }}>· {t.titulo} — {t.institucion} ({t.fecha_registro})</div>
              ))}
            </div>
          )}
          {titulosEncontrados && titulosEncontrados.length === 0 && (
            <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "8px 12px", borderRadius: 8, fontSize: 12 }}>
              No se encontró ningún título registrado para esta cédula.
            </div>
          )}
        </div>

        <a
          href="https://www.senescyt.gob.ec/consulta-titulos-web/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-block", background: GOLD, color: NAVY, fontWeight: 700, fontSize: 13, padding: "10px 18px", borderRadius: 8, textDecoration: "none", marginBottom: 24 }}
        >
          Abrir consulta oficial SENESCYT (manual) ↗
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

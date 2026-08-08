"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { calcularIndiceIntegridad } from "@/lib/mindeval-scoring";
import type { SeveridadAlerta } from "@/lib/mindeval-types";

interface Props {
  candidatoId: string;
  sesionTipo: "psicometricas" | "tecnica" | "assessment";
  onInvalidar?: () => void;
}

interface AlertaLocal {
  tipo: string;
  severidad: SeveridadAlerta;
  hora: string;
}

/**
 * Señales verificables desde el navegador — sin inventar analítica que no
 * existe (no hay detección de audio ni de rostro en esta versión; ver
 * mindeval-seleccion.md Paso 8 para el plan de detección de rostro opcional
 * con face-api.js). Cada evento se registra en mindeval_alertas_fraude vía
 * insert público (RLS permite anon insert en esa tabla).
 */
export default function AntiFraudeMonitor({ candidatoId, sesionTipo, onInvalidar }: Props) {
  const [alertas, setAlertas] = useState<AlertaLocal[]>([]);
  const fullscreenSalidas = useRef(0);

  async function registrarAlerta(tipo: string, severidad: SeveridadAlerta, detalle?: string) {
    setAlertas((prev) => [{ tipo, severidad, hora: new Date().toLocaleTimeString("es-EC") }, ...prev].slice(0, 20));
    try {
      await supabase.from("mindeval_alertas_fraude").insert({
        candidato_id: candidatoId,
        sesion_tipo: sesionTipo,
        tipo_alerta: tipo,
        severidad,
        detalle: detalle ?? null,
      });
    } catch {
      // Fallback amigable: si falla el insert (ej. sin conexión), la prueba sigue.
      // La alerta ya quedó reflejada localmente para el candidato/reclutador.
    }
  }

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) registrarAlerta("Cambio de pestaña / minimizado", "medio");
    }
    function onFullscreenChange() {
      if (!document.fullscreenElement) {
        fullscreenSalidas.current += 1;
        const severidad: SeveridadAlerta = fullscreenSalidas.current >= 3 ? "critico" : "alto";
        registrarAlerta(`Salida de pantalla completa (${fullscreenSalidas.current}ª vez)`, severidad);
      }
    }
    function onCopy() {
      registrarAlerta("Copiar contenido del examen", "medio");
    }
    function onPaste(e: ClipboardEvent) {
      e.preventDefault();
      registrarAlerta("Intento de pegar contenido", "medio");
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatoId, sesionTipo]);

  const indice = calcularIndiceIntegridad(alertas.map((a) => ({ severidad: a.severidad })));
  const alertasGraves = alertas.filter((a) => a.severidad === "alto" || a.severidad === "critico").length;

  const colorIndice = indice >= 80 ? "#12805C" : indice >= 50 ? "#F5B800" : "#C4402F";

  return (
    <div
      style={{
        background: "#18244C",
        border: "1px solid #2C3E77",
        borderRadius: 14,
        padding: "16px 18px",
        color: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "#0FA85F",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 700 }}>Monitoreo anti-fraude activo</span>
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: colorIndice }}>
          Integridad: {indice}%
        </span>
      </div>

      {alertas.length === 0 ? (
        <div style={{ fontSize: 12, color: "#8FA0CC" }}>Sin alertas registradas en esta sesión.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
          {alertas.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, fontSize: 11.5 }}>
              <span style={{ color: "#8FA0CC", flex: "none" }}>{a.hora}</span>
              <span style={{ color: "#FFFFFF" }}>{a.tipo}</span>
            </div>
          ))}
        </div>
      )}

      {alertasGraves >= 3 && onInvalidar && (
        <button
          onClick={onInvalidar}
          style={{
            background: "transparent",
            border: "1px solid #FF5A46",
            color: "#FF8A78",
            fontSize: 12,
            fontWeight: 600,
            padding: "8px 12px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Invalidar prueba (3+ alertas graves)
        </button>
      )}
    </div>
  );
}

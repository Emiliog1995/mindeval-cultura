"use client";

import { useEffect, useRef, useState } from "react";
import { calcularIndiceIntegridad } from "@/lib/mindeval-scoring";
import { authHeaders } from "@/lib/auth-headers";
import type { SeveridadAlerta } from "@/lib/mindeval-types";

interface Props {
  candidatoId: string;
  sesionTipo: "psicometricas" | "tecnica" | "assessment";
  // Presente cuando lo renderiza el candidato sin login durante su examen
  // (/seleccion/prueba/[token]). Ausente cuando lo activa un reclutador
  // autenticado desde la ficha del candidato — en ese caso se manda el
  // Authorization de la sesión en su lugar.
  token?: string;
  onInvalidar?: () => void;
  // Modo estricto (instituciones, ej. USECIPOL): cada salida de la prueba se
  // registra EN EL MOMENTO de salir (no al volver), cuenta como una de las
  // `maxSalidas` permitidas, y al exceder se llama a `onExcedido` (el portal
  // envía lo respondido y cierra). Cerrar NO invalida: las respuestas se
  // conservan y quien revisa decide con las alertas y el video.
  estricto?: boolean;
  maxSalidas?: number;
  onExcedido?: () => void;
}

interface AlertaLocal {
  tipo: string;
  severidad: SeveridadAlerta;
  hora: string;
}

/**
 * ¿El examen se está rindiendo desde un teléfono? Se decide por el tipo de
 * puntero, no por el user-agent: un dispositivo sin puntero fino es táctil.
 * Importa porque las mismas señales significan cosas distintas en cada uno
 * (ver UMBRAL_BREVE_S abajo).
 */
function esDispositivoTactil(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

// Una ausencia más corta que esto, en un celular, es una notificación, una
// llamada entrante o el bloqueo automático de pantalla — no es fraude, y
// penalizarla castigaba a quien no tiene computadora (auditoría 2026-09,
// F2-3). En escritorio no se aplica: ahí salir de la pestaña 20 segundos es
// justo el caso que interesa detectar.
const UMBRAL_BREVE_S = 60;
const UMBRAL_LARGO_S = 5 * 60;

/**
 * Señales verificables desde el navegador — sin inventar analítica que no
 * existe (no hay detección de audio ni de rostro en esta versión; ver
 * mindeval-seleccion.md Paso 8 para el plan de detección de rostro opcional
 * con face-api.js). Cada evento se registra vía /api/mindeval-alerta-fraude,
 * que valida el token de examen (candidato) o la sesión autenticada (staff)
 * antes de insertar — un insert público sin esa validación permitía
 * registrar alertas contra cualquier candidato_id, sin rate limit.
 *
 * Dos correcciones de la auditoría 2026-09 (F2-3):
 *
 *  1) La pantalla completa ahora se pide de verdad. Antes había un listener
 *     de 'fullscreenchange' pero NADIE llamaba a requestFullscreen() en todo
 *     el proyecto: el modo nunca se activaba, así que las únicas alertas de
 *     severidad alta/crítica eran inalcanzables y el botón de invalidar
 *     jamás aparecía. Se pide con un gesto del usuario (los navegadores no
 *     permiten otra cosa) y solo se penaliza salir de ella si llegó a
 *     activarse — nunca "tu dispositivo no la soporta".
 *
 *  2) Las salidas se miden por duración, no por el hecho de ocurrir. En un
 *     celular, iOS Safari ni siquiera ofrece pantalla completa fuera de
 *     video, y cualquier notificación dispara 'visibilitychange': el
 *     candidato honesto que rendía desde su teléfono llegaba al final con la
 *     integridad hundida sin haber hecho nada malo.
 */
export default function AntiFraudeMonitor({ candidatoId, sesionTipo, token, onInvalidar, estricto = false, maxSalidas = 2, onExcedido }: Props) {
  const [alertas, setAlertas] = useState<AlertaLocal[]>([]);
  const [fullscreenActivo, setFullscreenActivo] = useState(false);
  const [soportaFullscreen, setSoportaFullscreen] = useState(true);
  const fullscreenSalidas = useRef(0);
  const fullscreenLogrado = useRef(false);
  const ocultoDesde = useRef<number | null>(null);
  const tactil = useRef(false);
  // Modo estricto
  const salidasEstrictas = useRef(0);
  const episodioActivo = useRef(false);
  const ultimaSalida = useRef(0);
  const excedido = useRef(false);
  const [aviso, setAviso] = useState<{ n: number } | null>(null);
  // Siempre la versión más reciente: los listeners se crean una sola vez y, si
  // capturaran `onExcedido` directo, enviarían la prueba con respuestas viejas.
  const onExcedidoRef = useRef(onExcedido);
  onExcedidoRef.current = onExcedido;

  async function registrarAlerta(tipo: string, severidad: SeveridadAlerta, detalle?: string, keepalive = false) {
    setAlertas((prev) => [{ tipo, severidad, hora: new Date().toLocaleTimeString("es-EC") }, ...prev].slice(0, 20));
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (!token) Object.assign(headers, await authHeaders());

      await fetch("/api/mindeval-alerta-fraude", {
        method: "POST",
        headers,
        // keepalive: la petición sigue aunque la pestaña ya esté oculta.
        keepalive,
        body: JSON.stringify({
          token,
          candidato_id: candidatoId,
          sesion_tipo: sesionTipo,
          tipo_alerta: tipo,
          severidad,
          detalle: detalle ?? null,
        }),
      });
    } catch {
      // Fallback amigable: si falla el insert (ej. sin conexión), la prueba sigue.
      // La alerta ya quedó reflejada localmente para el candidato/reclutador.
    }
  }

  /**
   * Modo estricto: registra la salida al instante y cuenta una de las
   * permitidas. `esEpisodio` = salida por ocultar pestaña / perder foco (dura
   * hasta volver); la de pantalla completa es puntual. 1,5 s de margen para no
   * contar dos veces un mismo gesto que dispara varios eventos a la vez.
   */
  function salidaEstricta(motivo: string, esEpisodio: boolean) {
    if (!estricto || excedido.current) return;
    const ahora = Date.now();
    if (ahora - ultimaSalida.current < 1500) return;
    if (esEpisodio) {
      if (episodioActivo.current) return;
      episodioActivo.current = true;
    }
    ultimaSalida.current = ahora;
    salidasEstrictas.current += 1;
    const n = salidasEstrictas.current;
    const supera = n > maxSalidas;
    registrarAlerta(`${motivo} (salida ${n} de ${maxSalidas} permitidas)`, supera ? "critico" : "alto", undefined, true);
    if (supera) {
      excedido.current = true;
      registrarAlerta("Prueba cerrada automáticamente por exceder las salidas permitidas", "critico", undefined, true);
      onExcedidoRef.current?.();
      return;
    }
    setAviso({ n });
  }

  function volvioALaPrueba() {
    if (!estricto) return;
    episodioActivo.current = false;
  }

  /**
   * Solo puede llamarse desde un gesto del usuario — de ahí que sea un botón
   * y no algo automático al montar. Si el navegador la rechaza (iOS Safari
   * no la soporta fuera de video), se marca como no disponible y la prueba
   * sigue con normalidad: NO se registra ninguna alerta por eso.
   */
  async function activarFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
      fullscreenLogrado.current = true;
      setFullscreenActivo(true);
    } catch {
      setSoportaFullscreen(false);
    }
  }

  useEffect(() => {
    tactil.current = esDispositivoTactil();
    setSoportaFullscreen(!!document.documentElement.requestFullscreen);
  }, []);

  useEffect(() => {
    function onVisibilityChange() {
      if (estricto) {
        if (document.hidden) salidaEstricta("Salió de la prueba (cambio de pestaña o de aplicación)", true);
        else volvioALaPrueba();
        return;
      }
      if (document.hidden) {
        ocultoDesde.current = Date.now();
        return;
      }
      // Se registra al VOLVER, porque solo entonces se sabe cuánto tiempo
      // estuvo fuera — que es lo que distingue una notificación de irse a
      // buscar la respuesta.
      const desde = ocultoDesde.current;
      ocultoDesde.current = null;
      if (!desde) return;

      const segundos = Math.round((Date.now() - desde) / 1000);
      const breve = segundos <= UMBRAL_BREVE_S;

      let severidad: SeveridadAlerta;
      if (tactil.current) {
        // Celular: una ausencia corta no cuenta (0 puntos), pero queda
        // registrada para que el reclutador la vea si quiere.
        severidad = breve ? "bajo" : segundos <= UMBRAL_LARGO_S ? "medio" : "alto";
      } else {
        severidad = segundos <= UMBRAL_LARGO_S ? "medio" : "alto";
      }

      const duracion = segundos < 60 ? `${segundos}s` : `${Math.round(segundos / 60)} min`;
      registrarAlerta(
        `Salió de la prueba (${duracion})`,
        severidad,
        tactil.current && breve ? "Ausencia breve desde un dispositivo móvil — no penalizada" : undefined
      );
    }

    function onFullscreenChange() {
      const activo = !!document.fullscreenElement;
      setFullscreenActivo(activo);
      // El portal de instituciones la activa por su cuenta (en el clic de
      // "Continuar"), no desde el botón de este componente: también cuenta.
      if (activo) fullscreenLogrado.current = true;
      if (estricto) {
        // En estricto, salir de pantalla completa es una salida más.
        if (!activo && fullscreenLogrado.current) salidaEstricta("Salió de pantalla completa", false);
        return;
      }
      // Solo se penaliza salir de un modo que de verdad llegó a activarse.
      // Sin esta guarda, un dispositivo que no soporta pantalla completa
      // podía acumular alertas graves sin que el candidato hiciera nada.
      if (!activo && fullscreenLogrado.current) {
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

    // Escritorio: cambiar de ventana sin cambiar de pestaña (Cmd/Alt+Tab,
    // otra app encima) no dispara visibilitychange pero sí blur. En celular
    // blur salta con el teclado o el selector del sistema: ahí solo cuenta
    // ocultar la app.
    function onBlur() {
      if (estricto && !tactil.current) salidaEstricta("Salió de la ventana de la prueba", true);
    }
    function onFocus() {
      if (!document.hidden) volvioALaPrueba();
    }
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
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
    <>
      {estricto && aviso && !excedido.current && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(11,16,32,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#FFFFFF", borderRadius: 16, padding: "28px 26px", maxWidth: 420, textAlign: "center" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1B2A5B", marginBottom: 8 }}>
              Salió de la prueba ({aviso.n} de {maxSalidas} permitidas)
            </div>
            <p style={{ fontSize: 13.5, color: "#33405F", lineHeight: 1.6, marginBottom: 6 }}>
              Esta salida quedó registrada. {aviso.n >= maxSalidas ? <strong>Si vuelve a salir, la prueba se cerrará y se enviará lo que haya respondido.</strong> : `Le queda ${maxSalidas - aviso.n} salida permitida.`}
            </p>
            <p style={{ fontSize: 12, color: "#7C89A8", marginBottom: 16 }}>El tiempo de la prueba sigue corriendo.</p>
            <button
              onClick={() => {
                setAviso(null);
                document.documentElement.requestFullscreen?.().catch(() => {});
              }}
              style={{ background: "#F5B800", color: "#1B2A5B", border: "none", padding: "12px 22px", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer" }}
            >
              Entendido, volver a la prueba
            </button>
          </div>
        </div>
      )}
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

      {/* La pantalla completa se ofrece, no se impone: en un dispositivo que
          no la soporta (iOS Safari) el aviso explica que no pasa nada, en vez
          de dejar al candidato creyendo que está incumpliendo algo. */}
      {soportaFullscreen && !fullscreenActivo && (
        <button
          onClick={activarFullscreen}
          style={{ background: "#F5B800", color: "#18244C", border: "none", fontSize: 12.5, fontWeight: 700, padding: "9px 12px", borderRadius: 8, cursor: "pointer" }}
        >
          Activar pantalla completa
        </button>
      )}
      {soportaFullscreen && fullscreenActivo && (
        <div style={{ fontSize: 11.5, color: "#7BE3B4" }}>✓ Pantalla completa activa</div>
      )}
      {!soportaFullscreen && (
        <div style={{ fontSize: 11.5, color: "#8FA0CC", lineHeight: 1.5 }}>
          Tu dispositivo no permite pantalla completa. No hay problema: puedes rendir la prueba normalmente y esto no
          afecta tu evaluación.
        </div>
      )}

      {alertas.length === 0 ? (
        <div style={{ fontSize: 12, color: "#8FA0CC" }}>Sin alertas registradas en esta sesión.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
          {alertas.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, fontSize: 11.5 }}>
              <span style={{ color: "#8FA0CC", flex: "none" }}>{a.hora}</span>
              <span style={{ color: a.severidad === "bajo" ? "#8FA0CC" : "#FFFFFF" }}>
                {a.tipo}
                {a.severidad === "bajo" && <span style={{ color: "#7BE3B4" }}> · no penalizada</span>}
              </span>
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
    </>
  );
}

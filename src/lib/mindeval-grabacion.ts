"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Grabación de proctoring para el portal del evaluado (cámara + micrófono).
 *
 * Modelo grabar-y-revisar, NO streaming en vivo: se graba toda la sesión en
 * el navegador y al terminar se sube el video a Supabase Storage para que el
 * cliente (p. ej. USECIPOL) lo revise después. Se eligió así a propósito —
 * MindEval corre en Vercel (serverless) y no sostiene WebSockets como el
 * backend NestJS de la plataforma original. Sin streaming no hace falta
 * socket.io ni un servidor persistente, y la subida va directa del navegador
 * al Storage para no chocar con el límite de cuerpo de las funciones de Vercel.
 *
 * Usa solo APIs estándar del navegador (getUserMedia + MediaRecorder). Sin
 * reconocimiento facial: la revisión de la grabación es humana (así se detecta
 * uso de celular, un tercero en la sala, etc.). Las alertas de navegador
 * (cambio de pestaña, copiar/pegar, salir de pantalla completa) ya las maneja
 * AntiFraudeMonitor; esto solo agrega la cámara y el audio.
 */

export type EstadoGrabacion = "inactiva" | "grabando" | "detenida" | "error";

export interface ChequeoDispositivos {
  camara: boolean;
  microfono: boolean;
  pantallaUnica: boolean;
  errores: string[];
}

function mejorMimeType(): string {
  // Orden de preferencia: webm con vp8+opus es el más compatible para
  // cámara + audio; se cae a webm genérico si el navegador no lo soporta.
  const candidatos = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const t of candidatos) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "video/webm";
}

export function useGrabacionProctoring() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("video/webm");

  const [estado, setEstado] = useState<EstadoGrabacion>("inactiva");
  const [error, setError] = useState<string | null>(null);

  /**
   * Verifica que haya cámara y micrófono antes de empezar, y avisa si hay
   * monitores adicionales. No deja rastro: corta los tracks que abre para
   * probar. Se llama en la pantalla de instrucciones, antes de la prueba.
   */
  const chequearDispositivos = useCallback(async (): Promise<ChequeoDispositivos> => {
    const r: ChequeoDispositivos = { camara: false, microfono: false, pantallaUnica: true, errores: [] };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      r.camara = true;
      r.microfono = true;
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") {
        r.errores.push("Debe permitir el acceso a la cámara y al micrófono para rendir la prueba.");
      } else {
        // Puede faltar solo uno de los dos: se prueban por separado para
        // decirle al evaluado exactamente qué falta.
        try {
          const vs = await navigator.mediaDevices.getUserMedia({ video: true });
          r.camara = true;
          vs.getTracks().forEach((t) => t.stop());
        } catch {
          r.errores.push("No se detecta una cámara conectada.");
        }
        try {
          const as = await navigator.mediaDevices.getUserMedia({ audio: true });
          r.microfono = true;
          as.getTracks().forEach((t) => t.stop());
        } catch {
          r.errores.push("No se detecta un micrófono conectado.");
        }
      }
    }

    if (typeof window !== "undefined" && window.screen && window.screen.width !== window.screen.availWidth) {
      r.pantallaUnica = false;
      r.errores.push("Se detectaron pantallas externas. Desconecte los monitores adicionales.");
    }

    return r;
  }, []);

  const adjuntarPreview = useCallback(() => {
    if (streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.muted = true; // evita eco del propio micrófono en el preview
      videoRef.current.play().catch(() => {});
    }
  }, []);

  /** Abre cámara+micrófono y empieza a grabar. Devuelve true si arrancó. */
  const iniciar = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      chunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: true,
      });
      streamRef.current = stream;
      adjuntarPreview();

      const mime = mejorMimeType();
      mimeRef.current = mime;
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 200_000, audioBitsPerSecond: 32_000 });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(5000); // vuelca un trozo cada 5 s: si el navegador se
      // cierra de golpe, no se pierde toda la grabación, solo el último tramo.
      recorderRef.current = recorder;
      setEstado("grabando");
      return true;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setError(
        name === "NotAllowedError"
          ? "Permiso de cámara o micrófono denegado."
          : name === "NotFoundError"
            ? "No se encontró cámara o micrófono."
            : "No se pudo iniciar la grabación."
      );
      setEstado("error");
      return false;
    }
  }, [adjuntarPreview]);

  /**
   * Detiene la grabación y devuelve el video como Blob (o null si no había
   * nada). Corta la cámara y el micrófono. La subida a Storage la hace quien
   * llama, con el Blob devuelto.
   */
  const detener = useCallback((): Promise<{ blob: Blob | null; mime: string }> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      const cerrarStream = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
      };

      if (!recorder || recorder.state === "inactive") {
        cerrarStream();
        setEstado("detenida");
        const blob = chunksRef.current.length ? new Blob(chunksRef.current, { type: mimeRef.current }) : null;
        resolve({ blob, mime: mimeRef.current });
        return;
      }

      // Red de seguridad: si stop() se cuelga, no bloqueamos el envío de la
      // prueba. Se resuelve igual con lo que haya.
      const t = setTimeout(() => {
        cerrarStream();
        setEstado("detenida");
        const blob = chunksRef.current.length ? new Blob(chunksRef.current, { type: mimeRef.current }) : null;
        resolve({ blob, mime: mimeRef.current });
      }, 4000);

      recorder.onstop = () => {
        clearTimeout(t);
        cerrarStream();
        setEstado("detenida");
        const blob = chunksRef.current.length ? new Blob(chunksRef.current, { type: mimeRef.current }) : null;
        resolve({ blob, mime: mimeRef.current });
      };
      recorder.stop();
    });
  }, []);

  // Al desmontar, nunca dejar la cámara encendida.
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try { recorderRef.current.stop(); } catch { /* noop */ }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return { videoRef, estado, error, chequearDispositivos, iniciar, detener, adjuntarPreview };
}

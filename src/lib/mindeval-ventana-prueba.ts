import "server-only";

/**
 * Cuánto tiempo vive el enlace de una prueba agendada, contado desde la hora
 * a la que se le agendó al candidato. Si se le agenda para las 09:00, puede
 * entrar hasta las 09:00 del día siguiente.
 *
 * Esto NO es la duración del examen: una vez que el candidato desbloquea el
 * contenido, el tiempo que tiene para responder lo define el reclutador (la
 * batería/modo de la prueba) y lo gobierna el cronómetro anclado a
 * `iniciada_en` del lado del servidor. Son dos relojes distintos: este dice
 * "hasta cuándo puedes empezar", el otro "cuánto dura una vez empezaste".
 *
 * Antes había DOS límites peleando por lo mismo: una expiración de 7 días y
 * un corte de "1 hora después de la hora agendada". El corto siempre ganaba,
 * así que el candidato tenía 90 minutos reales de vida y los 7 días eran
 * letra muerta -- quien no podía entrar en esa hora y media obligaba al
 * reclutador a reagendarlo a mano, uno por uno (auditoría 2026-09, F2-2).
 * Ahora es un solo plazo, con un solo mensaje.
 */
export const VENTANA_HORAS = 24;

/** Gracia para entrar antes de la hora agendada. */
const GRACIA_ANTES_MIN = 30;

export interface SesionVentana {
  fecha_programada: string;
  estado: string;
}

export function limiteDeAcceso(sesion: SesionVentana): Date {
  return new Date(new Date(sesion.fecha_programada).getTime() + VENTANA_HORAS * 60 * 60_000);
}

/**
 * Una sesión ya completada nunca "expira". Una `en_curso` tampoco: el
 * candidato ya desbloqueó el contenido y su intento lo gobierna el
 * cronómetro del servidor, así que echarlo por la ventana de acceso sería
 * sacarlo a mitad de su propio examen -- justo lo que la ventana no debe
 * hacer.
 */
export function sesionExpirada(sesion: SesionVentana): boolean {
  if (sesion.estado === "completada" || sesion.estado === "en_curso") return false;
  return Date.now() > limiteDeAcceso(sesion).getTime();
}

export function todaviaNoDisponible(sesion: SesionVentana): boolean {
  return new Date(sesion.fecha_programada).getTime() > Date.now() + GRACIA_ANTES_MIN * 60_000;
}

/** Fecha/hora legible en Ecuador — el correo y los mensajes de error deben
 *  decir el plazo real, no un "ya pasó tu hora" sin referencia. */
export function formatoEcuador(fecha: Date | string): string {
  return new Date(fecha).toLocaleString("es-EC", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  });
}

export function mensajeExpirada(sesion: SesionVentana): string {
  return `El plazo para rendir esta prueba venció el ${formatoEcuador(limiteDeAcceso(sesion))} (hora Ecuador). Contacta al reclutador para que te agende un nuevo horario.`;
}

export function mensajeNoDisponible(sesion: SesionVentana): string {
  return `Esta prueba todavía no está disponible. Podrás entrar desde el ${formatoEcuador(sesion.fecha_programada)} (hora Ecuador) y tendrás ${VENTANA_HORAS} horas para rendirla.`;
}

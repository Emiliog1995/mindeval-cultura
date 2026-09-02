import "server-only";
import { Resend } from "resend";
import type { TipoSesionPrueba } from "./mindeval-types";
import { VENTANA_HORAS, limiteDeAcceso, formatoEcuador } from "@/lib/mindeval-ventana-prueba";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

// El SDK de Resend lanza una excepción en su propio constructor si no hay
// API key — instanciarlo a nivel de módulo tumbaría el build entero (o
// cualquier ruta que importe este archivo) en un entorno sin
// RESEND_API_KEY configurada. Cada función abajo ya maneja la ausencia de
// la key como fallback amigable, así que la instancia se crea de forma
// perezosa, solo cuando sabemos que la key existe.
function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

const LABEL_TIPO: Record<TipoSesionPrueba, string> = {
  psicometrica: "prueba psicométrica",
  tecnica: "prueba técnica",
  assessment: "assessment center",
};

// nombreCandidato/tituloVacante/empresa llegan de datos que el propio
// candidato (o, para empresa/vacante, el reclutador) escribió en un
// formulario — nunca se insertan crudos en el HTML del correo.
function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function enviarInvitacionPrueba(params: {
  to: string;
  nombreCandidato: string;
  tituloVacante: string;
  empresa: string;
  tipo: TipoSesionPrueba;
  fechaProgramada: string;
  link: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY no configurada" };
  }

  // Esta función corre en el servidor de Vercel (zona UTC) -- sin
  // timeZone explícito, toLocaleString("es-EC", ...) solo cambiaba el
  // idioma del texto, no el huso horario, y el correo anunciaba la hora 5
  // horas adelantada a la real en Ecuador (auditoría 2026-09, I-1).
  const fecha = new Date(params.fechaProgramada).toLocaleString("es-EC", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  });
  // Hasta cuándo puede entrar. El correo tiene que decirlo: antes solo
  // anunciaba la hora de inicio y el candidato no tenía forma de saber que
  // el enlace se le cerraba (auditoría 2026-09, F2-2).
  const limite = formatoEcuador(limiteDeAcceso({ fecha_programada: params.fechaProgramada, estado: "programada" }));
  const label = LABEL_TIPO[params.tipo];
  const nombreCandidato = escapeHtml(params.nombreCandidato);
  const tituloVacante = escapeHtml(params.tituloVacante);
  const empresa = escapeHtml(params.empresa);

  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: ${NAVY}; padding: 24px 28px; border-radius: 10px 10px 0 0;">
        <div style="color: ${GOLD}; font-weight: 800; font-size: 18px;">MindEval</div>
      </div>
      <div style="border: 1px solid #E3E8F2; border-top: none; border-radius: 0 0 10px 10px; padding: 28px;">
        <p style="font-size: 14px; color: #1B2A5B;">Hola ${nombreCandidato},</p>
        <p style="font-size: 14px; color: #33405F; line-height: 1.6;">
          Como parte del proceso de selección para <strong>${tituloVacante}</strong> en ${empresa},
          te invitamos a rendir tu <strong>${label}</strong>.
        </p>
        <p style="font-size: 14px; color: #33405F; line-height: 1.6;">
          <strong>Puedes empezar desde:</strong> ${fecha} (hora Ecuador)<br />
          <strong>Tienes plazo hasta:</strong> ${limite} (hora Ecuador)
        </p>
        <p style="font-size: 13px; color: #33405F; line-height: 1.6; background: #F7F9FD; border-radius: 8px; padding: 10px 14px;">
          Tienes ${VENTANA_HORAS} horas para entrar y rendirla. No hace falta que sea exactamente a la hora de inicio:
          entra cuando puedas dentro de ese plazo. Eso sí, una vez que abras la prueba el cronómetro empieza a correr
          y ya no se detiene, así que ábrela cuando tengas el tiempo y la tranquilidad para terminarla de una sola vez.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${params.link}" style="background: ${GOLD}; color: ${NAVY}; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px; display: inline-block;">
            Ir a mi prueba
          </a>
        </div>
        <p style="font-size: 12px; color: #7C89A8; line-height: 1.6;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
          <a href="${params.link}" style="color: ${NAVY};">${params.link}</a>
        </p>
        <p style="font-size: 12px; color: #7C89A8; line-height: 1.6;">
          Ten a mano una conexión estable y realiza la prueba desde un solo dispositivo, sin cambiar de pestaña ni salir de la aplicación. Si puedes hacerla desde una computadora, mejor — pero desde el celular también es válido.
        </p>
      </div>
    </div>
  `;

  try {
    const { error } = await getResend().emails.send({
      from: process.env.RESEND_FROM ?? "MindEval <onboarding@resend.dev>",
      to: params.to,
      subject: `Invitación a tu ${label} — ${params.tituloVacante}`,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al enviar el correo" };
  }
}

/**
 * Correo genérico de "no seleccionado" — deliberadamente sin mencionar en
 * qué etapa ni por qué motivo se descartó al candidato (evita exponer
 * criterios internos de evaluación o abrir un reclamo puntual por etapa).
 */
export async function enviarNoSeleccionado(params: {
  to: string;
  nombreCandidato: string;
  tituloVacante: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY no configurada" };
  }

  const nombreCandidato = escapeHtml(params.nombreCandidato);
  const tituloVacante = escapeHtml(params.tituloVacante);

  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: ${NAVY}; padding: 24px 28px; border-radius: 10px 10px 0 0;">
        <div style="color: ${GOLD}; font-weight: 800; font-size: 18px;">MindEval</div>
      </div>
      <div style="border: 1px solid #E3E8F2; border-top: none; border-radius: 0 0 10px 10px; padding: 28px;">
        <p style="font-size: 14px; color: #1B2A5B;">Hola ${nombreCandidato},</p>
        <p style="font-size: 14px; color: #33405F; line-height: 1.6;">
          Gracias por tu interés y por el tiempo dedicado al proceso de selección para
          <strong>${tituloVacante}</strong>.
        </p>
        <p style="font-size: 14px; color: #33405F; line-height: 1.6;">
          Luego de revisar tu perfil, en esta ocasión no continuarás en el proceso, ya que no
          alcanzaste uno de los requisitos evaluados en las distintas etapas. Esta decisión no
          refleja necesariamente tu potencial profesional y te invitamos a postular a futuras
          vacantes que se ajusten a tu perfil.
        </p>
        <p style="font-size: 14px; color: #33405F; line-height: 1.6;">
          Te deseamos mucho éxito en tus próximos pasos.
        </p>
      </div>
    </div>
  `;

  try {
    const { error } = await getResend().emails.send({
      from: process.env.RESEND_FROM ?? "MindEval <onboarding@resend.dev>",
      to: params.to,
      subject: `Resultado de tu postulación — ${params.tituloVacante}`,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al enviar el correo" };
  }
}

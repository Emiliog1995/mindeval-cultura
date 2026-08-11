import "server-only";
import { Resend } from "resend";
import type { TipoSesionPrueba } from "./mindeval-types";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

const resend = new Resend(process.env.RESEND_API_KEY);

const LABEL_TIPO: Record<TipoSesionPrueba, string> = {
  psicometrica: "prueba psicométrica",
  tecnica: "prueba técnica",
  assessment: "assessment center",
};

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

  const fecha = new Date(params.fechaProgramada).toLocaleString("es-EC", { dateStyle: "full", timeStyle: "short" });
  const label = LABEL_TIPO[params.tipo];

  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: ${NAVY}; padding: 24px 28px; border-radius: 10px 10px 0 0;">
        <div style="color: ${GOLD}; font-weight: 800; font-size: 18px;">MindEval</div>
      </div>
      <div style="border: 1px solid #E3E8F2; border-top: none; border-radius: 0 0 10px 10px; padding: 28px;">
        <p style="font-size: 14px; color: #1B2A5B;">Hola ${params.nombreCandidato},</p>
        <p style="font-size: 14px; color: #33405F; line-height: 1.6;">
          Como parte del proceso de selección para <strong>${params.tituloVacante}</strong> en ${params.empresa},
          te invitamos a rendir tu <strong>${label}</strong>.
        </p>
        <p style="font-size: 14px; color: #33405F; line-height: 1.6;">
          <strong>Fecha y hora programada:</strong> ${fecha}
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
          Ten a mano una conexión estable y realiza la prueba desde un solo dispositivo, sin cambiar de pestaña ni salir de pantalla completa.
        </p>
      </div>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
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

  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: ${NAVY}; padding: 24px 28px; border-radius: 10px 10px 0 0;">
        <div style="color: ${GOLD}; font-weight: 800; font-size: 18px;">MindEval</div>
      </div>
      <div style="border: 1px solid #E3E8F2; border-top: none; border-radius: 0 0 10px 10px; padding: 28px;">
        <p style="font-size: 14px; color: #1B2A5B;">Hola ${params.nombreCandidato},</p>
        <p style="font-size: 14px; color: #33405F; line-height: 1.6;">
          Gracias por tu interés y por el tiempo dedicado al proceso de selección para
          <strong>${params.tituloVacante}</strong>.
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
    const { error } = await resend.emails.send({
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

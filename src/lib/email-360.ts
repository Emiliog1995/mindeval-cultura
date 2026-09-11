import "server-only";
import { Resend } from "resend";
import { remitente, escapeHtml } from "@/lib/mindeval-email";
import { FUENTE_LABELS, type FuenteEvaluacion } from "@/lib/360-types";

/**
 * Correo que lleva el enlace de evaluación 360° a cada evaluador.
 *
 * No reusa la plantilla de Selección a propósito: aquel correo va dirigido a
 * un candidato externo y lleva la marca MindEval. Este va a alguien que
 * trabaja en la organización evaluada, así que el encabezado es de la propia
 * organización y la plataforma queda como pie discreto. La paleta es la del
 * módulo 360 (#0A1A32 / #10b981), la misma que verá al abrir el formulario.
 */
const NAVY = "#0A1A32";
const VERDE = "#10b981";

/** Frase que explica el vínculo. Es lo primero que el evaluador necesita entender. */
function encabezadoPorFuente(fuente: FuenteEvaluacion, evaluado: string): { asunto: string; intro: string } {
  if (fuente === "autoevaluacion") {
    return {
      asunto: "Tu autoevaluación de desempeño",
      intro: "Te toca completar tu <strong>autoevaluación</strong>. Es tu propia mirada sobre cómo trabajaste en este período, y es una de las fuentes que se toman en cuenta.",
    };
  }
  const rol = FUENTE_LABELS[fuente].toLowerCase();
  const comoLoConoce: Record<string, string> = {
    jefe: "como su <strong>jefe directo</strong>",
    par: "como su <strong>par</strong>, es decir alguien que ocupa el mismo cargo",
    colaborador: "como <strong>colaborador/a</strong>, es decir alguien que le reporta directamente",
    cliente_interno: "como su <strong>cliente interno</strong>, es decir alguien que recibe el resultado de su trabajo",
  };
  return {
    asunto: `Evalúa a ${evaluado}`,
    intro: `Fuiste seleccionado/a para evaluar a <strong>${evaluado}</strong> ${comoLoConoce[fuente] ?? `como ${rol}`}.`,
  };
}

export async function enviarInvitacion360(params: {
  to: string;
  nombreEvaluador: string;
  nombreEvaluado: string;
  fuente: FuenteEvaluacion;
  empresa: string;
  periodo: string;
  link: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY no configurada" };
  }
  const emisor = remitente();
  if ("error" in emisor) return { ok: false, error: emisor.error };

  // Los nombres vienen de la nómina que cargó el cliente: nunca crudos en el HTML.
  const evaluador = escapeHtml(params.nombreEvaluador);
  const evaluado = escapeHtml(params.nombreEvaluado);
  const empresa = escapeHtml(params.empresa);
  const periodo = escapeHtml(params.periodo);
  const { asunto, intro } = encabezadoPorFuente(params.fuente, evaluado);

  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: ${NAVY}; padding: 26px 28px; border-radius: 10px 10px 0 0;">
        <div style="color: #ffffff; font-weight: 800; font-size: 17px; line-height: 1.3;">${empresa}</div>
        <div style="color: ${VERDE}; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; margin-top: 4px;">
          EVALUACIÓN DE DESEMPEÑO 360° · ${periodo}
        </div>
      </div>
      <div style="border: 1px solid #e3e8f2; border-top: none; border-radius: 0 0 10px 10px; padding: 28px;">
        <p style="font-size: 14px; color: ${NAVY}; margin-top: 0;">Hola ${evaluador},</p>

        <p style="font-size: 14px; color: #33405f; line-height: 1.6;">${intro}</p>

        <p style="font-size: 14px; color: #33405f; line-height: 1.6;">
          Vas a calificar del <strong>1 al 5</strong> una serie de competencias. Al abrir el enlace
          encontrarás qué significa cada número, para que todos evaluemos con el mismo criterio.
          Te toma unos <strong>5 minutos</strong>.
        </p>

        <div style="background: #f7f9fd; border-left: 3px solid ${VERDE}; border-radius: 6px; padding: 12px 14px; margin: 18px 0;">
          <p style="font-size: 13px; color: #33405f; line-height: 1.6; margin: 0;">
            Este enlace es personal y <strong>se responde una sola vez</strong>. Al enviarlo se cierra,
            así que complétalo de corrido cuando tengas unos minutos con tranquilidad.
          </p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${params.link}" style="background: ${VERDE}; color: ${NAVY}; text-decoration: none; font-weight: 700; font-size: 14px; padding: 13px 26px; border-radius: 8px; display: inline-block;">
            Entrar a la evaluación
          </a>
        </div>

        <p style="font-size: 12px; color: #7c89a8; line-height: 1.6;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
          <a href="${params.link}" style="color: ${NAVY};">${params.link}</a>
        </p>

        <p style="font-size: 11.5px; color: #7c89a8; line-height: 1.6; margin-top: 22px; border-top: 1px solid #e3e8f2; padding-top: 14px;">
          Tus respuestas se consolidan con las del resto de evaluadores para construir el resultado final.
          Si crees que este mensaje no era para ti, puedes ignorarlo.<br />
          <span style="color: #9aa5bd;">Proceso gestionado con MindHealth · MINDTALENT</span>
        </p>
      </div>
    </div>
  `;

  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: emisor.from,
      to: params.to,
      subject: `${asunto} — ${params.empresa}`,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al enviar el correo" };
  }
}

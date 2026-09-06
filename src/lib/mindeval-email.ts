import "server-only";
import { Resend } from "resend";
import type { TipoSesionPrueba } from "./mindeval-types";
import { VENTANA_HORAS, limiteDeAcceso, formatoEcuador } from "@/lib/mindeval-ventana-prueba";

/**
 * Remitente configurado. Antes esto era `process.env.RESEND_FROM ?? "MindEval
 * <onboarding@resend.dev>"` — el dominio sandbox de Resend, que SOLO entrega
 * a la dirección del titular de la cuenta y rechaza cualquier envío a un
 * tercero. Si la variable faltaba en Vercel, el sistema no fallaba: enviaba
 * al sandbox, la API rechazaba el correo del candidato, y el proceso se
 * detenía sin que nadie entendiera por qué (auditoría 2026-09, C-1).
 *
 * Ahora la ausencia de la variable es un error explícito y accionable, del
 * mismo modo que ya lo era la falta de RESEND_API_KEY. Es preferible que el
 * reclutador vea "falta configurar el remitente" en el panel a que crea que
 * la invitación salió cuando no salió.
 */
function remitente(): { from: string } | { error: string } {
  const from = process.env.RESEND_FROM;
  if (!from?.trim()) {
    return { error: "Falta configurar RESEND_FROM con un dominio verificado. Sin eso los correos no llegan a los candidatos." };
  }
  if (/@resend\.dev\s*>?\s*$/i.test(from)) {
    return { error: "RESEND_FROM apunta al dominio de pruebas de Resend (@resend.dev), que solo entrega correo al titular de la cuenta. Configura un dominio propio verificado." };
  }
  return { from };
}

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

// El SDK de Resend lanza una excepción en su propio constructor si no hay
// API key — instanciarlo a nivel de módulo tumbaría el build entero (o
// cualquier ruta que importe este archivo) en un entorno sin
// RESEND_API_KEY configurada. Cada función abajo ya maneja la ausencia de
// la key como fallback amigable, así que la instancia se crea de forma
// perezosa, solo cuando sabemos que la key existe.
export interface ContactoVacante {
  nombre?: string | null;
  email?: string | null;
}

/**
 * Envoltura común de todos los correos al candidato. Antes cada función
 * repetía su propio HTML y ninguna incluía lo básico de un correo
 * transaccional serio: quién lo manda, a quién responder si algo falla, y
 * una nota para quien lo recibe por error (auditoría 2026-09, M-4).
 */
function plantilla(params: { cuerpo: string; contacto?: ContactoVacante; empresa?: string }): string {
  const contactoHtml =
    params.contacto?.email
      ? `<p style="font-size: 12.5px; color: #33405F; line-height: 1.6; margin-top: 20px;">
           ¿Tienes alguna duda o algo no te funciona? Escríbenos a
           <a href="mailto:${escapeHtml(params.contacto.email)}" style="color: ${NAVY}; font-weight: 700;">${escapeHtml(params.contacto.email)}</a>${
             params.contacto.nombre ? ` (${escapeHtml(params.contacto.nombre)})` : ""
           }.
         </p>`
      : "";

  return `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: ${NAVY}; padding: 24px 28px; border-radius: 10px 10px 0 0;">
        <div style="color: ${GOLD}; font-weight: 800; font-size: 18px;">MindEval</div>
        <div style="color: #A9B6D8; font-size: 11px; letter-spacing: 0.5px;">BY MINDTALENT${params.empresa ? ` · ${escapeHtml(params.empresa)}` : ""}</div>
      </div>
      <div style="border: 1px solid #E3E8F2; border-top: none; border-radius: 0 0 10px 10px; padding: 28px;">
        ${params.cuerpo}
        ${contactoHtml}
        <p style="font-size: 11.5px; color: #7C89A8; line-height: 1.6; margin-top: 22px; border-top: 1px solid #E3E8F2; padding-top: 14px;">
          Si no reconoces este mensaje o no te postulaste a esta vacante, puedes ignorarlo: no se hará nada con tus datos.
        </p>
      </div>
    </div>
  `;
}

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
  contacto?: ContactoVacante;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY no configurada" };
  }
  const emisor = remitente();
  if ("error" in emisor) return { ok: false, error: emisor.error };

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

  // Pasa por `plantilla` como el resto de correos al candidato. Antes armaba
  // su propio HTML y era, justamente, el único que NO llevaba a quién
  // escribirle: el correo que trae el enlace para rendir es donde más falta
  // hace un contacto, porque si el enlace no le abre, el candidato se queda
  // sin salida.
  const cuerpo = `
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
  `;

  try {
    const { error } = await getResend().emails.send({
      from: emisor.from,
      to: params.to,
      subject: `Invitación a tu ${label} — ${params.tituloVacante}`,
      html: plantilla({ cuerpo, contacto: params.contacto, empresa: params.empresa }),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al enviar el correo" };
  }
}

/**
 * Recordatorio a quien recibió su invitación y todavía no ha entrado. Lo
 * dispara el reclutador desde el panel de la vacante (no hay tarea
 * automática en este proyecto — ver el comentario de cierre por fecha
 * límite en mindeval-types.ts).
 *
 * Va con su propio asunto y su propio texto en vez de reenviar la
 * invitación tal cual: un correo idéntico al de ayer se lee como un envío
 * duplicado por error, no como un aviso de que se le está acabando el plazo.
 * El enlace es el MISMO de siempre — no se genera ninguno nuevo.
 */
export async function enviarRecordatorioPrueba(params: {
  to: string;
  nombreCandidato: string;
  tituloVacante: string;
  empresa: string;
  tipo: TipoSesionPrueba;
  fechaProgramada: string;
  link: string;
  contacto?: ContactoVacante;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY no configurada" };
  const emisor = remitente();
  if ("error" in emisor) return { ok: false, error: emisor.error };

  const limite = formatoEcuador(limiteDeAcceso({ fecha_programada: params.fechaProgramada, estado: "programada" }));
  const label = LABEL_TIPO[params.tipo];
  const nombreCandidato = escapeHtml(params.nombreCandidato);
  const tituloVacante = escapeHtml(params.tituloVacante);

  const cuerpo = `
    <p style="font-size: 14px; color: #1B2A5B;">Hola ${nombreCandidato},</p>
    <p style="font-size: 14px; color: #33405F; line-height: 1.6;">
      Te escribimos para recordarte que todavía tienes pendiente tu <strong>${label}</strong>
      del proceso de selección para <strong>${tituloVacante}</strong>.
    </p>
    <p style="font-size: 14px; color: #33405F; line-height: 1.6; background: #FFFBEF; border: 1px solid #F3E0AE; border-radius: 8px; padding: 12px 14px;">
      <strong>Tu plazo vence el ${limite}</strong> (hora Ecuador). Si no la rindes antes de esa hora,
      el enlace deja de funcionar.
    </p>
    <p style="font-size: 13px; color: #33405F; line-height: 1.6;">
      Es el mismo enlace que te enviamos antes — no necesitas uno nuevo. Recuerda que al abrirlo
      el cronómetro empieza a correr, así que entra cuando tengas el tiempo para terminarla de una sola vez.
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
  `;

  try {
    const { error } = await getResend().emails.send({
      from: emisor.from,
      to: params.to,
      subject: `Recordatorio: te queda pendiente tu ${label} — ${params.tituloVacante}`,
      html: plantilla({ cuerpo, contacto: params.contacto, empresa: params.empresa }),
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
  const emisor = remitente();
  if ("error" in emisor) return { ok: false, error: emisor.error };

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
      from: emisor.from,
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

/**
 * Los tres correos que faltaban (auditoría 2026-09, I-7). Antes solo existían
 * la invitación a prueba y el "no seleccionado": el candidato quedaba en
 * silencio total entre uno y otro, y el reclutador tenía que entrar al panel
 * a revisar a mano si alguien había avanzado.
 *
 * Todos son best-effort desde el punto de vista de quien los llama: que falle
 * un acuse de recibo nunca debe tumbar una postulación ya guardada ni una
 * prueba ya calificada.
 */
export async function enviarPostulacionRecibida(params: {
  to: string;
  nombreCandidato: string;
  tituloVacante: string;
  empresa: string;
  contacto?: ContactoVacante;
  cvIlegible?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY no configurada" };
  const emisor = remitente();
  if ("error" in emisor) return { ok: false, error: emisor.error };

  const nombreCandidato = escapeHtml(params.nombreCandidato);
  const tituloVacante = escapeHtml(params.tituloVacante);

  const avisoCv = params.cvIlegible
    ? `<div style="background: #FFFBEF; border: 1px solid #F3E0AE; border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #8A6400; line-height: 1.6; margin-top: 16px;">
         <strong>Un detalle sobre tu hoja de vida:</strong> la recibimos, pero no pudimos leer su texto — suele pasar
         con archivos escaneados o fotografiados. Tu postulación quedó registrada igual, pero si puedes reenviarla
         como PDF de texto (exportado desde Word o Google Docs) tu perfil se analiza mucho mejor. Vuelve a llenar el
         formulario con la misma cédula y actualizamos tus datos.
       </div>`
    : "";

  const cuerpo = `
    <p style="font-size: 14px; color: #1B2A5B;">Hola ${nombreCandidato},</p>
    <p style="font-size: 14px; color: #33405F; line-height: 1.6;">
      Recibimos tu postulación para <strong>${tituloVacante}</strong>. Ya está en revisión.
    </p>
    <p style="font-size: 14px; color: #33405F; line-height: 1.6;">
      Si tu perfil avanza a la siguiente etapa, te escribiremos a este mismo correo con las instrucciones.
      No necesitas hacer nada más por ahora — y no hace falta que vuelvas a postular.
    </p>
    ${avisoCv}
  `;

  try {
    const { error } = await getResend().emails.send({
      from: emisor.from,
      to: params.to,
      subject: `Recibimos tu postulación — ${params.tituloVacante}`,
      html: plantilla({ cuerpo, contacto: params.contacto, empresa: params.empresa }),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al enviar el correo" };
  }
}

export async function enviarPruebaCompletada(params: {
  to: string;
  nombreCandidato: string;
  tituloVacante: string;
  empresa: string;
  tipo: TipoSesionPrueba;
  contacto?: ContactoVacante;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY no configurada" };
  const emisor = remitente();
  if ("error" in emisor) return { ok: false, error: emisor.error };

  const cuerpo = `
    <p style="font-size: 14px; color: #1B2A5B;">Hola ${escapeHtml(params.nombreCandidato)},</p>
    <p style="font-size: 14px; color: #33405F; line-height: 1.6;">
      Confirmamos que completaste tu <strong>${LABEL_TIPO[params.tipo]}</strong> para
      <strong>${escapeHtml(params.tituloVacante)}</strong>. Tus respuestas quedaron guardadas correctamente.
    </p>
    <p style="font-size: 14px; color: #33405F; line-height: 1.6;">
      El equipo de reclutamiento revisará tus resultados y te contactará con los siguientes pasos.
      No tienes que volver a rendirla.
    </p>
  `;

  try {
    const { error } = await getResend().emails.send({
      from: emisor.from,
      to: params.to,
      subject: `Recibimos tu ${LABEL_TIPO[params.tipo]} — ${params.tituloVacante}`,
      html: plantilla({ cuerpo, contacto: params.contacto, empresa: params.empresa }),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al enviar el correo" };
  }
}

/**
 * Aviso interno al reclutador. No pasa por `plantilla` a propósito: no lleva
 * la nota de "si no reconoces este mensaje", que solo tiene sentido para un
 * candidato, y sí lleva el enlace directo a la ficha.
 */
export async function enviarAvisoPruebaRendida(params: {
  to: string;
  nombreCandidato: string;
  tituloVacante: string;
  tipo: TipoSesionPrueba;
  linkFicha: string;
  incompleta?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY no configurada" };
  const emisor = remitente();
  if ("error" in emisor) return { ok: false, error: emisor.error };

  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: ${NAVY}; padding: 20px 24px; border-radius: 10px 10px 0 0;">
        <div style="color: ${GOLD}; font-weight: 800; font-size: 16px;">MindEval · Aviso de proceso</div>
      </div>
      <div style="border: 1px solid #E3E8F2; border-top: none; border-radius: 0 0 10px 10px; padding: 24px;">
        <p style="font-size: 14px; color: #33405F; line-height: 1.6;">
          <strong>${escapeHtml(params.nombreCandidato)}</strong> acaba de completar su
          <strong>${LABEL_TIPO[params.tipo]}</strong> del proceso
          <strong>${escapeHtml(params.tituloVacante)}</strong>.
        </p>
        ${
          params.incompleta
            ? `<p style="font-size: 13px; color: #8A6400; background: #FFFBEF; border: 1px solid #F3E0AE; border-radius: 8px; padding: 10px 12px; line-height: 1.6;">
                 Se envió por tiempo agotado y quedó incompleta, así que no cuenta para el % de idoneidad.
               </p>`
            : ""
        }
        <div style="text-align: center; margin: 24px 0;">
          <a href="${params.linkFicha}" style="background: ${GOLD}; color: ${NAVY}; text-decoration: none; font-weight: 700; font-size: 14px; padding: 11px 22px; border-radius: 8px; display: inline-block;">
            Ver sus resultados
          </a>
        </div>
      </div>
    </div>
  `;

  try {
    const { error } = await getResend().emails.send({
      from: emisor.from,
      to: params.to,
      subject: `${params.nombreCandidato} completó su ${LABEL_TIPO[params.tipo]} — ${params.tituloVacante}`,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al enviar el correo" };
  }
}

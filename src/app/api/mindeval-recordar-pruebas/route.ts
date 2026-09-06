import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { enviarRecordatorioPrueba } from "@/lib/mindeval-email";
import { sesionExpirada } from "@/lib/mindeval-ventana-prueba";
import type { SesionPrueba, Vacante } from "@/lib/mindeval-types";

/**
 * Recordatorio en lote a los candidatos de una vacante que ya recibieron su
 * invitación y todavía NO han abierto la prueba.
 *
 * Por qué existe: el reclutador ya podía ver quién no había entrado y
 * reenviarle el enlace, pero de a uno. Con un lote de veinte candidatos eso
 * eran veinte clics, así que en la práctica nadie avisaba y el candidato que
 * no abrió el correo simplemente se le vencía el plazo en silencio.
 *
 * Lo dispara el reclutador desde el panel; no hay tarea automática (este
 * proyecto evita los cron a propósito -- ver mindeval-types.ts).
 *
 * Qué NO hace, a propósito:
 * - No toca sesiones 'en_curso': el candidato ya entró y su cronómetro
 *   corre; recordarle algo que está haciendo ahora mismo solo confunde.
 * - No toca 'completada' ni 'expirada'. Para una vencida ya existe
 *   "Reenviar invitación", que además la reactiva -- reactivar en lote y
 *   sin querer sería regalar plazo a quien ya lo perdió.
 * - No genera enlaces nuevos ni mueve la fecha: es el mismo token y el
 *   mismo plazo que ya tenía.
 */
export async function POST(req: NextRequest) {
  try {
    const { vacante_id: vacanteId, tipo }: { vacante_id?: string; tipo?: string } = await req.json();
    if (!vacanteId) return NextResponse.json({ error: "Falta la vacante" }, { status: 400 });

    const authError = await requireAuth(req, "seleccion", { vacanteId });
    if (authError) return authError;

    const { permitido } = checkRateLimit(req, "mindeval-recordar-pruebas");
    if (!permitido) return rateLimitResponse();

    const { data: vacante } = await supabaseAdmin
      .from("mindeval_vacantes")
      .select("titulo, empresa, contacto_nombre, contacto_email")
      .eq("id", vacanteId)
      .single();
    if (!vacante) return NextResponse.json({ error: "No se encontró la vacante" }, { status: 404 });

    let consulta = supabaseAdmin
      .from("mindeval_sesiones_prueba")
      .select("*, mindeval_candidatos(nombre_completo, email)")
      .eq("vacante_id", vacanteId)
      .eq("estado", "programada");
    if (tipo) consulta = consulta.eq("tipo", tipo);

    const { data: sesiones, error } = await consulta;
    if (error) return NextResponse.json({ error: "No se pudieron leer las invitaciones" }, { status: 500 });

    const enviados: string[] = [];
    const omitidos: { nombre: string; motivo: string }[] = [];

    for (const sesion of (sesiones ?? []) as (SesionPrueba & {
      mindeval_candidatos: { nombre_completo: string; email: string | null } | null;
    })[]) {
      const candidato = sesion.mindeval_candidatos;
      const nombre = candidato?.nombre_completo ?? "—";

      // Ya se le pasó el plazo: no es un recordatorio, es una reactivación,
      // y esa es una decisión por candidato (botón "Reenviar invitación").
      if (sesionExpirada(sesion)) {
        omitidos.push({ nombre, motivo: "Ya se le venció el plazo — usa 'Reenviar invitación' para reactivarlo" });
        continue;
      }
      if (!candidato?.email) {
        omitidos.push({ nombre, motivo: "Sin correo registrado" });
        continue;
      }

      const envio = await enviarRecordatorioPrueba({
        to: candidato.email,
        nombreCandidato: candidato.nombre_completo,
        tituloVacante: (vacante as Vacante).titulo,
        empresa: (vacante as Vacante).empresa,
        tipo: sesion.tipo,
        fechaProgramada: sesion.fecha_programada,
        link: `${req.nextUrl.origin}/seleccion/prueba/${sesion.token}`,
        contacto: { nombre: (vacante as Vacante).contacto_nombre, email: (vacante as Vacante).contacto_email },
      });

      if (envio.ok) enviados.push(nombre);
      else omitidos.push({ nombre, motivo: `No se pudo enviar el correo: ${envio.error}` });
    }

    return NextResponse.json({ enviados, omitidos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudieron enviar los recordatorios";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

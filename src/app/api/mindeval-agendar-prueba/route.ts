import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { enviarInvitacionPrueba } from "@/lib/mindeval-email";
import type { SesionPrueba, TipoSesionPrueba, Vacante } from "@/lib/mindeval-types";

/**
 * Agenda una prueba (psicométrica o técnica) para uno o varios candidatos y
 * envía la invitación por correo automáticamente al email con el que se
 * postularon. Usa supabaseAdmin porque necesita leer el email del candidato
 * y el título/empresa de la vacante antes de escribir la sesión — mismo
 * criterio que el resto de rutas server-side del proyecto.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req, "seleccion");
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "mindeval-agendar-prueba");
  if (!permitido) return rateLimitResponse();

  try {
    const { vacante_id, tipo, fecha_programada, candidato_ids }: {
      vacante_id: string;
      tipo: TipoSesionPrueba;
      fecha_programada: string;
      candidato_ids: string[];
    } = await req.json();

    if (!vacante_id || !tipo || !fecha_programada || !candidato_ids?.length) {
      return NextResponse.json({ error: "Faltan datos para agendar la prueba" }, { status: 400 });
    }

    const { data: vacante, error: vErr } = await supabaseAdmin
      .from("mindeval_vacantes")
      .select("*")
      .eq("id", vacante_id)
      .single();
    if (vErr || !vacante) return NextResponse.json({ error: "No se encontró la vacante" }, { status: 404 });

    const { data: candidatos } = await supabaseAdmin
      .from("mindeval_candidatos")
      .select("id, nombre_completo, email")
      .in("id", candidato_ids);

    const resultados: { candidato_id: string; nombre: string; ok: boolean; motivo?: string; sesion?: SesionPrueba }[] = [];

    for (const candidatoId of candidato_ids) {
      const candidato = candidatos?.find((c) => c.id === candidatoId);
      if (!candidato) {
        resultados.push({ candidato_id: candidatoId, nombre: "—", ok: false, motivo: "Candidato no encontrado" });
        continue;
      }

      const { data: sesion, error: sErr } = await supabaseAdmin
        .from("mindeval_sesiones_prueba")
        .insert({ candidato_id: candidatoId, vacante_id, tipo, fecha_programada: new Date(fecha_programada).toISOString() })
        .select()
        .single();
      if (sErr || !sesion) {
        resultados.push({ candidato_id: candidatoId, nombre: candidato.nombre_completo, ok: false, motivo: "No se pudo crear la sesión" });
        continue;
      }

      if (!candidato.email) {
        resultados.push({ candidato_id: candidatoId, nombre: candidato.nombre_completo, ok: false, motivo: "Sin correo registrado — copia el enlace manualmente", sesion });
        continue;
      }

      const link = `${req.nextUrl.origin}/seleccion/prueba/${sesion.token}`;
      const envio = await enviarInvitacionPrueba({
        to: candidato.email,
        nombreCandidato: candidato.nombre_completo,
        tituloVacante: (vacante as Vacante).titulo,
        empresa: (vacante as Vacante).empresa,
        tipo,
        fechaProgramada: fecha_programada,
        link,
      });

      resultados.push({
        candidato_id: candidatoId,
        nombre: candidato.nombre_completo,
        ok: envio.ok,
        motivo: envio.ok ? undefined : `Sesión creada, pero falló el correo: ${envio.error}`,
        sesion,
      });
    }

    return NextResponse.json({ resultados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al agendar la prueba";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

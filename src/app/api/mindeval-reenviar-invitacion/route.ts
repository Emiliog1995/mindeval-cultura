import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { enviarInvitacionPrueba } from "@/lib/mindeval-email";
import type { TipoSesionPrueba, Vacante } from "@/lib/mindeval-types";

/**
 * Vuelve a enviar la invitación de una prueba REUTILIZANDO la sesión que ya
 * existe — mismo token, mismo enlace.
 *
 * Por qué existe: antes no había forma de reenviar. Si al candidato se le
 * perdía el correo o le caía en spam, la única salida del reclutador era
 * agendarle la prueba otra vez, lo que creaba una segunda sesión con un token
 * nuevo sin invalidar la anterior. El candidato quedaba con dos enlaces vivos
 * y podía rendir dos veces (auditoría 2026-09, I-12).
 *
 * Si el plazo ya venció, se reinicia desde ahora en vez de crear una sesión
 * nueva: el candidato recibe un enlace que funciona y sigue habiendo uno solo.
 * Una sesión ya completada nunca se reabre.
 */
export async function POST(req: NextRequest) {
  try {
    const { candidato_id: candidatoId, tipo }: { candidato_id: string; tipo?: TipoSesionPrueba } = await req.json();
    if (!candidatoId) return NextResponse.json({ error: "Falta el candidato" }, { status: 400 });

    const authError = await requireAuth(req, "seleccion", { candidatoId });
    if (authError) return authError;

    const { permitido } = checkRateLimit(req, "mindeval-reenviar-invitacion");
    if (!permitido) return rateLimitResponse();

    let consulta = supabaseAdmin
      .from("mindeval_sesiones_prueba")
      .select("*, mindeval_candidatos(nombre_completo, email)")
      .eq("candidato_id", candidatoId)
      .neq("estado", "completada")
      .order("fecha_programada", { ascending: false })
      .limit(1);
    if (tipo) consulta = consulta.eq("tipo", tipo);

    const { data: sesiones } = await consulta;
    const sesion = sesiones?.[0];
    if (!sesion) {
      return NextResponse.json(
        { error: "Este candidato no tiene ninguna invitación pendiente. Agéndale la prueba desde el ranking." },
        { status: 404 }
      );
    }

    const candidato = sesion.mindeval_candidatos as { nombre_completo: string; email: string | null } | null;
    if (!candidato?.email) {
      return NextResponse.json({ error: "Este candidato no tiene correo registrado. Regístralo en su ficha primero." }, { status: 400 });
    }

    const { data: vacante } = await supabaseAdmin
      .from("mindeval_vacantes")
      .select("titulo, empresa")
      .eq("id", sesion.vacante_id)
      .single();
    if (!vacante) return NextResponse.json({ error: "No se encontró la vacante" }, { status: 404 });

    // Un enlace vencido se revive desde ahora. Uno en curso NO se toca: el
    // candidato ya lo desbloqueó y su cronómetro corre; reiniciar la fecha no
    // le devolvería tiempo y solo confundiría el estado.
    let fechaProgramada: string = sesion.fecha_programada;
    if (sesion.estado === "expirada") {
      fechaProgramada = new Date().toISOString();
      const { error: updErr } = await supabaseAdmin
        .from("mindeval_sesiones_prueba")
        .update({ estado: "programada", fecha_programada: fechaProgramada })
        .eq("id", sesion.id);
      if (updErr) return NextResponse.json({ error: "No se pudo reactivar la invitación" }, { status: 500 });
    }

    const envio = await enviarInvitacionPrueba({
      to: candidato.email,
      nombreCandidato: candidato.nombre_completo,
      tituloVacante: (vacante as Vacante).titulo,
      empresa: (vacante as Vacante).empresa,
      tipo: sesion.tipo,
      fechaProgramada,
      link: `${req.nextUrl.origin}/seleccion/prueba/${sesion.token}`,
    });
    if (!envio.ok) return NextResponse.json({ error: `No se pudo enviar el correo: ${envio.error}` }, { status: 502 });

    return NextResponse.json({ ok: true, reactivada: sesion.estado === "expirada", fecha_programada: fechaProgramada });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo reenviar la invitación";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

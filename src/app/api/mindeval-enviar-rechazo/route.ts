import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { enviarNoSeleccionado } from "@/lib/mindeval-email";

/**
 * Envía el correo genérico de "no seleccionado" a un candidato descartado.
 * Disparo manual desde la ficha del candidato — nunca automático, para que
 * el reclutador confirme el descarte antes de notificarlo.
 */
export async function POST(req: NextRequest) {
  try {
    const { candidato_id, titulo_vacante, reenviar }: { candidato_id: string; titulo_vacante: string; reenviar?: boolean } = await req.json();
    if (!candidato_id || !titulo_vacante) {
      return NextResponse.json({ error: "Faltan datos para enviar el correo" }, { status: 400 });
    }

    const authError = await requireAuth(req, "seleccion", { candidatoId: candidato_id });
    if (authError) return authError;

    const { permitido } = checkRateLimit(req, "mindeval-enviar-rechazo");
    if (!permitido) return rateLimitResponse();

    const { data: candidato, error } = await supabaseAdmin
      .from("mindeval_candidatos")
      .select("nombre_completo, email, rechazo_enviado_en")
      .eq("id", candidato_id)
      .single();
    if (error || !candidato) return NextResponse.json({ error: "No se encontró el candidato" }, { status: 404 });
    if (!candidato.email) return NextResponse.json({ error: "Este candidato no tiene correo registrado" }, { status: 400 });

    // Segundo envío: se rechaza salvo que quien llama lo pida explícitamente.
    // Un candidato descartado no debe recibir dos veces el mismo correo de
    // rechazo porque alguien volvió a abrir su ficha y pulsó el botón
    // (auditoría 2026-09, F2-7).
    if (candidato.rechazo_enviado_en && !reenviar) {
      return NextResponse.json(
        {
          error: "A este candidato ya se le envió el correo de no seleccionado.",
          rechazo_enviado_en: candidato.rechazo_enviado_en,
          ya_enviado: true,
        },
        { status: 409 }
      );
    }

    const envio = await enviarNoSeleccionado({
      to: candidato.email,
      nombreCandidato: candidato.nombre_completo,
      tituloVacante: titulo_vacante,
    });
    if (!envio.ok) return NextResponse.json({ error: envio.error }, { status: 502 });

    const enviadoEn = new Date().toISOString();
    await supabaseAdmin.from("mindeval_candidatos").update({ rechazo_enviado_en: enviadoEn }).eq("id", candidato_id);

    return NextResponse.json({ ok: true, rechazo_enviado_en: enviadoEn });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al enviar el correo";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

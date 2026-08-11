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
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "mindeval-enviar-rechazo");
  if (!permitido) return rateLimitResponse();

  try {
    const { candidato_id, titulo_vacante }: { candidato_id: string; titulo_vacante: string } = await req.json();
    if (!candidato_id || !titulo_vacante) {
      return NextResponse.json({ error: "Faltan datos para enviar el correo" }, { status: 400 });
    }

    const { data: candidato, error } = await supabaseAdmin
      .from("mindeval_candidatos")
      .select("nombre_completo, email")
      .eq("id", candidato_id)
      .single();
    if (error || !candidato) return NextResponse.json({ error: "No se encontró el candidato" }, { status: 404 });
    if (!candidato.email) return NextResponse.json({ error: "Este candidato no tiene correo registrado" }, { status: 400 });

    const envio = await enviarNoSeleccionado({
      to: candidato.email,
      nombreCandidato: candidato.nombre_completo,
      tituloVacante: titulo_vacante,
    });
    if (!envio.ok) return NextResponse.json({ error: envio.error }, { status: 502 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al enviar el correo";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

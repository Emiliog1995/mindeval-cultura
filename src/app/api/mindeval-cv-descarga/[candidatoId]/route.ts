import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Genera un link de descarga temporal (2 min) para el CV de un candidato,
 * staff-only. El bucket mindeval-cvs es privado -- nunca se expone una URL
 * pública ni permanente, cada descarga pide una firma nueva.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ candidatoId: string }> }) {
  const { candidatoId } = await params;

  const authError = await requireAuth(req, "seleccion", { candidatoId });
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "mindeval-cv-descarga");
  if (!permitido) return rateLimitResponse();

  const { data: candidato } = await supabaseAdmin.from("mindeval_candidatos").select("cv_url").eq("id", candidatoId).maybeSingle();
  if (!candidato?.cv_url) {
    return NextResponse.json({ error: "Este candidato no tiene hoja de vida cargada" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin.storage.from("mindeval-cvs").createSignedUrl(candidato.cv_url, 120);
  if (error || !data) {
    return NextResponse.json({ error: "No se pudo generar el link de descarga" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}

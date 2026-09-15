import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * Cómo llama una organización a sus competencias.
 *
 * Es pública a propósito y no devuelve nada más: la usa el modo demostración
 * (/evaluar-360/demo?empresa=...) para que, al mostrarle el formulario a la
 * organización antes de lanzarlo, las competencias aparezcan con el nombre que
 * ellos usan y no con el genérico. No expone datos de personas ni resultados.
 */
export async function GET(req: NextRequest) {
  const { permitido } = checkRateLimit(req, "360-competencias");
  if (!permitido) return rateLimitResponse();

  const empresaId = req.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) {
    return NextResponse.json({ error: "Falta empresa_id" }, { status: 400 });
  }

  const { data } = await supabaseAdmin
    .from("empresas_mdt")
    .select("competencias_labels")
    .eq("id", empresaId)
    .maybeSingle();

  return NextResponse.json({ competenciaLabels: data?.competencias_labels ?? null });
}

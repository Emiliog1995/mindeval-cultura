import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { consultarSenescyt } from "@/lib/mindeval-senescyt";

/**
 * Consulta individual, disparada desde la ficha del candidato
 * (/candidato/[id]/verificacion) — nunca guarda nada por sí sola, solo
 * devuelve lo que encontró el proveedor para que el reclutador lo revise y
 * confirme desde el formulario. Ver mindeval-senescyt.ts para el detalle de
 * la consulta y mindeval-verificar-senescyt-masivo para la versión en lote.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req, "seleccion");
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "mindeval-verificar-senescyt");
  if (!permitido) return rateLimitResponse();

  const { cedula }: { cedula: string } = await req.json();
  const resultado = await consultarSenescyt(cedula);

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }
  return NextResponse.json({ estado: resultado.estado, titulos: resultado.titulos });
}

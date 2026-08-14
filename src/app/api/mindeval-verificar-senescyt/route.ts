import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { consultarSenescyt } from "@/lib/mindeval-senescyt";

/**
 * Consulta individual, disparada desde la ficha del candidato
 * (/candidato/[id]/verificacion) — nunca guarda nada por sí sola, solo
 * devuelve lo que encontró el proveedor para que el reclutador lo revise y
 * confirme desde el formulario. Ver mindeval-senescyt.ts para el detalle de
 * la consulta y mindeval-verificar-senescyt-masivo para la versión en lote.
 *
 * Exige candidato_id y verifica que la cédula consultada sea la que ese
 * candidato declaró al postular — antes cualquier cuenta con módulo
 * Selección podía consultar la cédula de cualquier persona (no
 * necesariamente un candidato del proceso), a $0.10 por consulta, sin más
 * freno que el rate limit genérico.
 */
export async function POST(req: NextRequest) {
  const { cedula, candidato_id }: { cedula: string; candidato_id: string } = await req.json();
  if (!cedula || !candidato_id) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const authError = await requireAuth(req, "seleccion", { candidatoId: candidato_id });
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "mindeval-verificar-senescyt");
  if (!permitido) return rateLimitResponse();

  const { data: candidato } = await supabaseAdmin.from("mindeval_candidatos").select("cedula").eq("id", candidato_id).maybeSingle();
  if (!candidato || candidato.cedula !== cedula) {
    return NextResponse.json({ error: "La cédula no coincide con la registrada para este candidato" }, { status: 400 });
  }

  const resultado = await consultarSenescyt(cedula);

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }
  return NextResponse.json({ estado: resultado.estado, titulos: resultado.titulos });
}

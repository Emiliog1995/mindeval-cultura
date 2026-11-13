import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { autorizarInstitucion } from "@/lib/mindeval-institucion";
import { cargarResultadosEvaluado } from "@/lib/mindeval-institucion-resultados";

/**
 * Resultados de un evaluado de un proceso de institución (USECIPOL): puntajes
 * objetivos, completitud, alertas y -- si ya se generó -- el último informe
 * con IA. Sin veredictos automáticos: la persona que revisa decide.
 */
export async function GET(req: NextRequest) {
  const vacanteId = req.nextUrl.searchParams.get("vacante_id");
  const candidatoId = req.nextUrl.searchParams.get("candidato_id");
  if (!vacanteId || !candidatoId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const aut = await autorizarInstitucion(req, { roles: ["super_admin", "administrador", "evaluador"], vacanteId });
  if ("error" in aut) return aut.error;

  const { permitido } = checkRateLimit(req, "mindeval-institucion-resultados");
  if (!permitido) return rateLimitResponse();

  const resultado = await cargarResultadosEvaluado(vacanteId, candidatoId);
  if (!resultado) return NextResponse.json({ error: "Evaluado no encontrado en este proceso" }, { status: 404 });

  const { data: informe } = await supabaseAdmin
    .from("mindeval_informes_ia")
    .select("contenido, generado_en")
    .eq("candidato_id", candidatoId)
    .eq("tipo", "perfil")
    .order("generado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ ...resultado, informe: informe ?? null });
}

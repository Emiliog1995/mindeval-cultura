import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { autorizarInstitucion } from "@/lib/mindeval-institucion";
import { cargarResultadosEvaluado } from "@/lib/mindeval-institucion-resultados";
import { observacionHolland } from "@/lib/mindeval-holland";

/**
 * Informe general del grupo para el test vocacional de Holland (formato de
 * USECIPOL): Nombre | Cédula | Resultado (código) | Observación, más los
 * puntajes por área. Calificación determinista, sin IA.
 */
export async function GET(req: NextRequest) {
  const vacanteId = req.nextUrl.searchParams.get("vacante_id");
  if (!vacanteId) return NextResponse.json({ error: "Falta el proceso" }, { status: 400 });

  const aut = await autorizarInstitucion(req, { roles: ["super_admin", "administrador", "evaluador"], vacanteId });
  if ("error" in aut) return aut.error;

  const { permitido } = checkRateLimit(req, "mindeval-institucion-informe-grupal");
  if (!permitido) return rateLimitResponse();

  const { data: candidatos } = await supabaseAdmin
    .from("mindeval_candidatos")
    .select("id")
    .eq("vacante_id", vacanteId)
    .order("nombre_completo");

  const filas = [];
  for (const c of candidatos ?? []) {
    const r = await cargarResultadosEvaluado(vacanteId, c.id);
    if (!r) continue;
    const h = r.pruebas.find((p) => p.codigo === "holland");
    filas.push({
      nombre: r.evaluado.nombre,
      cedula: r.evaluado.cedula,
      perfil: r.perfil,
      rindio: !!h,
      codigo: h?.patron ?? null,
      incompleta: !!h?.completitud?.incompleta,
      observacion: h?.patron ? observacionHolland(h.patron, r.perfil) : null,
      puntajes: h ? Object.fromEntries(h.escalas.map((e) => [e.escala, e.sten])) : null,
    });
  }

  const v = aut.vacante as { titulo?: string } | undefined;
  return NextResponse.json({ institucion: aut.empresaNombre, proceso: v?.titulo ?? "", filas });
}

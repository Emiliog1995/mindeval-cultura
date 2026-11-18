import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { autorizarInstitucion } from "@/lib/mindeval-institucion";
import { cargarResultadosEvaluado } from "@/lib/mindeval-institucion-resultados";
import { generarInformePsicometricoInstitucion } from "@/lib/mindeval-ia";

export const maxDuration = 60;

/**
 * Genera (a pedido de quien revisa) el informe descriptivo con IA de un
 * evaluado de institución. Nunca se genera solo ni decide nada: ver las
 * reglas en generarInformePsicometricoInstitucion.
 */
export async function POST(req: NextRequest) {
  // Desactivado a pedido de la institución (2026-11-18): los informes que
  // se entregan son solo los calculados (individual y general), sin IA.
  if (process.env.MINDEVAL_INFORME_IA_INSTITUCION !== "1") {
    return NextResponse.json({ error: "El informe con IA no está disponible." }, { status: 410 });
  }

  const body = await req.json().catch(() => null);
  const vacanteId = body?.vacante_id as string | undefined;
  const candidatoId = body?.candidato_id as string | undefined;
  if (!vacanteId || !candidatoId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const aut = await autorizarInstitucion(req, { roles: ["super_admin", "administrador", "evaluador"], vacanteId });
  if ("error" in aut) return aut.error;

  const { permitido } = checkRateLimit(req, "mindeval-institucion-informe");
  if (!permitido) return rateLimitResponse();

  const r = await cargarResultadosEvaluado(vacanteId, candidatoId);
  if (!r) return NextResponse.json({ error: "Evaluado no encontrado en este proceso" }, { status: 404 });
  if (r.pruebas.length === 0) {
    return NextResponse.json({ error: "Este evaluado todavía no tiene resultados para informar." }, { status: 409 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta configurar ANTHROPIC_API_KEY en el servidor." }, { status: 500 });
  }

  try {
    const contenido = await generarInformePsicometricoInstitucion({
      perfil: r.perfil,
      pruebas: r.pruebas.map((p) => ({
        prueba: p.prueba,
        patron: p.patron,
        incompleta: !!p.completitud?.incompleta,
        respondidos: p.completitud?.respondidos ?? null,
        esperados: p.completitud?.esperados ?? null,
        escalas: p.escalas.map((e) => ({
          escala: e.escala,
          puntaje: e.sten ?? (e.puntaje_estandar !== null ? Number(e.puntaje_estandar.toFixed(1)) : null),
          percentil: e.percentil,
        })),
      })),
      alertas: {
        total: r.alertas.length,
        graves: r.alertas.filter((a) => a.severidad === "alto" || a.severidad === "critico").length,
      },
    });

    const { data, error } = await supabaseAdmin
      .from("mindeval_informes_ia")
      .insert({ candidato_id: candidatoId, tipo: "perfil", contenido })
      .select("contenido, generado_en")
      .single();
    if (error || !data) return NextResponse.json({ error: "El informe se generó pero no se pudo guardar" }, { status: 500 });
    return NextResponse.json({ informe: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo generar el informe" }, { status: 500 });
  }
}

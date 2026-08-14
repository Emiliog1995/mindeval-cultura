import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { corregirCasoTecnico } from "@/lib/mindeval-ia";

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req, "seleccion");
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "mindeval-corregir-caso");
  if (!permitido) return rateLimitResponse();

  try {
    const {
      caso_generado,
      criterios,
      respuesta_candidato,
    }: {
      caso_generado: string;
      criterios: { analisis: number; estrategia: number; kpis: number; claridad: number };
      respuesta_candidato: string;
    } = await req.json();

    if (!respuesta_candidato?.trim()) {
      return NextResponse.json({ error: "Falta la respuesta del candidato" }, { status: 400 });
    }

    const resultado = await corregirCasoTecnico(caso_generado, criterios, respuesta_candidato);
    return NextResponse.json(resultado);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al corregir el caso técnico";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

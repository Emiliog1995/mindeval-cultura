import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { calcularMatchCv } from "@/lib/mindeval-ia";
import type { PerfilCargoManual } from "@/lib/mindeval-types";

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req, "seleccion");
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "mindeval-cv-match");
  if (!permitido) return rateLimitResponse();

  try {
    const { cv_texto, perfil_cargo }: { cv_texto: string; perfil_cargo: PerfilCargoManual | null } = await req.json();

    if (!cv_texto?.trim()) {
      return NextResponse.json({ error: "Falta el texto del CV" }, { status: 400 });
    }

    const resultado = await calcularMatchCv(cv_texto, perfil_cargo);
    return NextResponse.json(resultado);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al calcular el match de CV";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { generarCasoTecnico } from "@/lib/mindeval-ia";
import type { PerfilCargoManual } from "@/lib/mindeval-types";

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req, "seleccion");
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "mindeval-generar-caso");
  if (!permitido) return rateLimitResponse();

  try {
    const { titulo_vacante, perfil_cargo }: { titulo_vacante: string; perfil_cargo: PerfilCargoManual | null } = await req.json();
    const resultado = await generarCasoTecnico(titulo_vacante, perfil_cargo);
    return NextResponse.json(resultado);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al generar el caso técnico";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolverPerfilCargo } from "@/lib/mindeval-perfil";
import { generarBancoEjercicios } from "@/lib/mindeval-ia";
import type { Vacante } from "@/lib/mindeval-types";

/**
 * Genera un lote de ejercicios de Assessment Center con IA a partir del
 * perfil del puesto y los inserta como borrador (origen 'ia', estado
 * 'borrador') en mindeval_banco_ejercicios — el reclutador los revisa/edita/
 * activa desde /seleccion/[vacanteId]/banco-ejercicios antes de que lleguen
 * a un candidato.
 */
export async function POST(req: NextRequest) {
  try {
    const { vacante_id, cantidad }: { vacante_id: string; cantidad?: number } = await req.json();
    if (!vacante_id) {
      return NextResponse.json({ error: "Falta la vacante" }, { status: 400 });
    }

    const authError = await requireAuth(req, "seleccion", { vacanteId: vacante_id });
    if (authError) return authError;

    const { permitido } = checkRateLimit(req, "mindeval-generar-ejercicios");
    if (!permitido) return rateLimitResponse();

    const { data: vacante, error: vErr } = await supabaseAdmin
      .from("mindeval_vacantes")
      .select("*")
      .eq("id", vacante_id)
      .single();
    if (vErr || !vacante) return NextResponse.json({ error: "No se encontró la vacante" }, { status: 404 });

    const perfil = await resolverPerfilCargo(supabaseAdmin, vacante as Vacante);
    const { ejercicios } = await generarBancoEjercicios((vacante as Vacante).titulo, perfil, cantidad || 5);

    const { data: insertados, error: iErr } = await supabaseAdmin
      .from("mindeval_banco_ejercicios")
      .insert(
        ejercicios.map((e) => ({
          vacante_id,
          competencia: e.competencia,
          enunciado: e.enunciado,
          criterios_evaluacion: e.criterios_evaluacion,
          origen: "ia",
          estado: "borrador",
        }))
      )
      .select();
    if (iErr) throw new Error(iErr.message);

    return NextResponse.json({ ejercicios: insertados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al generar el banco de ejercicios";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

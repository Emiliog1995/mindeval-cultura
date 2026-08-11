import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolverPerfilCargo } from "@/lib/mindeval-perfil";
import { generarBancoPreguntas } from "@/lib/mindeval-ia";
import type { Vacante } from "@/lib/mindeval-types";

/**
 * Genera un lote de preguntas de opción múltiple con IA a partir del perfil
 * del puesto y las inserta como borrador (origen 'ia', estado 'borrador') en
 * mindeval_banco_preguntas — el reclutador las revisa/edita/activa desde
 * /seleccion/[vacanteId]/banco-preguntas antes de que lleguen a un candidato.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "mindeval-generar-banco");
  if (!permitido) return rateLimitResponse();

  try {
    const { vacante_id, cantidad }: { vacante_id: string; cantidad?: number } = await req.json();
    if (!vacante_id) {
      return NextResponse.json({ error: "Falta la vacante" }, { status: 400 });
    }

    const { data: vacante, error: vErr } = await supabaseAdmin
      .from("mindeval_vacantes")
      .select("*")
      .eq("id", vacante_id)
      .single();
    if (vErr || !vacante) return NextResponse.json({ error: "No se encontró la vacante" }, { status: 404 });

    const perfil = await resolverPerfilCargo(supabaseAdmin, vacante as Vacante);
    const { preguntas } = await generarBancoPreguntas((vacante as Vacante).titulo, perfil, cantidad || 10);

    const { data: insertadas, error: iErr } = await supabaseAdmin
      .from("mindeval_banco_preguntas")
      .insert(
        preguntas.map((p) => ({
          vacante_id,
          enunciado: p.enunciado,
          opciones: p.opciones,
          respuesta_correcta: p.respuesta_correcta,
          puntos: 10,
          origen: "ia",
          estado: "borrador",
        }))
      )
      .select();
    if (iErr) throw new Error(iErr.message);

    return NextResponse.json({ preguntas: insertadas });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al generar el banco de preguntas";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

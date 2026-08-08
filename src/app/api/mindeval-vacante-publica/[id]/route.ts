import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Único dato público sobre una vacante: título, empresa y estado — lo
 * mínimo para que el formulario de postulación se identifique sin login.
 * Nunca expone cortes, perfil_cargo_manual ni puesto_id.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("mindeval_vacantes")
    .select("titulo, empresa, estado")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Vacante no encontrada" }, { status: 404 });
  }

  return NextResponse.json(data);
}

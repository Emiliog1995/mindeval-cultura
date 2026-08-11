import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { vacanteAceptaPostulaciones } from "@/lib/mindeval-types";

/**
 * Único dato público sobre una vacante: título, empresa y si sigue
 * aceptando postulaciones (ya considerando la fecha límite, no solo el
 * campo "estado") — lo mínimo para que el formulario de postulación se
 * identifique sin login. Nunca expone cortes, perfil_cargo_manual,
 * fecha_limite_postulacion en crudo ni puesto_id.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("mindeval_vacantes")
    .select("titulo, empresa, estado, fecha_limite_postulacion")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Vacante no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    titulo: data.titulo,
    empresa: data.empresa,
    acepta_postulaciones: vacanteAceptaPostulaciones(data),
  });
}

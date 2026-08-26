import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { vacanteAceptaPostulaciones } from "@/lib/mindeval-types";

/**
 * Datos públicos sobre una vacante: título, empresa y si sigue aceptando
 * postulaciones (ya considerando la fecha límite, no solo el campo
 * "estado") — lo mínimo para que el formulario de postulación se
 * identifique sin login. `sedes` y `salario_pregunta` son opcionales y
 * solo vienen poblados en vacantes puntuales que los configuraron (ver
 * mindeval-sede-y-salario.sql) — el formulario los muestra solo si
 * existen. Nunca expone cortes, perfil_cargo_manual, fecha_limite_postulacion
 * en crudo ni puesto_id.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { permitido } = checkRateLimit(req, "mindeval-vacante-publica");
  if (!permitido) return rateLimitResponse();

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("mindeval_vacantes")
    .select("titulo, empresa, estado, fecha_limite_postulacion, sedes, salario_pregunta")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Vacante no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    titulo: data.titulo,
    empresa: data.empresa,
    acepta_postulaciones: vacanteAceptaPostulaciones(data),
    sedes: data.sedes ?? null,
    salario_pregunta: data.salario_pregunta ?? null,
  });
}

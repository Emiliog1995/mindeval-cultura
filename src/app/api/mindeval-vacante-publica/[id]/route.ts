import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { vacanteAceptaPostulaciones, type Vacante } from "@/lib/mindeval-types";
import { resolverPerfilCargo } from "@/lib/mindeval-perfil";

/**
 * Datos públicos sobre una vacante: título, empresa y si sigue aceptando
 * postulaciones (ya considerando la fecha límite, no solo el campo
 * "estado") — lo mínimo para que el formulario de postulación se
 * identifique sin login. `sedes` y `salario_pregunta` son opcionales y
 * solo vienen poblados en vacantes puntuales que los configuraron (ver
 * mindeval-sede-y-salario.sql) — el formulario los muestra solo si
 * existen. Nunca expone cortes, perfil_cargo_manual, fecha_limite_postulacion
 * en crudo ni puesto_id.
 *
 * Sí expone una versión PÚBLICA del perfil del cargo (auditoría 2026-09,
 * M-3): antes el candidato postulaba viendo únicamente el título y el nombre
 * de la empresa, sin funciones, requisitos ni área. Eso baja la calidad de
 * las postulaciones y le resta seriedad al anuncio.
 *
 * Qué se expone y qué no: van la misión del puesto, el área y los NOMBRES de
 * las competencias esperadas. Nunca los pesos, los niveles esperados ni qué
 * competencias son excluyentes — eso es el criterio de calificación, y
 * publicarlo le enseñaría al candidato exactamente qué escribir en su CV para
 * pasar el filtro con IA.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { permitido } = checkRateLimit(req, "mindeval-vacante-publica");
  if (!permitido) return rateLimitResponse();

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("mindeval_vacantes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Vacante no encontrada" }, { status: 404 });
  }

  const perfil = await resolverPerfilCargo(supabaseAdmin, data as Vacante);

  return NextResponse.json({
    titulo: data.titulo,
    empresa: data.empresa,
    acepta_postulaciones: vacanteAceptaPostulaciones(data),
    sedes: data.sedes ?? null,
    salario_pregunta: data.salario_pregunta ?? null,
    fecha_limite: data.fecha_limite_postulacion ?? null,
    perfil: perfil
      ? {
          mision: perfil.mision || null,
          area: perfil.area || null,
          competencias: [
            ...(perfil.competencias_duras ?? []).map((c) => c.nombre),
            ...(perfil.competencias_blandas ?? []).map((c) => c.nombre),
          ].filter(Boolean),
        }
      : null,
  });
}

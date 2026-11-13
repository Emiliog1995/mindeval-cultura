import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { autorizarInstitucion } from "@/lib/mindeval-institucion";

/**
 * Evaluaciones de la plataforma anterior de una institución (solo lectura).
 *  GET                  -> lista (nombre, cédula, cohorte, pruebas rendidas)
 *  GET ?id=<uuid>       -> detalle con todas las escalas
 * Super_admin pasa ?empresa_id=; administrador/evaluador ven la suya.
 * Solo puntajes: los dictámenes de la IA anterior no se importaron.
 */
export async function GET(req: NextRequest) {
  const empresaParam = req.nextUrl.searchParams.get("empresa_id");
  const aut = await autorizarInstitucion(req, { roles: ["super_admin", "administrador", "evaluador"], empresaId: empresaParam });
  if ("error" in aut) return aut.error;

  const { permitido } = checkRateLimit(req, "mindeval-institucion-historico");
  if (!permitido) return rateLimitResponse();

  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const { data, error } = await supabaseAdmin
      .from("mindeval_historico_evaluados")
      .select("id, cohorte, nombre, cedula, pruebas")
      .eq("id", id)
      .eq("empresa_id", aut.empresaId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "No se pudo cargar el registro" }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    return NextResponse.json({ evaluado: data });
  }

  const { data, error } = await supabaseAdmin
    .from("mindeval_historico_evaluados")
    .select("id, cohorte, nombre, cedula, pruebas")
    .eq("empresa_id", aut.empresaId)
    .order("nombre");
  if (error) {
    const msg = /mindeval_historico_evaluados/.test(error.message)
      ? "Falta correr la migración mindeval-historico.sql en Supabase."
      : "No se pudo cargar el historial";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // En la lista solo va el resumen; las escalas se piden al abrir cada uno.
  const evaluados = (data ?? []).map((e) => {
    const pruebas = (e.pruebas as { prueba: string; terminada_en: string | null }[]) ?? [];
    const fechas = pruebas.map((p) => p.terminada_en).filter(Boolean).sort() as string[];
    return {
      id: e.id,
      cohorte: e.cohorte,
      nombre: e.nombre,
      cedula: e.cedula,
      pruebas: pruebas.map((p) => p.prueba),
      ultima_fecha: fechas.at(-1) ?? null,
    };
  });
  return NextResponse.json({ institucion: aut.empresaNombre, evaluados });
}

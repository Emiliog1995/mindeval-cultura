import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data, error } = await supabaseAdmin
    .from("empresas_mdt")
    .select("id, nombre, logo_url")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Link no válido o expirado" }, { status: 404 });
  }

  const { data: catalogo } = await supabaseAdmin
    .from("catalogo_puestos")
    .select("nombre_puesto, area, supervisado_por, supervisa_a, actividades")
    .eq("empresa_id", data.id)
    .order("orden", { ascending: true });

  return NextResponse.json({ empresa: data, catalogo: catalogo ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();

  const { data: empresa, error: empresaError } = await supabaseAdmin
    .from("empresas_mdt")
    .select("id")
    .eq("token", token)
    .maybeSingle();

  if (empresaError || !empresa) {
    return NextResponse.json({ error: "Link no válido o expirado" }, { status: 404 });
  }

  const {
    nombre, cedula, cargoActual, area, supervisadoPor, supervisaA, actividades,
    herramientas, conocimientos, nivelEducativo, carrera, experienciaAnios,
  } = body as Record<string, unknown>;

  const { error: insertError } = await supabaseAdmin.from("respuestas_ocupante").insert({
    empresa_id: empresa.id,
    puesto_id: null,
    nombre,
    cedula,
    cargo_actual: cargoActual,
    area,
    supervisado_por: supervisadoPor || null,
    supervisa_a: supervisaA || null,
    actividades,
    herramientas,
    conocimientos,
    nivel_educativo: nivelEducativo,
    carrera,
    experiencia_anios: parseInt(String(experienciaAnios)) || 0,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

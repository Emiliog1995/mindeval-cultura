import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data, error } = await supabaseAdmin
    .from("puestos")
    .select("id, nombre_puesto, area, estado_ocupante, empresas_mdt(nombre)")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Link no válido o expirado" }, { status: 404 });
  }

  return NextResponse.json({ puesto: data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();

  const { data: puesto, error: puestoError } = await supabaseAdmin
    .from("puestos")
    .select("id, estado_ocupante")
    .eq("token", token)
    .maybeSingle();

  if (puestoError || !puesto) {
    return NextResponse.json({ error: "Link no válido o expirado" }, { status: 404 });
  }
  if (puesto.estado_ocupante === "completado") {
    return NextResponse.json({ error: "Este formulario ya fue enviado" }, { status: 409 });
  }

  const {
    nombre, cargoActual, supervisadoPor, supervisaA, actividades,
    herramientas, conocimientos, nivelEducativo, carrera, experienciaAnios,
  } = body as Record<string, unknown>;

  const { error: insertError } = await supabaseAdmin.from("respuestas_ocupante").insert({
    puesto_id: puesto.id,
    nombre,
    cargo_actual: cargoActual,
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

  const { error: updateError } = await supabaseAdmin
    .from("puestos")
    .update({ estado_ocupante: "completado" })
    .eq("id", puesto.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

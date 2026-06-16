import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data, error } = await supabaseAdmin
    .from("tokens_360")
    .select("*, evaluados_360(*)")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Link no válido o expirado" }, { status: 404 });
  }

  const { evaluados_360, ...tokenRow } = data as Record<string, unknown> & {
    evaluados_360: unknown;
  };

  return NextResponse.json({ token: tokenRow, evaluado: evaluados_360 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();
  const { competencias, potencial } = body as {
    competencias: Record<string, number>;
    potencial?: Record<string, number>;
  };

  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from("tokens_360")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "Link no válido o expirado" }, { status: 404 });
  }
  if (tokenRow.completado) {
    return NextResponse.json({ error: "Esta evaluación ya fue enviada" }, { status: 409 });
  }

  const { error: insertError } = await supabaseAdmin.from("evaluaciones_360").insert({
    evaluado_id: tokenRow.evaluado_id,
    periodo: tokenRow.periodo,
    fuente: tokenRow.fuente,
    competencias,
    potencial: tokenRow.fuente === "jefe" ? potencial : null,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("tokens_360")
    .update({ completado: true })
    .eq("token", token);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

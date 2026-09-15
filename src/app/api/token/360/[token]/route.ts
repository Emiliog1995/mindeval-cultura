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
    evaluados_360: { puesto_id?: string | null; empresa_id?: string | null } | null;
  };

  // Cómo llama esta organización a cada competencia. Quien llena el formulario
  // tiene que ver el nombre que usa su organización, no el genérico.
  let competenciaLabels: Record<string, string> | null = null;
  if (evaluados_360?.empresa_id) {
    const { data: empresa } = await supabaseAdmin
      .from("empresas_mdt")
      .select("competencias_labels")
      .eq("id", evaluados_360.empresa_id)
      .maybeSingle();
    competenciaLabels = (empresa?.competencias_labels as Record<string, string> | null) ?? null;
  }

  let indicadoresEsenciales: Array<{ id: string; indicador: string; meta: string; formula: string | null }> = [];
  const esJefe = (tokenRow as { fuente?: string }).fuente === "jefe";
  const puestoId = evaluados_360?.puesto_id;

  if (esJefe && puestoId) {
    const { data: indicadores } = await supabaseAdmin
      .from("indicadores_puesto")
      .select("id, indicador, meta, formula, actividad:actividades_puesto!actividad_esencial_id(es_esencial)")
      .eq("puesto_id", puestoId);

    indicadoresEsenciales = ((indicadores ?? []) as unknown as Array<{
      id: string; indicador: string; meta: string; formula: string | null; actividad: { es_esencial: boolean } | null;
    }>)
      .filter((row) => row.actividad?.es_esencial === true)
      .map(({ id, indicador, meta, formula }) => ({ id, indicador, meta, formula }));
  }

  return NextResponse.json({ token: tokenRow, evaluado: evaluados_360, indicadoresEsenciales, competenciaLabels });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();
  const { competencias, potencial, indicadoresResultado, necesidades } = body as {
    competencias: Record<string, number>;
    potencial?: Record<string, number>;
    indicadoresResultado?: Array<{ indicador_puesto_id: string; calificacion: number | null; sin_registro?: boolean }>;
    necesidades?: string | null;
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
    // Las necesidades las declara la propia persona: solo tienen sentido en
    // su autoevaluación, no en lo que otros opinan de ella.
    necesidades:
      tokenRow.fuente === "autoevaluacion" && typeof necesidades === "string" && necesidades.trim()
        ? necesidades.trim().slice(0, 2000)
        : null,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (tokenRow.fuente === "jefe" && indicadoresResultado?.length) {
    const { error: indicadoresError } = await supabaseAdmin
      .from("indicadores_resultado_360")
      .upsert(
        // Sin registro no se guarda como un 1: la calificación queda en NULL y
        // la marca explica por qué, para que el informe pueda distinguir
        // "cumplió poco" de "aquí no hay nada que medir".
        indicadoresResultado.map((r) => ({
          evaluado_id: tokenRow.evaluado_id,
          periodo: tokenRow.periodo,
          indicador_puesto_id: r.indicador_puesto_id,
          calificacion: r.sin_registro ? null : r.calificacion,
          sin_registro: r.sin_registro === true,
        })),
        { onConflict: "evaluado_id,periodo,indicador_puesto_id" },
      );

    if (indicadoresError) {
      return NextResponse.json({ error: indicadoresError.message }, { status: 500 });
    }
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

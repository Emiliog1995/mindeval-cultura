import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

/**
 * Elimina una evaluacion 360 generada: el evaluado y todo lo que cuelga de el
 * (tokens, respuestas, indicadores).
 *
 * Existe porque generar dos veces al mismo evaluado -- un doble clic basta --
 * deja dos juegos de enlaces vivos, y el boton de "enviar pendientes" manda
 * los dos: cada persona recibe la invitacion duplicada. Sin una forma de
 * borrar desde la interfaz, la unica salida era entrar a la base de datos.
 *
 * El borrado se pide en dos pasos a proposito: `solo_contar` devuelve que hay
 * adentro para que la confirmacion diga la verdad ("esto borra 3 respuestas ya
 * contestadas") en vez de un aviso generico que nadie lee.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req, "evaluacion_360");
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "360-eliminar-evaluado");
  if (!permitido) return rateLimitResponse();

  let body: { evaluado_id?: string; solo_contar?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo invalido" }, { status: 400 });
  }

  const evaluadoId = body.evaluado_id?.trim();
  if (!evaluadoId) {
    return NextResponse.json({ error: "Falta evaluado_id" }, { status: 400 });
  }

  const { data: evaluado, error: errEv } = await supabaseAdmin
    .from("evaluados_360")
    .select("id, nombre, cargo")
    .eq("id", evaluadoId)
    .maybeSingle();

  if (errEv) return NextResponse.json({ error: errEv.message }, { status: 500 });
  if (!evaluado) return NextResponse.json({ error: "Esa evaluacion ya no existe" }, { status: 404 });

  // Se cuenta siempre, tambien en el borrado real: es lo que se devuelve como
  // comprobante de que se borro, en vez de confiar en que no hubo error.
  const [tokens, respuestas, indicadores] = await Promise.all([
    supabaseAdmin.from("tokens_360").select("id, enviado_en, completado").eq("evaluado_id", evaluadoId),
    supabaseAdmin.from("evaluaciones_360").select("id").eq("evaluado_id", evaluadoId),
    supabaseAdmin.from("indicadores_resultado_360").select("id").eq("evaluado_id", evaluadoId),
  ]);

  const filasToken = tokens.data ?? [];
  const resumen = {
    nombre: evaluado.nombre as string,
    cargo: (evaluado.cargo as string | null) ?? null,
    tokens: filasToken.length,
    enviados: filasToken.filter((t) => t.enviado_en).length,
    respondidos: filasToken.filter((t) => t.completado).length,
    respuestas: respuestas.data?.length ?? 0,
    indicadores: indicadores.data?.length ?? 0,
  };

  if (body.solo_contar) {
    return NextResponse.json({ resumen });
  }

  // Orden de borrado: primero lo que referencia al evaluado, al final el
  // evaluado. Si una tabla falla se corta aca en vez de dejar huerfanos.
  for (const tabla of ["indicadores_resultado_360", "evaluaciones_360", "tokens_360"] as const) {
    const { error } = await supabaseAdmin.from(tabla).delete().eq("evaluado_id", evaluadoId);
    if (error) {
      return NextResponse.json(
        { error: `No se pudo borrar de ${tabla}: ${error.message}` },
        { status: 500 },
      );
    }
  }

  const { error: errBorrado } = await supabaseAdmin.from("evaluados_360").delete().eq("id", evaluadoId);
  if (errBorrado) {
    return NextResponse.json({ error: errBorrado.message }, { status: 500 });
  }

  // Verificacion contra la base: que el mensaje de exito no sea lo unico que
  // dice que se borro.
  const { data: quedo } = await supabaseAdmin
    .from("evaluados_360")
    .select("id")
    .eq("id", evaluadoId)
    .maybeSingle();

  if (quedo) {
    return NextResponse.json({ error: "El registro sigue existiendo despues del borrado" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, borrado: resumen });
}

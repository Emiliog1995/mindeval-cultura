import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { autorizarInstitucion, TESTS_VALIDOS, type TestPsico } from "@/lib/mindeval-institucion";

/**
 * Procesos de evaluación de una institución (USECIPOL).
 *  POST  : crear proceso (nombre + pruebas + tiempo límite).
 *  PATCH : cerrar o reabrir. Cerrar = estado 'cerrada'. NUNCA se elimina.
 */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const aut = await autorizarInstitucion(req, { roles: ["super_admin", "administrador"], empresaId: body.empresa_id });
  if ("error" in aut) return aut.error;

  const { permitido } = checkRateLimit(req, "mindeval-institucion-proceso");
  if (!permitido) return rateLimitResponse();

  const titulo = String(body.titulo ?? "").trim();
  if (titulo.length < 3) return NextResponse.json({ error: "Escribe el nombre del proceso" }, { status: 400 });

  const tests = (Array.isArray(body.tests) ? body.tests : []).filter((t: string): t is TestPsico => TESTS_VALIDOS.includes(t as TestPsico));
  if (tests.length === 0) return NextResponse.json({ error: "Elige al menos una prueba" }, { status: 400 });

  const tiempo = Number(body.tiempo_limite_min);
  if (!Number.isInteger(tiempo) || tiempo < 5 || tiempo > 600) {
    return NextResponse.json({ error: "El tiempo límite debe estar entre 5 y 600 minutos" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("mindeval_vacantes")
    .insert({
      titulo,
      empresa: aut.empresaNombre,
      empresa_id: aut.empresaId,
      tests_psicometricos: tests,
      tiempo_limite_min: tiempo,
      contacto_nombre: aut.ctx.email,
      contacto_email: aut.ctx.email,
    })
    .select("id")
    .single();
  if (error || !data) {
    const msg = /tiempo_limite_min/.test(error?.message ?? "")
      ? "Falta correr la migración mindeval-institucion-proceso.sql en Supabase."
      : "No se pudo crear el proceso";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = body?.id as string | undefined;
  const estado = body?.estado as string | undefined;
  if (!id || (estado !== "cerrada" && estado !== "abierta")) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const aut = await autorizarInstitucion(req, { roles: ["super_admin", "administrador"], vacanteId: id });
  if ("error" in aut) return aut.error;

  const { error } = await supabaseAdmin.from("mindeval_vacantes").update({ estado }).eq("id", id);
  if (error) return NextResponse.json({ error: "No se pudo actualizar el proceso" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

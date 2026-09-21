import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import type { FuenteEvaluacion } from "@/lib/360-types";

/**
 * Evaluaciones 360 ya generadas, con sus tokens y destinatarios.
 *
 * El panel del dashboard vivia solo en memoria del navegador: mostraba lo que
 * se habia generado en esa pestana y nada mas. Al recargar quedaba vacio
 * aunque los enlaces siguieran vivos en la base, y con el panel vacio no hay
 * boton de enviar -- los tokens existian pero no habia forma de mandarlos.
 * En un lanzamiento de ~130 enlaces generados por tandas, una recarga a mitad
 * de camino dejaba el proceso sin salida.
 */
const FUENTES_ORDEN: FuenteEvaluacion[] = [
  "autoevaluacion",
  "jefe",
  "par",
  "colaborador",
  "cliente_interno",
];

interface FilaToken {
  id: string;
  token: string;
  fuente: FuenteEvaluacion;
  periodo: string;
  evaluado_id: string;
  evaluador_nombre: string | null;
  evaluador_email: string | null;
  enviado_en: string | null;
}

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req, "evaluacion_360");
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "360-evaluaciones");
  if (!permitido) return rateLimitResponse();

  const empresaId = req.nextUrl.searchParams.get("empresa_id")?.trim();

  let consulta = supabaseAdmin
    .from("evaluados_360")
    .select("id, nombre, cargo, departamento, empresa_id, puesto_id, persona_id, jefe, created_at")
    .order("created_at", { ascending: false });

  if (empresaId) consulta = consulta.eq("empresa_id", empresaId);

  const { data: evaluados, error } = await consulta;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!evaluados?.length) return NextResponse.json({ evaluaciones: [] });

  const ids = evaluados.map((e) => e.id);
  const [{ data: tokens }, { data: empresas }] = await Promise.all([
    supabaseAdmin
      .from("tokens_360")
      .select("id, token, fuente, periodo, evaluado_id, evaluador_nombre, evaluador_email, enviado_en")
      .in("evaluado_id", ids),
    supabaseAdmin.from("empresas_mdt").select("id, nombre"),
  ]);

  const nombrePorEmpresa = new Map((empresas ?? []).map((e) => [e.id as string, e.nombre as string]));

  const porEvaluado = new Map<string, FilaToken[]>();
  for (const t of (tokens ?? []) as FilaToken[]) {
    const lista = porEvaluado.get(t.evaluado_id) ?? [];
    lista.push(t);
    porEvaluado.set(t.evaluado_id, lista);
  }

  // Se devuelve el token crudo, no la URL: el origen lo pone el navegador, que
  // es quien sabe si esto corre en produccion o en local.
  const evaluaciones = evaluados.map((evaluado) => {
    const filas = porEvaluado.get(evaluado.id) ?? [];
    filas.sort(
      (a, b) => FUENTES_ORDEN.indexOf(a.fuente) - FUENTES_ORDEN.indexOf(b.fuente),
    );
    return {
      evaluado,
      empresa: evaluado.empresa_id ? nombrePorEmpresa.get(evaluado.empresa_id) : undefined,
      links: filas.map((t) => ({
        tokenId: t.id,
        token: t.token,
        fuente: t.fuente,
        periodo: t.periodo,
        destinatario: t.evaluador_nombre
          ? { nombre: t.evaluador_nombre, email: t.evaluador_email }
          : undefined,
        enviado: !!t.enviado_en,
      })),
    };
  });

  return NextResponse.json({ evaluaciones });
}

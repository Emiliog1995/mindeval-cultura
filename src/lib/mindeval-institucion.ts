import "server-only";
import { NextResponse } from "next/server";
import { getContextoUsuario, type ContextoUsuario } from "@/lib/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type TestPsico = "16pf5" | "kostick" | "disc" | "valanti";
export const TESTS_VALIDOS: TestPsico[] = ["16pf5", "kostick", "disc", "valanti"];
/**
 * ¿Esta cuenta puede ver "Evaluaciones anteriores"? El super_admin siempre.
 * El resto según usuarios_autorizados.ver_historico. Falla cerrado: si la
 * columna no existe todavía o la consulta falla, la respuesta es no.
 */
export async function puedeVerHistorico(ctx: ContextoUsuario): Promise<boolean> {
  if (ctx.rol === "super_admin") return true;
  const { data, error } = await supabaseAdmin
    .from("usuarios_autorizados")
    .select("ver_historico")
    .eq("email", ctx.email)
    .maybeSingle();
  if (error || !data) return false;
  return data.ver_historico === true;
}

export const NOMBRE_TEST: Record<TestPsico, string> = {
  "16pf5": "16PF-5",
  kostick: "KOSTICK",
  disc: "DISC",
  valanti: "VALANTI",
};

/**
 * Identifica a quien llama y comprueba que opera sobre un proceso de una
 * institución propia. Todo lo del flujo USECIPOL pasa por aquí: super_admin
 * puede en cualquier institución; administrador/evaluador solo en la suya.
 * Un cliente tipo 'empresa' nunca entra a este flujo.
 */
export async function autorizarInstitucion(
  req: Request,
  opts: { roles: ("super_admin" | "administrador" | "evaluador")[]; vacanteId?: string; empresaId?: string | null }
): Promise<
  | { error: NextResponse }
  | { ctx: ContextoUsuario; empresaId: string; empresaNombre: string; vacante?: Record<string, unknown> }
> {
  const ctx = await getContextoUsuario(req);
  if (!ctx) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  if (!ctx.rol || !opts.roles.includes(ctx.rol)) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  if (ctx.modulos && !ctx.modulos.includes("seleccion")) {
    return { error: NextResponse.json({ error: "No autorizado para este módulo" }, { status: 403 }) };
  }

  let vacante: Record<string, unknown> | undefined;
  let empresaId = ctx.rol === "super_admin" ? opts.empresaId ?? null : ctx.empresaId;

  if (opts.vacanteId) {
    const { data } = await supabaseAdmin.from("mindeval_vacantes").select("*").eq("id", opts.vacanteId).maybeSingle();
    if (!data) return { error: NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 }) };
    vacante = data;
    if (ctx.rol !== "super_admin" && data.empresa_id !== ctx.empresaId) {
      return { error: NextResponse.json({ error: "No autorizado para este proceso" }, { status: 403 }) };
    }
    empresaId = data.empresa_id as string | null;
  }

  if (!empresaId) return { error: NextResponse.json({ error: "Falta la institución" }, { status: 400 }) };

  const { data: empresa } = await supabaseAdmin.from("empresas_mdt").select("id, nombre, tipo").eq("id", empresaId).maybeSingle();
  if (!empresa || empresa.tipo !== "institucion") {
    return { error: NextResponse.json({ error: "Este flujo es solo para instituciones" }, { status: 403 }) };
  }
  return { ctx, empresaId, empresaNombre: empresa.nombre as string, vacante };
}

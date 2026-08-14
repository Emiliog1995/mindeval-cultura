import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Módulos válidos — deben coincidir uno a uno con los strings usados en
// modulos_permitidos (usuarios_autorizados) y en las policies de RLS
// (ver supabase/permisos-por-modulo-seguridad.sql).
export type Modulo = "seleccion" | "clima" | "evaluacion_360" | "nomina" | "manual_puestos" | "cultura_docs" | "admin";

export async function requireAuth(req: Request, modulo?: Modulo): Promise<NextResponse | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // tener sesión válida no basta — mismo criterio que is_usuario_autorizado()
  // en RLS: solo cuentas de la allowlist pueden usar estas rutas server-side.
  const { data: autorizado } = await supabaseAdmin
    .from("usuarios_autorizados")
    .select("modulos_permitidos")
    .eq("email", data.user.email)
    .eq("activo", true)
    .maybeSingle();
  if (!autorizado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // modulos_permitidos NULL = acceso a todos los módulos (cuentas normales
  // de consultor). Un arreglo restringe la cuenta a esos módulos nada más.
  const modulosPermitidos = autorizado.modulos_permitidos as string[] | null;
  if (modulo && modulosPermitidos && !modulosPermitidos.includes(modulo)) {
    return NextResponse.json({ error: "No autorizado para este módulo" }, { status: 403 });
  }

  return null;
}

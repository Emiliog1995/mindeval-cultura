import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function requireAuth(req: Request): Promise<NextResponse | null> {
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
    .select("email")
    .eq("email", data.user.email)
    .eq("activo", true)
    .maybeSingle();
  if (!autorizado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return null;
}

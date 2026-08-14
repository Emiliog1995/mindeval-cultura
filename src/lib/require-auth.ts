import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Módulos válidos — deben coincidir uno a uno con los strings usados en
// modulos_permitidos (usuarios_autorizados) y en las policies de RLS
// (ver supabase/permisos-por-modulo-seguridad.sql).
export type Modulo = "seleccion" | "clima" | "evaluacion_360" | "nomina" | "manual_puestos" | "cultura_docs" | "admin";

/**
 * Recurso de Selección al que apunta la request — cuando la cuenta que
 * llama tiene empresa_id asignado (cliente externo, no staff), se verifica
 * que la vacante (directa, o vía candidato_id) sea de esa misma empresa.
 * Mismo límite que ya aplica RLS para las lecturas/escrituras directas del
 * navegador (ver supabase/permisos-por-empresa-seleccion.sql) — esto cierra
 * el mismo hueco para las rutas que usan service_role y por lo tanto no
 * pasan por RLS.
 */
interface RecursoSeleccion {
  vacanteId?: string;
  candidatoId?: string;
  candidatoIds?: string[];
}

export async function requireAuth(req: Request, modulo?: Modulo, recurso?: RecursoSeleccion): Promise<NextResponse | null> {
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
    .select("modulos_permitidos, empresa_id")
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

  const empresaId = autorizado.empresa_id as string | null;
  if (empresaId && recurso) {
    const erroEmpresa = NextResponse.json({ error: "No autorizado para este recurso" }, { status: 403 });

    if (recurso.vacanteId) {
      const { data: vacante } = await supabaseAdmin.from("mindeval_vacantes").select("empresa_id").eq("id", recurso.vacanteId).maybeSingle();
      if (!vacante || vacante.empresa_id !== empresaId) return erroEmpresa;
    }

    const candidatoIds = recurso.candidatoId ? [recurso.candidatoId] : recurso.candidatoIds ?? [];
    if (candidatoIds.length > 0) {
      const { data: candidatos } = await supabaseAdmin
        .from("mindeval_candidatos")
        .select("id, mindeval_vacantes(empresa_id)")
        .in("id", candidatoIds);
      const encontrados = (candidatos ?? []) as unknown as { id: string; mindeval_vacantes: { empresa_id: string | null } | null }[];
      const todosDeLaEmpresa =
        encontrados.length === candidatoIds.length && encontrados.every((c) => c.mindeval_vacantes?.empresa_id === empresaId);
      if (!todosDeLaEmpresa) return erroEmpresa;
    }
  }

  return null;
}

import { NextRequest, NextResponse } from "next/server";
import { getContextoUsuario } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Gestión de usuarios con roles (requisito USECIPOL).
 *
 * Quién puede qué:
 *  - super_admin  : ve y crea usuarios de cualquier empresa, cualquier rol.
 *  - administrador: ve y crea usuarios SOLO de su propia empresa, y solo con
 *                   rol 'administrador' o 'evaluador' (nunca super_admin).
 *  - evaluador    : no entra aquí.
 *
 * Crear un usuario hace dos cosas: el usuario de login en Supabase Auth
 * (email + contraseña) y la fila de autorización en usuarios_autorizados
 * (empresa + rol + módulos). Mientras no exista pantalla de "restablecer
 * contraseña", el administrador fija la clave inicial y se la entrega a la
 * persona.
 */

const ROLES_CREABLES = ["administrador", "evaluador"] as const;

function puedeGestionar(rol: string | null): boolean {
  return rol === "super_admin" || rol === "administrador";
}

export async function GET(req: NextRequest) {
  const ctx = await getContextoUsuario(req);
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // ?contexto=1 -> solo "quién soy" (rol + empresa), para que las pantallas
  // decidan qué botones mostrar. Lo puede pedir cualquier rol autorizado.
  if (req.nextUrl.searchParams.get("contexto") === "1") {
    let empresaTipo: string | null = null;
    if (ctx.empresaId) {
      const { data: emp } = await supabaseAdmin.from("empresas_mdt").select("tipo").eq("id", ctx.empresaId).maybeSingle();
      empresaTipo = (emp?.tipo as string | undefined) ?? null;
    }
    return NextResponse.json({ rol: ctx.rol, empresaId: ctx.empresaId, empresaTipo });
  }

  if (!puedeGestionar(ctx.rol)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  let q = supabaseAdmin
    .from("usuarios_autorizados")
    .select("email, nombre, rol, empresa_id, activo, created_at")
    .order("created_at", { ascending: false });

  // El administrador solo ve usuarios de su propia empresa. El super_admin ve todo.
  if (ctx.rol === "administrador") q = q.eq("empresa_id", ctx.empresaId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "No se pudieron cargar los usuarios" }, { status: 500 });

  // El super_admin elige a qué empresa pertenece cada usuario nuevo, así que
  // le mandamos la lista. El administrador no: siempre crea en la suya.
  let empresas: { id: string; nombre: string; tipo: string }[] | undefined;
  if (ctx.rol === "super_admin") {
    const { data: emp } = await supabaseAdmin
      .from("empresas_mdt")
      .select("id, nombre, tipo")
      .order("nombre");
    empresas = emp ?? [];
  }

  return NextResponse.json({ rol: ctx.rol, empresaId: ctx.empresaId, usuarios: data ?? [], empresas });
}

export async function POST(req: NextRequest) {
  const ctx = await getContextoUsuario(req);
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeGestionar(ctx.rol)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { permitido } = checkRateLimit(req, "mindeval-usuarios");
  if (!permitido) return rateLimitResponse();

  let body: { email?: string; nombre?: string; password?: string; rol?: string; empresa_id?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const nombre = body.nombre?.trim() || null;
  const password = body.password ?? "";
  const rol = body.rol;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }
  if (!rol || !ROLES_CREABLES.includes(rol as (typeof ROLES_CREABLES)[number])) {
    return NextResponse.json({ error: "Rol inválido (administrador o evaluador)" }, { status: 400 });
  }

  // A qué empresa pertenece el usuario nuevo.
  // - administrador: siempre su propia empresa (no puede crear fuera de ella).
  // - super_admin: la que indique; si no indica, queda sin empresa (staff).
  const empresaId =
    ctx.rol === "administrador" ? ctx.empresaId : body.empresa_id ?? null;

  if (ctx.rol === "administrador" && !empresaId) {
    return NextResponse.json({ error: "Tu cuenta no tiene empresa asignada" }, { status: 400 });
  }

  // No permitir pisar una cuenta que ya existe.
  const { data: yaExiste } = await supabaseAdmin
    .from("usuarios_autorizados")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  if (yaExiste) {
    return NextResponse.json({ error: "Ya existe un usuario con ese correo" }, { status: 409 });
  }

  // 1. Usuario de login en Supabase Auth.
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !authUser?.user) {
    const msg = authErr?.message?.includes("already")
      ? "Ya existe un login con ese correo"
      : "No se pudo crear el usuario de acceso";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // 2. Fila de autorización: empresa + rol + solo el módulo de selección
  //    (plataforma psicométrica). Si falla, deshago el usuario de auth para no
  //    dejar un login huérfano que nadie puede gestionar.
  const { error: insErr } = await supabaseAdmin.from("usuarios_autorizados").insert({
    email,
    nombre,
    rol,
    empresa_id: empresaId,
    modulos_permitidos: ["seleccion"],
    activo: true,
  });
  if (insErr) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id).catch(() => {});
    return NextResponse.json({ error: "No se pudo registrar la autorización del usuario" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email, rol, empresa_id: empresaId });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getContextoUsuario(req);
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeGestionar(ctx.rol)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  let body: { email?: string; activo?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  if (!email || typeof body.activo !== "boolean") {
    return NextResponse.json({ error: "Faltan datos (email, activo)" }, { status: 400 });
  }
  if (email === ctx.email) {
    return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
  }

  // El administrador solo puede tocar usuarios de su empresa.
  const { data: objetivo } = await supabaseAdmin
    .from("usuarios_autorizados")
    .select("email, empresa_id, rol")
    .eq("email", email)
    .maybeSingle();
  if (!objetivo) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (ctx.rol === "administrador" && objetivo.empresa_id !== ctx.empresaId) {
    return NextResponse.json({ error: "No autorizado sobre este usuario" }, { status: 403 });
  }
  if (objetivo.rol === "super_admin") {
    return NextResponse.json({ error: "No se puede modificar un super administrador" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("usuarios_autorizados")
    .update({ activo: body.activo })
    .eq("email", email);
  if (error) return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });

  return NextResponse.json({ ok: true, email, activo: body.activo });
}

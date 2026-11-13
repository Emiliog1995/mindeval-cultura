import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const BUCKET = "mindeval-grabaciones";

/**
 * Subida de la grabación de proctoring del evaluado (solo instituciones).
 * El bucket es privado y sin policies: el navegador NO sube con permiso
 * propio. Este endpoint valida el token de la prueba y entrega una URL de
 * subida firmada para UNA ruta concreta (proceso/sesión/marca-de-tiempo).
 *
 *  accion "url"       -> URL firmada de subida (la sesión debe estar en_curso).
 *  accion "confirmar" -> comprueba que el archivo quedó en Storage y lo
 *                        registra en grabacion_path.
 *
 * Cada subida va a su propio archivo: si el evaluado recarga a mitad de la
 * prueba, el tramo anterior no se pisa (la revisión lista todos los tramos).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { permitido } = checkRateLimit(req, "mindeval-grabacion");
  if (!permitido) return rateLimitResponse();

  const { token } = await params;
  const body = await req.json().catch(() => null);
  const accion = body?.accion as string | undefined;

  const { data: sesion } = await supabaseAdmin
    .from("mindeval_sesiones_prueba")
    .select("id, vacante_id, estado")
    .eq("token", token)
    .maybeSingle();
  if (!sesion) return NextResponse.json({ error: "Link no válido" }, { status: 404 });
  if (sesion.estado !== "en_curso") {
    return NextResponse.json({ error: "La sesión no está en curso" }, { status: 409 });
  }

  // Solo instituciones graban.
  const { data: vacante } = await supabaseAdmin.from("mindeval_vacantes").select("empresa_id").eq("id", sesion.vacante_id).maybeSingle();
  const { data: empresa } = vacante?.empresa_id
    ? await supabaseAdmin.from("empresas_mdt").select("tipo").eq("id", vacante.empresa_id).maybeSingle()
    : { data: null };
  if (empresa?.tipo !== "institucion") {
    return NextResponse.json({ error: "Esta prueba no lleva grabación" }, { status: 403 });
  }

  const carpeta = `${sesion.vacante_id}/${sesion.id}`;

  if (accion === "url") {
    const path = `${carpeta}/${Date.now()}.webm`;
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: "No se pudo preparar la subida" }, { status: 500 });
    return NextResponse.json({ path: data.path, token: data.token });
  }

  if (accion === "confirmar") {
    const path = String(body?.path ?? "");
    // Solo rutas de ESTA sesión.
    if (!path.startsWith(`${carpeta}/`) || path.includes("..")) {
      return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
    }
    const archivo = path.slice(carpeta.length + 1);
    const { data: lista } = await supabaseAdmin.storage.from(BUCKET).list(carpeta, { search: archivo });
    if (!lista?.some((f) => f.name === archivo)) {
      return NextResponse.json({ error: "El archivo no llegó a Storage" }, { status: 409 });
    }
    await supabaseAdmin.from("mindeval_sesiones_prueba").update({ grabacion_path: path }).eq("id", sesion.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}

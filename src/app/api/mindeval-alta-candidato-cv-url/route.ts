import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";

const EXTENSIONES_PERMITIDAS = [".pdf", ".docx"];

/**
 * Equivalente staff-only de /api/mindeval-postular-cv-url: emite una URL de
 * subida firmada al bucket privado mindeval-cvs para que el navegador suba
 * el CV directo a Storage desde el panel "Añadir candidato manualmente",
 * sin pasar por /api/mindeval-alta-candidato -- ese camino viejo (FormData
 * con el archivo crudo) sigue sujeto al límite de 4.5MB de las funciones
 * serverless de Vercel, el mismo problema que ya se resolvió para la
 * postulación pública pero que nunca se replicó acá.
 */
export async function POST(req: NextRequest) {
  const { permitido } = checkRateLimit(req, "mindeval-alta-candidato-cv-url");
  if (!permitido) return rateLimitResponse();

  try {
    const { vacante_id, nombre_archivo } = await req.json();
    if (!vacante_id || !nombre_archivo) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const authError = await requireAuth(req, "seleccion", { vacanteId: vacante_id });
    if (authError) return authError;

    const extension = "." + String(nombre_archivo).split(".").pop()?.toLowerCase();
    if (!EXTENSIONES_PERMITIDAS.includes(extension)) {
      return NextResponse.json({ error: "Solo se aceptan archivos PDF o Word (.docx)" }, { status: 400 });
    }

    const path = `${randomUUID()}/${nombre_archivo}`;
    const { data, error } = await supabaseAdmin.storage.from("mindeval-cvs").createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ error: "No se pudo preparar la subida del archivo" }, { status: 500 });
    }

    return NextResponse.json({ path: data.path, token: data.token });
  } catch {
    return NextResponse.json({ error: "No se pudo preparar la subida del archivo" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { vacanteAceptaPostulaciones, type Vacante } from "@/lib/mindeval-types";

const EXTENSIONES_PERMITIDAS = [".pdf", ".docx"];

/**
 * Primer paso de la postulación pública cuando el candidato adjunta CV: emite
 * una URL de subida firmada al bucket privado mindeval-cvs para que el
 * navegador suba el archivo DIRECTO a Supabase Storage, sin pasar por
 * /api/mindeval-postular. Necesario porque las funciones serverless de
 * Vercel tienen un límite duro de 4.5MB por request — un CV escaneado con la
 * cámara del celular lo supera fácilmente (5-15MB típico), aunque el mismo
 * CV exportado desde Word pese unos cientos de KB y nunca lo note nadie
 * probando desde una laptop.
 *
 * La URL firmada es de un solo uso y solo se emite si la vacante todavía
 * acepta postulaciones — el criterio de "valida antes de escribir" del resto
 * del ecosistema no se pierde, solo se separa del transporte del archivo.
 * uploadToSignedUrl() no pasa por las policies de RLS de storage.objects (el
 * token firmado es la autorización), así que el bucket sigue tan privado
 * como antes — ver mindeval_cvs_service_role_all en
 * supabase/mindeval-seleccion-etapa2.sql.
 */
export async function POST(req: NextRequest) {
  const { permitido } = checkRateLimit(req, "mindeval-postular-cv-url");
  if (!permitido) return rateLimitResponse();

  try {
    const { vacante_id, nombre_archivo } = await req.json();
    if (!vacante_id || !nombre_archivo) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const extension = "." + String(nombre_archivo).split(".").pop()?.toLowerCase();
    if (!EXTENSIONES_PERMITIDAS.includes(extension)) {
      return NextResponse.json({ error: "Solo se aceptan archivos PDF o Word (.docx)" }, { status: 400 });
    }

    const { data: vacante, error: vErr } = await supabaseAdmin
      .from("mindeval_vacantes")
      .select("*")
      .eq("id", vacante_id)
      .single();
    if (vErr || !vacante || !vacanteAceptaPostulaciones(vacante as Vacante)) {
      return NextResponse.json({ error: "Esta vacante ya no está disponible para postulaciones" }, { status: 404 });
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

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { extraerTextoCv } from "@/lib/mindeval-cv-extract";

/**
 * Alta manual de un candidato desde el ranking de la vacante (staff-only) —
 * mismo patrón que /api/mindeval-postular (extrae texto del PDF/DOCX con
 * extraerTextoCv, sube el archivo original al bucket privado), pero para
 * candidatos que el reclutador agrega directamente (ej. venían de un
 * referido o LinkedIn) en vez de postularse por el link público. No calcula
 * el match con IA automáticamente aquí — el reclutador lo dispara desde
 * "Recalcular candidatos sin match" cuando quiera, igual que cualquier
 * candidato al que le falte el match.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const vacanteId = formData.get("vacante_id") as string;
    const nombreCompleto = (formData.get("nombre_completo") as string)?.trim();
    const cedula = (formData.get("cedula") as string) || null;
    const email = (formData.get("email") as string) || null;
    const file = formData.get("cv_file") as File | null;

    if (!vacanteId || !nombreCompleto) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    const authError = await requireAuth(req, "seleccion", { vacanteId });
    if (authError) return authError;

    const { permitido } = checkRateLimit(req, "mindeval-alta-candidato");
    if (!permitido) return rateLimitResponse();
    if (cedula && !/^\d{10}$/.test(cedula)) {
      return NextResponse.json({ error: "La cédula debe tener 10 dígitos" }, { status: 400 });
    }

    let cvTexto = "";
    let cvBuffer: Buffer | null = null;
    let cvNombreArchivo = "";
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      cvBuffer = Buffer.from(bytes);
      cvNombreArchivo = file.name;
      cvTexto = await extraerTextoCv(cvBuffer, cvNombreArchivo);
    }

    const { data: candidato, error: cErr } = await supabaseAdmin
      .from("mindeval_candidatos")
      .insert({
        vacante_id: vacanteId,
        nombre_completo: nombreCompleto,
        cedula,
        email,
        cv_texto: cvTexto || null,
      })
      .select()
      .single();
    if (cErr || !candidato) throw new Error(cErr?.message ?? "No se pudo guardar el candidato");

    if (cvBuffer) {
      const path = `${candidato.id}/${cvNombreArchivo}`;
      const { error: upErr } = await supabaseAdmin.storage.from("mindeval-cvs").upload(path, cvBuffer, { upsert: true });
      if (!upErr) {
        await supabaseAdmin.from("mindeval_candidatos").update({ cv_url: path }).eq("id", candidato.id);
      }
    }

    return NextResponse.json({ ok: true, candidato_id: candidato.id, cv_extraido: !!cvTexto.trim() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo guardar el candidato";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

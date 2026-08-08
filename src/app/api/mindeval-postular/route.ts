import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { resolverPerfilCargo } from "@/lib/mindeval-perfil";
import { calcularMatchCv } from "@/lib/mindeval-ia";
import type { Vacante } from "@/lib/mindeval-types";

/**
 * Ruta pública (sin login) para el formulario de postulación. Sigue el mismo
 * criterio que /api/token/* del resto del ecosistema: como necesita LEER la
 * vacante antes de escribir (para validar que sigue abierta), no puede pasar
 * por la anon key directo desde el navegador — usa supabaseAdmin server-side.
 *
 * Extrae el texto del CV (PDF o DOCX) y, si lo logra, calcula el match con
 * IA automáticamente y deja al candidato en la etapa "filtro_cv" — así el
 * reclutador ve el % de idoneidad apenas entra al proceso, sin tener que
 * calcularlo manualmente candidato por candidato.
 */
export async function POST(req: NextRequest) {
  const { permitido } = checkRateLimit(req, "mindeval-postular");
  if (!permitido) return rateLimitResponse();

  try {
    const formData = await req.formData();
    const vacanteId = formData.get("vacante_id") as string;
    const nombreCompleto = (formData.get("nombre_completo") as string)?.trim();
    const email = (formData.get("email") as string) || null;
    const telefono = (formData.get("telefono") as string) || null;
    const ciudad = (formData.get("ciudad") as string) || null;
    const aniosRaw = formData.get("anios_experiencia") as string;
    const educacion = (formData.get("educacion") as string) || null;
    const file = formData.get("cv_file") as File | null;

    if (!vacanteId || !nombreCompleto) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    const { data: vacante, error: vErr } = await supabaseAdmin
      .from("mindeval_vacantes")
      .select("*")
      .eq("id", vacanteId)
      .single();
    if (vErr || !vacante || (vacante as Vacante).estado !== "abierta") {
      return NextResponse.json({ error: "Esta vacante ya no está disponible para postulaciones" }, { status: 404 });
    }

    // 1. Extraer texto del CV (best-effort — un CV en formato no soportado
    // no debe bloquear la postulación, solo se guarda sin cv_texto)
    let cvTexto = "";
    let cvBuffer: Buffer | null = null;
    let cvNombreArchivo = "";
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      cvBuffer = Buffer.from(bytes);
      cvNombreArchivo = file.name;
      try {
        if (file.name.toLowerCase().endsWith(".docx")) {
          const result = await mammoth.extractRawText({ buffer: cvBuffer });
          cvTexto = result.value;
        } else if (file.name.toLowerCase().endsWith(".pdf")) {
          const parser = new PDFParse({ data: new Uint8Array(cvBuffer) });
          const result = await parser.getText();
          cvTexto = result.text;
        }
      } catch {
        // Fallback amigable: si falla la extracción, la postulación sigue
        // guardándose; el reclutador puede pegar el texto manualmente después.
        cvTexto = "";
      }
    }

    // 2. Insertar candidato
    const { data: candidato, error: cErr } = await supabaseAdmin
      .from("mindeval_candidatos")
      .insert({
        vacante_id: vacanteId,
        nombre_completo: nombreCompleto,
        email,
        telefono,
        ciudad,
        anios_experiencia: aniosRaw ? Number(aniosRaw) : null,
        educacion,
        cv_texto: cvTexto || null,
      })
      .select()
      .single();
    if (cErr || !candidato) throw new Error(cErr?.message ?? "No se pudo guardar la postulación");

    // 3. Subir el archivo original al bucket privado (best-effort, no bloquea)
    if (cvBuffer) {
      const path = `${candidato.id}/${cvNombreArchivo}`;
      const { error: upErr } = await supabaseAdmin.storage.from("mindeval-cvs").upload(path, cvBuffer, { upsert: true });
      if (!upErr) {
        await supabaseAdmin.from("mindeval_candidatos").update({ cv_url: path }).eq("id", candidato.id);
      }
    }

    // 4. Match automático con IA (best-effort — si falla, el candidato queda
    // guardado igual y el reclutador puede calcularlo manualmente después)
    let matchPct: number | null = null;
    if (cvTexto.trim()) {
      try {
        const perfil = await resolverPerfilCargo(supabaseAdmin, vacante as Vacante);
        const resultado = await calcularMatchCv(cvTexto, perfil);
        matchPct = resultado.match_pct;
        await supabaseAdmin.from("mindeval_cv_matches").insert({
          candidato_id: candidato.id,
          match_pct: resultado.match_pct,
          razones: resultado.razones,
        });
        await supabaseAdmin.from("mindeval_candidatos").update({ etapa_actual: "filtro_cv" }).eq("id", candidato.id);
      } catch {
        // El match con IA es un plus, no un requisito para postular.
      }
    }

    return NextResponse.json({ ok: true, candidato_id: candidato.id, match_pct: matchPct });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo enviar la postulación";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { resolverPerfilCargo } from "@/lib/mindeval-perfil";
import { calcularMatchCv } from "@/lib/mindeval-ia";
import { evaluarDescarteCv } from "@/lib/mindeval-scoring";
import { extraerTextoCv } from "@/lib/mindeval-cv-extract";
import { vacanteAceptaPostulaciones, type Vacante } from "@/lib/mindeval-types";

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
    const cedula = (formData.get("cedula") as string) || null;
    const email = (formData.get("email") as string) || null;
    const telefono = (formData.get("telefono") as string) || null;
    const ciudad = (formData.get("ciudad") as string) || null;
    const aniosRaw = formData.get("anios_experiencia") as string;
    const educacion = (formData.get("educacion") as string) || null;
    const file = formData.get("cv_file") as File | null;
    const consentimientoLopdp = formData.get("consentimiento_lopdp") === "true";

    if (!vacanteId || !nombreCompleto) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }
    if (!cedula || !/^\d{10}$/.test(cedula)) {
      return NextResponse.json({ error: "La cédula debe tener 10 dígitos" }, { status: 400 });
    }
    if (!consentimientoLopdp) {
      return NextResponse.json({ error: "Debes aceptar el Aviso de Privacidad para postular" }, { status: 400 });
    }

    const { data: vacante, error: vErr } = await supabaseAdmin
      .from("mindeval_vacantes")
      .select("*")
      .eq("id", vacanteId)
      .single();
    if (vErr || !vacante || !vacanteAceptaPostulaciones(vacante as Vacante)) {
      return NextResponse.json({ error: "Esta vacante ya no está disponible para postulaciones" }, { status: 404 });
    }

    // 1. Extraer texto del CV (best-effort — un CV en formato no soportado
    // o que falle al extraerse no debe bloquear la postulación, solo se
    // guarda sin cv_texto; el reclutador puede reintentar la extracción
    // desde el ranking con "Recalcular candidatos sin match")
    let cvTexto = "";
    let cvBuffer: Buffer | null = null;
    let cvNombreArchivo = "";
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      cvBuffer = Buffer.from(bytes);
      cvNombreArchivo = file.name;
      cvTexto = await extraerTextoCv(cvBuffer, cvNombreArchivo);
    }

    // 2. Insertar candidato
    const { data: candidato, error: cErr } = await supabaseAdmin
      .from("mindeval_candidatos")
      .insert({
        vacante_id: vacanteId,
        nombre_completo: nombreCompleto,
        cedula,
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

        const { descartar, motivo } = evaluarDescarteCv(resultado, (vacante as Vacante).corte_match_cv);
        await supabaseAdmin
          .from("mindeval_candidatos")
          .update(
            descartar
              ? { etapa_actual: "descartado", estado: "descartado", motivo_descarte: motivo }
              : { etapa_actual: "filtro_cv" }
          )
          .eq("id", candidato.id);
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

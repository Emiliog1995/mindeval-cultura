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
 * El CV ya NO viaja en este request: el navegador lo sube antes, directo a
 * Storage, con la URL firmada de /api/mindeval-postular-cv-url (evita el
 * límite de 4.5MB de las funciones serverless de Vercel, que un CV
 * escaneado desde el celular supera fácil). Acá solo llega `cv_path`, y esta
 * ruta descarga el archivo del bucket server-side — esa descarga no está
 * sujeta al límite de tamaño del request entrante.
 *
 * Extrae el texto del CV (PDF o DOCX) y, si lo logra, calcula el match con
 * IA automáticamente y deja al candidato en la etapa "filtro_cv" — así el
 * reclutador ve el % de idoneidad apenas entra al proceso, sin tener que
 * calcularlo manualmente candidato por candidato.
 */
// Descargar el CV + extraer texto + llamar a Claude para el match, todo en
// una sola invocación, puede superar el límite por defecto de las funciones
// serverless de Vercel (10-15s) con un CV pesado o un cold start -- eso
// mata la función a mitad de camino y el navegador recibe la página de
// error de Vercel en vez de JSON ("Unexpected token '<'"). Este techo más
// alto le da margen a la cadena completa para terminar normalmente.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { permitido } = checkRateLimit(req, "mindeval-postular");
  if (!permitido) return rateLimitResponse();

  try {
    const body = await req.json();
    const vacanteId = body.vacante_id as string;
    const nombreCompleto = (body.nombre_completo as string)?.trim();
    const cedula = (body.cedula as string) || null;
    const email = (body.email as string) || null;
    const telefono = (body.telefono as string) || null;
    const ciudad = (body.ciudad as string) || null;
    const aniosRaw = body.anios_experiencia;
    const educacion = (body.educacion as string) || null;
    const cvPath = (body.cv_path as string) || null;
    const consentimientoLopdp = body.consentimiento_lopdp === true;

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

    // 1. Descargar el CV ya subido a Storage y extraer su texto (best-effort
    // — un CV en formato no soportado, corrupto, o que falle al extraerse
    // no debe bloquear la postulación, solo se guarda sin cv_texto; el
    // reclutador puede reintentar la extracción desde el ranking con
    // "Recalcular candidatos sin match")
    let cvTexto = "";
    if (cvPath) {
      const { data: archivo } = await supabaseAdmin.storage.from("mindeval-cvs").download(cvPath);
      if (archivo) {
        const buffer = Buffer.from(await archivo.arrayBuffer());
        cvTexto = await extraerTextoCv(buffer, cvPath);
      }
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
        cv_url: cvPath,
      })
      .select()
      .single();
    if (cErr || !candidato) throw new Error(cErr?.message ?? "No se pudo guardar la postulación");

    // 3. Match automático con IA (best-effort — si falla, el candidato queda
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

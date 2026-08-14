import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { extraerTextoCv } from "@/lib/mindeval-cv-extract";
import { resolverPerfilCargo } from "@/lib/mindeval-perfil";
import { calcularMatchCv } from "@/lib/mindeval-ia";
import { evaluarDescarteCv } from "@/lib/mindeval-scoring";
import type { Vacante } from "@/lib/mindeval-types";

/**
 * Reintenta la extracción de texto para un candidato cuyo CV se subió bien
 * (cv_url existe) pero cv_texto quedó vacío la primera vez — ej. el
 * servidor se reinició justo durante la postulación, o el parser falló
 * transitoriamente. Vuelve a descargar el archivo del bucket privado,
 * re-extrae el texto y, si lo logra, calcula el match y aplica el mismo
 * descarte automático que la postulación pública.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req, "seleccion");
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "mindeval-reextraer-cv");
  if (!permitido) return rateLimitResponse();

  try {
    const { candidato_id }: { candidato_id: string } = await req.json();
    if (!candidato_id) return NextResponse.json({ error: "Falta candidato_id" }, { status: 400 });

    const { data: candidato, error: cErr } = await supabaseAdmin
      .from("mindeval_candidatos")
      .select("id, vacante_id, cv_url")
      .eq("id", candidato_id)
      .single();
    if (cErr || !candidato) return NextResponse.json({ error: "No se encontró el candidato" }, { status: 404 });
    if (!candidato.cv_url) return NextResponse.json({ error: "Este candidato no tiene un archivo de CV subido" }, { status: 400 });

    const { data: archivo, error: dlErr } = await supabaseAdmin.storage.from("mindeval-cvs").download(candidato.cv_url);
    if (dlErr || !archivo) return NextResponse.json({ error: "No se pudo descargar el archivo del CV" }, { status: 500 });

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const nombreArchivo = candidato.cv_url.split("/").pop() ?? "";
    const cvTexto = await extraerTextoCv(buffer, nombreArchivo);

    if (!cvTexto.trim()) {
      return NextResponse.json({ error: "El archivo sigue sin poder extraerse (¿es un PDF escaneado sin texto?). Pega el CV manualmente en el perfil del candidato." }, { status: 422 });
    }

    await supabaseAdmin.from("mindeval_candidatos").update({ cv_texto: cvTexto }).eq("id", candidato_id);

    const { data: vacante } = await supabaseAdmin.from("mindeval_vacantes").select("*").eq("id", candidato.vacante_id).single();
    const perfil = await resolverPerfilCargo(supabaseAdmin, vacante as Vacante);
    const resultado = await calcularMatchCv(cvTexto, perfil);

    await supabaseAdmin.from("mindeval_cv_matches").insert({ candidato_id, match_pct: resultado.match_pct, razones: resultado.razones });

    const { descartar, motivo } = evaluarDescarteCv(resultado, (vacante as Vacante).corte_match_cv);
    await supabaseAdmin
      .from("mindeval_candidatos")
      .update(
        descartar
          ? { etapa_actual: "descartado", estado: "descartado", motivo_descarte: motivo }
          : { etapa_actual: "filtro_cv" }
      )
      .eq("id", candidato_id);

    return NextResponse.json({ ok: true, match_pct: resultado.match_pct, descartado: descartar, motivo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al reintentar la extracción del CV";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

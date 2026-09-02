import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { extraerTextoCv } from "@/lib/mindeval-cv-extract";

/**
 * Alta manual de un candidato desde el ranking de la vacante (staff-only) —
 * mismo patrón que /api/mindeval-postular (extrae texto del PDF/DOCX con
 * extraerTextoCv), pero para candidatos que el reclutador agrega
 * directamente (ej. venían de un referido o LinkedIn) en vez de postularse
 * por el link público. No calcula el match con IA automáticamente aquí — el
 * reclutador lo dispara desde "Recalcular candidatos sin match" cuando
 * quiera, igual que cualquier candidato al que le falte el match.
 *
 * El CV ya NO viaja en este request: el navegador lo sube antes, directo a
 * Storage, con la URL firmada de /api/mindeval-alta-candidato-cv-url (mismo
 * criterio que /api/mindeval-postular — evita el límite de 4.5MB de las
 * funciones serverless de Vercel). Acá solo llega `cv_path`, y esta ruta
 * descarga el archivo del bucket server-side.
 */
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const {
      vacante_id: vacanteId,
      nombre_completo: nombreCompletoRaw,
      cedula: cedulaRaw,
      email: emailRaw,
      cv_path: cvPath,
    }: { vacante_id: string; nombre_completo: string; cedula?: string; email?: string; cv_path?: string } = await req.json();
    const nombreCompleto = nombreCompletoRaw?.trim();
    const cedula = cedulaRaw || null;
    const email = emailRaw || null;

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
    // Opcional en el alta manual (a diferencia de la postulación pública),
    // pero si viene debe ser un correo real -- auditoría 2026-09, C-8.
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Escribe un correo válido" }, { status: 400 });
    }

    // A diferencia de la postulación pública (que actualiza al candidato que
    // ya existía), acá se bloquea y se avisa: el reclutador tiene la ficha a
    // un clic y debe decidir él si es la misma persona o un homónimo con la
    // cédula mal tipeada. Crear el duplicado en silencio le ensuciaba el
    // ranking sin que se enterara (auditoría 2026-09, F2-4).
    if (cedula) {
      const { data: previos } = await supabaseAdmin
        .from("mindeval_candidatos")
        .select("id, nombre_completo")
        .eq("vacante_id", vacanteId)
        .eq("cedula", cedula)
        .limit(1);
      const previo = previos?.[0];
      if (previo) {
        return NextResponse.json(
          {
            error: `Ya hay un candidato con la cédula ${cedula} en esta vacante: ${previo.nombre_completo}. Abre su ficha para actualizar sus datos en vez de crear uno nuevo.`,
            candidato_existente_id: previo.id,
          },
          { status: 409 }
        );
      }
    }

    let cvTexto = "";
    if (cvPath) {
      const { data: archivo } = await supabaseAdmin.storage.from("mindeval-cvs").download(cvPath);
      if (archivo) {
        const buffer = Buffer.from(await archivo.arrayBuffer());
        cvTexto = await extraerTextoCv(buffer, cvPath);
      }
    }

    const { data: candidato, error: cErr } = await supabaseAdmin
      .from("mindeval_candidatos")
      .insert({
        vacante_id: vacanteId,
        nombre_completo: nombreCompleto,
        cedula,
        email,
        cv_texto: cvTexto || null,
        cv_url: cvPath || null,
      })
      .select()
      .single();
    if (cErr || !candidato) throw new Error(cErr?.message ?? "No se pudo guardar el candidato");

    return NextResponse.json({ ok: true, candidato_id: candidato.id, cv_extraido: !!cvTexto.trim() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo guardar el candidato";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

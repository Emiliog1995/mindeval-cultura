import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { autorizarInstitucion } from "@/lib/mindeval-institucion";

const BUCKET = "mindeval-grabaciones";

/**
 * Revisión de la grabación de una sesión (USECIPOL). Devuelve URLs firmadas
 * de lectura, de corta vida, uno por tramo. Solo quien pertenece a la misma
 * institución del proceso (o el super_admin) puede pedirlas.
 */
export async function GET(req: NextRequest) {
  const sesionId = req.nextUrl.searchParams.get("sesion_id");
  if (!sesionId) return NextResponse.json({ error: "Falta la sesión" }, { status: 400 });

  const { data: sesion } = await supabaseAdmin.from("mindeval_sesiones_prueba").select("id, vacante_id").eq("id", sesionId).maybeSingle();
  if (!sesion) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });

  const aut = await autorizarInstitucion(req, { roles: ["super_admin", "administrador", "evaluador"], vacanteId: sesion.vacante_id });
  if ("error" in aut) return aut.error;

  const { permitido } = checkRateLimit(req, "mindeval-institucion-grabacion");
  if (!permitido) return rateLimitResponse();

  const carpeta = `${sesion.vacante_id}/${sesion.id}`;
  const { data: lista } = await supabaseAdmin.storage.from(BUCKET).list(carpeta, { sortBy: { column: "name", order: "asc" } });
  const archivos = (lista ?? []).filter((f) => f.name.endsWith(".webm") || f.name.endsWith(".mp4"));

  const segmentos: { nombre: string; url: string }[] = [];
  for (const f of archivos) {
    const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(`${carpeta}/${f.name}`, 600);
    if (data?.signedUrl) segmentos.push({ nombre: f.name, url: data.signedUrl });
  }
  return NextResponse.json({ segmentos });
}

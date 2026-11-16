import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { autorizarInstitucion } from "@/lib/mindeval-institucion";

/**
 * Copia los evaluados (nombre, cédula, correo, perfil) de un proceso anterior
 * de la MISMA institución a otro proceso, para no volver a cargarlos a mano.
 * No copia invitaciones ni resultados. Omite cédulas que ya estén en destino.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const origenId = body?.origen_id as string | undefined;
  const destinoId = body?.destino_id as string | undefined;
  if (!origenId || !destinoId || origenId === destinoId) {
    return NextResponse.json({ error: "Elige un proceso de origen distinto" }, { status: 400 });
  }

  const destino = await autorizarInstitucion(req, { roles: ["super_admin", "administrador"], vacanteId: destinoId });
  if ("error" in destino) return destino.error;
  const origen = await autorizarInstitucion(req, { roles: ["super_admin", "administrador"], vacanteId: origenId });
  if ("error" in origen) return origen.error;
  if (origen.empresaId !== destino.empresaId) {
    return NextResponse.json({ error: "Solo se puede copiar entre procesos de la misma institución" }, { status: 403 });
  }
  if ((destino.vacante as { estado?: string } | undefined)?.estado === "cerrada") {
    return NextResponse.json({ error: "El proceso de destino está cerrado" }, { status: 409 });
  }

  const { permitido } = checkRateLimit(req, "mindeval-institucion-copiar");
  if (!permitido) return rateLimitResponse();

  const [{ data: deOrigen }, { data: enDestino }] = await Promise.all([
    supabaseAdmin.from("mindeval_candidatos").select("nombre_completo, cedula, email, perfil_evaluado").eq("vacante_id", origenId),
    supabaseAdmin.from("mindeval_candidatos").select("cedula").eq("vacante_id", destinoId),
  ]);
  const yaEstan = new Set((enDestino ?? []).map((c) => c.cedula).filter(Boolean));
  const nuevos = (deOrigen ?? [])
    .filter((c) => !c.cedula || !yaEstan.has(c.cedula))
    .map((c) => ({
      vacante_id: destinoId,
      nombre_completo: c.nombre_completo,
      cedula: c.cedula,
      email: c.email,
      perfil_evaluado: c.perfil_evaluado,
    }));

  if (nuevos.length) {
    const { error } = await supabaseAdmin.from("mindeval_candidatos").insert(nuevos);
    if (error) return NextResponse.json({ error: "No se pudieron copiar los evaluados" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, copiados: nuevos.length, omitidos: (deOrigen ?? []).length - nuevos.length });
}

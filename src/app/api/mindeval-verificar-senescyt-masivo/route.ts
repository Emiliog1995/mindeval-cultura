import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { consultarSenescyt } from "@/lib/mindeval-senescyt";

/**
 * Consulta SENESCYT en lote para varios candidatos a la vez, disparada desde
 * el ranking de la vacante (selecciona los mejor rankeados, un solo click).
 * A diferencia del flujo individual, esta SÍ persiste el resultado — pero
 * siempre con estado='pendiente': el resultado del proveedor externo
 * (webservices.ec) queda en resultado_automatico como una cola de "pendiente
 * de revisar", nunca se guarda como Registrado/Sin registro final sin que el
 * reclutador lo confirme explícitamente (ver panel de revisión en el
 * ranking). Cada consulta exitosa tiene costo real ($0.10) — el cliente debe
 * confirmar el costo total antes de llamar a esta ruta.
 */
export async function POST(req: NextRequest) {
  try {
    const { candidato_ids }: { candidato_ids: string[] } = await req.json();
    if (!candidato_ids?.length) {
      return NextResponse.json({ error: "Selecciona al menos un candidato" }, { status: 400 });
    }

    const authError = await requireAuth(req, "seleccion", { candidatoIds: candidato_ids });
    if (authError) return authError;

    const { permitido } = checkRateLimit(req, "mindeval-verificar-senescyt-masivo");
    if (!permitido) return rateLimitResponse();

    const { data: candidatos } = await supabaseAdmin
      .from("mindeval_candidatos")
      .select("id, nombre_completo, cedula")
      .in("id", candidato_ids);

    const resultados: { candidato_id: string; nombre: string; ok: boolean; motivo?: string; estado?: "registrado" | "sin_registro" }[] = [];

    for (const candidatoId of candidato_ids) {
      const candidato = candidatos?.find((c) => c.id === candidatoId);
      if (!candidato) {
        resultados.push({ candidato_id: candidatoId, nombre: "—", ok: false, motivo: "Candidato no encontrado" });
        continue;
      }
      if (!candidato.cedula) {
        resultados.push({ candidato_id: candidatoId, nombre: candidato.nombre_completo, ok: false, motivo: "Sin cédula registrada" });
        continue;
      }

      const resultado = await consultarSenescyt(candidato.cedula);
      if (!resultado.ok) {
        resultados.push({ candidato_id: candidatoId, nombre: candidato.nombre_completo, ok: false, motivo: resultado.error });
        continue;
      }

      const primero = resultado.titulos[0];
      const anioRegistro = primero ? Number((primero.fecha_registro ?? "").slice(0, 4)) || null : null;

      await supabaseAdmin.from("mindeval_verificaciones_titulo").insert({
        candidato_id: candidatoId,
        titulo_declarado: primero?.titulo ?? null,
        institucion: primero?.institucion ?? null,
        anio: anioRegistro,
        estado: "pendiente",
        resultado_automatico: resultado.estado,
        consultado_automaticamente_en: new Date().toISOString(),
      });

      resultados.push({ candidato_id: candidatoId, nombre: candidato.nombre_completo, ok: true, estado: resultado.estado });
    }

    return NextResponse.json({ resultados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al verificar en lote";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

const SEVERIDADES_VALIDAS = ["bajo", "medio", "alto", "critico"];
const TIPOS_SESION_VALIDOS = ["psicometricas", "tecnica", "assessment"];

/**
 * Registra una alerta anti-fraude. Antes esto era un insert directo del
 * navegador con la anon key (RLS permitía "anon insert, sin restricción" en
 * mindeval_alertas_fraude) — cualquiera, con o sin sesión, podía insertar
 * una alerta con cualquier candidato_id inventado o ajeno, sin rate limit.
 * Se movió a esta ruta (mismo criterio que el resto de flujos públicos del
 * proyecto: "lo que necesita validar algo antes de escribir pasa por un
 * Route Handler con service_role", ver mindeval-postular).
 *
 * Dos orígenes válidos:
 *  1) El candidato durante su examen (AntiFraudeMonitor sin login, en
 *     /seleccion/prueba/[token]) — manda `token`, se valida que corresponda
 *     a una sesión activa (no completada/expirada) de ESE candidato.
 *  2) Un reclutador autenticado monitoreando manualmente desde la ficha del
 *     candidato (AntiFraudeMonitor con `Authorization`, sin token de
 *     examen) — se valida con requireAuth + que el candidato sea de su
 *     empresa si la cuenta está restringida.
 */
export async function POST(req: NextRequest) {
  const { permitido } = checkRateLimit(req, "mindeval-alerta-fraude");
  if (!permitido) return rateLimitResponse();

  try {
    const { token, candidato_id, sesion_tipo, tipo_alerta, severidad, detalle }: {
      token?: string;
      candidato_id: string;
      sesion_tipo: string;
      tipo_alerta: string;
      severidad: string;
      detalle?: string;
    } = await req.json();

    if (!candidato_id || !tipo_alerta) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }
    if (!SEVERIDADES_VALIDAS.includes(severidad)) {
      return NextResponse.json({ error: "Severidad inválida" }, { status: 400 });
    }
    if (!TIPOS_SESION_VALIDOS.includes(sesion_tipo)) {
      return NextResponse.json({ error: "Tipo de sesión inválido" }, { status: 400 });
    }

    if (req.headers.get("authorization")) {
      const authError = await requireAuth(req, "seleccion", { candidatoId: candidato_id });
      if (authError) return authError;
    } else {
      if (!token) return NextResponse.json({ error: "Falta token" }, { status: 400 });

      // El token debe corresponder a UNA sesión activa (no completada/
      // expirada) de ESE candidato — así una alerta anónima nunca puede
      // registrarse contra un candidato ajeno ni contra un examen ya
      // terminado.
      const { data: sesion } = await supabaseAdmin
        .from("mindeval_sesiones_prueba")
        .select("candidato_id, estado")
        .eq("token", token)
        .maybeSingle();

      if (!sesion || sesion.candidato_id !== candidato_id || !["programada", "en_curso"].includes(sesion.estado)) {
        return NextResponse.json({ error: "Sesión de examen no válida o ya finalizada" }, { status: 403 });
      }
    }

    await supabaseAdmin.from("mindeval_alertas_fraude").insert({
      candidato_id,
      sesion_tipo,
      tipo_alerta: String(tipo_alerta).slice(0, 200),
      severidad,
      detalle: detalle ? String(detalle).slice(0, 500) : null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar la alerta" }, { status: 500 });
  }
}

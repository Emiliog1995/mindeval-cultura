import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { enviarInvitacion360 } from "@/lib/email-360";
import type { FuenteEvaluacion } from "@/lib/360-types";

// Envia correos uno por uno con pausa: puede superar el limite por defecto de
// las funciones serverless de Vercel (10-15s) -- mismo motivo que maxDuration
// en /api/mindeval-postular.
export const maxDuration = 60;

/** Pausa entre envios para no chocar con el limite de peticiones de Resend. */
const PAUSA_MS = 600;

/**
 * Tope por llamada. Con la pausa, 20 correos son ~12s y entran holgados en los
 * 60s de la funcion; el cliente hace varias llamadas y muestra el progreso.
 * Mandar los 131 de una sola vez cortaria la funcion a mitad de camino y
 * quedaria sin saberse cuales salieron.
 */
const MAX_POR_LLAMADA = 20;

interface TokenFila {
  id: string;
  token: string;
  fuente: FuenteEvaluacion;
  periodo: string;
  completado: boolean;
  enviado_en: string | null;
  evaluador_nombre: string | null;
  evaluador_email: string | null;
  evaluados_360: { nombre: string; empresa_id: string | null } | null;
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req, "evaluacion_360");
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "360-enviar-invitaciones");
  if (!permitido) return rateLimitResponse();

  try {
    const { token_ids: tokenIds, origen, reenviar }: {
      token_ids?: string[];
      origen?: string;
      reenviar?: boolean;
    } = await req.json();

    if (!Array.isArray(tokenIds) || tokenIds.length === 0) {
      return NextResponse.json({ error: "No se indicó ningún enlace para enviar" }, { status: 400 });
    }
    if (tokenIds.length > MAX_POR_LLAMADA) {
      return NextResponse.json(
        { error: `Máximo ${MAX_POR_LLAMADA} correos por llamada.` },
        { status: 400 },
      );
    }
    if (!origen || !/^https?:\/\//.test(origen)) {
      return NextResponse.json({ error: "Falta el origen para armar el enlace" }, { status: 400 });
    }

    // Los datos del envio se releen de la base: el navegador dice QUE enviar,
    // nunca a que correo ni con que enlace.
    const { data, error } = await supabaseAdmin
      .from("tokens_360")
      .select("id, token, fuente, periodo, completado, enviado_en, evaluador_nombre, evaluador_email, evaluados_360(nombre, empresa_id)")
      .in("id", tokenIds);
    if (error) throw new Error(error.message);

    const filas = (data ?? []) as unknown as TokenFila[];

    // El nombre de la organización encabeza el correo, y evaluados_360 solo
    // guarda su id. Se resuelve una vez para todo el lote.
    const empresaIds = [...new Set(filas.map((f) => f.evaluados_360?.empresa_id).filter(Boolean))] as string[];
    const nombrePorEmpresa = new Map<string, string>();
    if (empresaIds.length > 0) {
      const { data: empresas } = await supabaseAdmin.from("empresas_mdt").select("id, nombre").in("id", empresaIds);
      for (const e of empresas ?? []) nombrePorEmpresa.set(e.id, e.nombre);
    }

    const resultados: Array<{ id: string; ok: boolean; email?: string; motivo?: string }> = [];

    for (const fila of filas) {
      if (!fila.evaluador_email) {
        resultados.push({ id: fila.id, ok: false, motivo: "El enlace no tiene un destinatario asignado." });
        continue;
      }
      if (fila.completado) {
        resultados.push({ id: fila.id, ok: false, email: fila.evaluador_email, motivo: "Ya fue respondido." });
        continue;
      }
      // Reenviar es explicito: si no, un segundo clic duplica correos ya enviados.
      if (fila.enviado_en && !reenviar) {
        resultados.push({ id: fila.id, ok: false, email: fila.evaluador_email, motivo: "Ya se envió antes." });
        continue;
      }

      const envio = await enviarInvitacion360({
        to: fila.evaluador_email,
        nombreEvaluador: fila.evaluador_nombre ?? fila.evaluador_email,
        nombreEvaluado: fila.evaluados_360?.nombre ?? "un integrante del equipo",
        fuente: fila.fuente,
        empresa: nombrePorEmpresa.get(fila.evaluados_360?.empresa_id ?? "") ?? "la organización",
        periodo: fila.periodo,
        link: `${origen.replace(/\/$/, "")}/evaluar-360/${fila.token}`,
      });

      if (envio.ok) {
        // Se marca DESPUES de que Resend confirma. Marcarlo antes haria creer
        // que salio un correo que quizas nunca salio.
        await supabaseAdmin.from("tokens_360").update({ enviado_en: new Date().toISOString() }).eq("id", fila.id);
        resultados.push({ id: fila.id, ok: true, email: fila.evaluador_email });
      } else {
        resultados.push({ id: fila.id, ok: false, email: fila.evaluador_email, motivo: envio.error });
      }

      await new Promise((r) => setTimeout(r, PAUSA_MS));
    }

    const enviados = resultados.filter((r) => r.ok).length;
    return NextResponse.json({ enviados, fallidos: resultados.filter((r) => !r.ok), resultados });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al enviar las invitaciones" },
      { status: 500 },
    );
  }
}

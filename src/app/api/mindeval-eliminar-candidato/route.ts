import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Elimina un candidato del proceso — pensado sobre todo para resolver
 * duplicados (la misma persona postulada dos veces antes de que existiera el
 * control por cédula). Hasta ahora no había ninguna forma de hacerlo desde la
 * interfaz y había que entrar a la base a mano.
 *
 * Es destructivo y en cascada: borrar la fila del candidato se lleva sus
 * matches de CV, sesiones de prueba, psicométricas, técnicas, evaluaciones de
 * assessment, entrevistas, verificaciones SENESCYT, alertas de fraude e
 * informes IA. Por eso:
 *
 *  1) GET devuelve el inventario de lo que se perdería, SIN borrar nada — la
 *     interfaz lo muestra en la confirmación para que el reclutador decida
 *     con el dato a la vista y no con un "¿seguro?" a ciegas.
 *  2) DELETE se niega si el candidato tiene evaluaciones rendidas, salvo que
 *     se mande `forzar: true`. Un duplicado real no tiene nada colgado; si lo
 *     tiene, es probable que se esté por borrar la fila equivocada.
 *  3) Se borra también el archivo del CV en Storage — la cascada de Postgres
 *     no alcanza al bucket y el archivo quedaría huérfano.
 *
 * Descartar y eliminar son cosas distintas y deben seguir siéndolo: para
 * sacar a alguien del proceso conservando su evaluación está el descarte
 * (etapa 'descartado'). Esto es para filas que no deberían existir.
 */

const TABLAS_DEPENDIENTES: { tabla: string; etiqueta: string; evaluacion: boolean }[] = [
  { tabla: "mindeval_cv_matches", etiqueta: "match de CV", evaluacion: false },
  { tabla: "mindeval_sesiones_prueba", etiqueta: "sesión de prueba agendada", evaluacion: false },
  { tabla: "mindeval_alertas_fraude", etiqueta: "alerta de monitoreo", evaluacion: false },
  { tabla: "mindeval_pruebas_psicometricas", etiqueta: "resultado psicométrico", evaluacion: true },
  { tabla: "mindeval_pruebas_tecnicas", etiqueta: "prueba técnica", evaluacion: true },
  { tabla: "mindeval_assessment_evaluaciones", etiqueta: "evaluación de assessment", evaluacion: true },
  { tabla: "mindeval_entrevistas", etiqueta: "entrevista", evaluacion: true },
  { tabla: "mindeval_verificaciones_titulo", etiqueta: "verificación SENESCYT", evaluacion: true },
  { tabla: "mindeval_informes_ia", etiqueta: "informe generado", evaluacion: true },
];

async function inventario(candidatoId: string) {
  const conteos = await Promise.all(
    TABLAS_DEPENDIENTES.map(async (t) => {
      const { count } = await supabaseAdmin
        .from(t.tabla)
        .select("id", { count: "exact", head: true })
        .eq("candidato_id", candidatoId);
      return { ...t, cantidad: count ?? 0 };
    })
  );
  const conDatos = conteos.filter((c) => c.cantidad > 0);
  return {
    detalle: conDatos.map((c) => ({ etiqueta: c.etiqueta, cantidad: c.cantidad })),
    tieneEvaluaciones: conDatos.some((c) => c.evaluacion),
  };
}

export async function GET(req: NextRequest) {
  const candidatoId = req.nextUrl.searchParams.get("candidato_id");
  if (!candidatoId) return NextResponse.json({ error: "Falta el candidato" }, { status: 400 });

  const authError = await requireAuth(req, "seleccion", { candidatoId });
  if (authError) return authError;

  const { data: candidato } = await supabaseAdmin
    .from("mindeval_candidatos")
    .select("id, nombre_completo, cedula, etapa_actual")
    .eq("id", candidatoId)
    .maybeSingle();
  if (!candidato) return NextResponse.json({ error: "No se encontró el candidato" }, { status: 404 });

  const { detalle, tieneEvaluaciones } = await inventario(candidatoId);
  return NextResponse.json({ candidato, se_perdera: detalle, tiene_evaluaciones: tieneEvaluaciones });
}

export async function DELETE(req: NextRequest) {
  try {
    const { candidato_id: candidatoId, forzar }: { candidato_id: string; forzar?: boolean } = await req.json();
    if (!candidatoId) return NextResponse.json({ error: "Falta el candidato" }, { status: 400 });

    const authError = await requireAuth(req, "seleccion", { candidatoId });
    if (authError) return authError;

    const { permitido } = checkRateLimit(req, "mindeval-eliminar-candidato");
    if (!permitido) return rateLimitResponse();

    const { data: candidato } = await supabaseAdmin
      .from("mindeval_candidatos")
      .select("id, nombre_completo, cv_url")
      .eq("id", candidatoId)
      .maybeSingle();
    if (!candidato) return NextResponse.json({ error: "No se encontró el candidato" }, { status: 404 });

    const { detalle, tieneEvaluaciones } = await inventario(candidatoId);
    if (tieneEvaluaciones && !forzar) {
      return NextResponse.json(
        {
          error: `${candidato.nombre_completo} ya tiene evaluaciones rendidas. Si de verdad quieres eliminarlo, confírmalo de nuevo — o descártalo en vez de borrarlo, para conservar su evaluación.`,
          se_perdera: detalle,
          requiere_confirmacion: true,
        },
        { status: 409 }
      );
    }

    // El bucket no está en la cascada de Postgres: sin esto el PDF quedaría
    // huérfano en Storage para siempre. Best-effort — que falle el borrado
    // del archivo no debe dejar la fila a medio eliminar.
    if (candidato.cv_url) {
      await supabaseAdmin.storage.from("mindeval-cvs").remove([candidato.cv_url]);
    }

    const { error: delErr } = await supabaseAdmin.from("mindeval_candidatos").delete().eq("id", candidatoId);
    if (delErr) return NextResponse.json({ error: `No se pudo eliminar: ${delErr.message}` }, { status: 500 });

    return NextResponse.json({ ok: true, eliminado: candidato.nombre_completo, se_perdio: detalle });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo eliminar el candidato";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

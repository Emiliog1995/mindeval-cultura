import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { avanzarASenescytSiAplica, evaluarDescarteCv } from "@/lib/mindeval-scoring";
import type { MatchCvResultado } from "@/lib/mindeval-ia";

/**
 * Edición de los parámetros de una vacante YA EN CURSO, con recálculo del
 * embudo cuando cambian los cortes.
 *
 * El caso que resuelve: el reclutador abre una vacante con corte de CV en
 * 80%, nadie lo alcanza y todos quedan descartados automáticamente. Sin esta
 * ruta, bajar el corte a 70% no servía de nada -- el descarte ya estaba
 * escrito en mindeval_candidatos.etapa_actual y nadie lo revertía.
 *
 * Reglas del recálculo (deliberadas, ver comentarios en reevaluarPorCorteCv):
 *  - NUNCA se borra una evaluación. Solo se mueven etapa/estado/motivo del
 *    candidato; los match de CV, psicométricas, técnicas y assessment ya
 *    guardados quedan intactos.
 *  - Solo se revierten descartes AUTOMÁTICOS por corte de match de CV. Un
 *    descarte por requisito excluyente, por desacuerdo salarial o hecho a
 *    mano por el reclutador no se toca nunca.
 *  - Un candidato que ya avanzó más allá del filtro de CV (ya rindió
 *    psicométricas, técnica, etc.) nunca se descarta por un cambio de corte
 *    de CV -- sería absurdo echar a alguien que ya invirtió horas en pruebas
 *    porque se movió el filtro de entrada.
 */

// Etapas en las que el candidato todavía está "en el filtro de CV" y por lo
// tanto es legítimo re-evaluarlo contra el corte. Más allá de aquí ya rindió
// algo y su permanencia no depende del match de su CV.
const ETAPAS_EN_FILTRO = ["postulado", "filtro_cv"];

// Prefijo exacto del motivo que escribe evaluarDescarteCv() cuando descarta
// por corte (no por requisito excluyente) -- es la única marca disponible en
// el esquema actual para distinguir un descarte automático reversible de uno
// que no lo es. Si evaluarDescarteCv cambia ese texto, hay que cambiarlo acá.
const MOTIVO_CORTE_CV = "Match de CV";

interface CandidatoRecalculo {
  id: string;
  nombre_completo: string;
  etapa_actual: string;
  estado: string;
  motivo_descarte: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const vacanteId = body.vacante_id as string;

    if (!vacanteId) {
      return NextResponse.json({ error: "Falta la vacante" }, { status: 400 });
    }

    const authError = await requireAuth(req, "seleccion", { vacanteId });
    if (authError) return authError;

    const { permitido } = checkRateLimit(req, "mindeval-actualizar-vacante");
    if (!permitido) return rateLimitResponse();

    const { data: vacante, error: vErr } = await supabaseAdmin
      .from("mindeval_vacantes")
      .select("*")
      .eq("id", vacanteId)
      .single();
    if (vErr || !vacante) {
      return NextResponse.json({ error: "No se encontró la vacante" }, { status: 404 });
    }

    // ── Validación de rangos ────────────────────────────────────────────────
    // Los rangos salen de la lógica real del sistema, no son arbitrarios:
    // match de CV y técnica se expresan en 0-100 (porcentaje / puntaje sobre
    // 100), el STEN es un decatipo normado de 1 a 10.
    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : vacante.titulo;
    const codigoProceso = typeof body.codigo_proceso === "string" ? body.codigo_proceso.trim() : null;
    const corteMatchCv = Number(body.corte_match_cv);
    const corteSten = Number(body.corte_sten);
    const corteTecnica = Number(body.corte_tecnica);

    if (!titulo) {
      return NextResponse.json({ error: "El título de la vacante no puede quedar vacío" }, { status: 400 });
    }
    if (!Number.isFinite(corteMatchCv) || corteMatchCv < 0 || corteMatchCv > 100) {
      return NextResponse.json({ error: "El corte de match de CV debe estar entre 0 y 100" }, { status: 400 });
    }
    if (!Number.isFinite(corteSten) || corteSten < 1 || corteSten > 10) {
      return NextResponse.json({ error: "El corte STEN debe estar entre 1 y 10" }, { status: 400 });
    }
    if (!Number.isFinite(corteTecnica) || corteTecnica < 0 || corteTecnica > 100) {
      return NextResponse.json({ error: "El corte de prueba técnica debe estar entre 0 y 100" }, { status: 400 });
    }

    const estado = body.estado as string;
    if (!["abierta", "pausada", "cerrada"].includes(estado)) {
      return NextResponse.json({ error: "Estado de vacante inválido" }, { status: 400 });
    }

    const modoTecnica = body.modo_tecnica as string;
    if (!["caso_abierto", "banco"].includes(modoTecnica)) {
      return NextResponse.json({ error: "Modo de prueba técnica inválido" }, { status: 400 });
    }

    const testsValidos = ["16pf5", "kostick", "disc", "valanti"];
    const testsPsicometricos: string[] = Array.isArray(body.tests_psicometricos) ? body.tests_psicometricos : [];
    if (testsPsicometricos.some((t) => !testsValidos.includes(t))) {
      return NextResponse.json({ error: "Test psicométrico no reconocido" }, { status: 400 });
    }

    let fechaLimite: string | null = null;
    if (body.fecha_limite_postulacion) {
      const fecha = new Date(body.fecha_limite_postulacion as string);
      if (Number.isNaN(fecha.getTime())) {
        return NextResponse.json({ error: "La fecha límite de postulación no es válida" }, { status: 400 });
      }
      fechaLimite = fecha.toISOString();
    }

    // ── Guardar la vacante ──────────────────────────────────────────────────
    const { error: updErr } = await supabaseAdmin
      .from("mindeval_vacantes")
      .update({
        titulo,
        codigo_proceso: codigoProceso || null,
        estado,
        fecha_limite_postulacion: fechaLimite,
        corte_match_cv: corteMatchCv,
        corte_sten: corteSten,
        corte_tecnica: corteTecnica,
        modo_tecnica: modoTecnica,
        tests_psicometricos: testsPsicometricos,
      })
      .eq("id", vacanteId);
    if (updErr) {
      return NextResponse.json({ error: `No se pudo guardar la vacante: ${updErr.message}` }, { status: 500 });
    }

    // ── Recálculo del embudo ────────────────────────────────────────────────
    const corteCvCambio = Number(vacante.corte_match_cv) !== corteMatchCv;
    const cortesPruebasCambiaron =
      Number(vacante.corte_sten) !== corteSten || Number(vacante.corte_tecnica) !== corteTecnica;

    const resumen = { reactivados: 0, descartados: 0, avanzados: 0, nombres_reactivados: [] as string[], nombres_descartados: [] as string[] };

    if (corteCvCambio || cortesPruebasCambiaron) {
      const { data: candidatos } = await supabaseAdmin
        .from("mindeval_candidatos")
        .select("id, nombre_completo, etapa_actual, estado, motivo_descarte")
        .eq("vacante_id", vacanteId);

      const lista = (candidatos ?? []) as CandidatoRecalculo[];

      if (corteCvCambio && lista.length) {
        const { data: matches } = await supabaseAdmin
          .from("mindeval_cv_matches")
          .select("candidato_id, match_pct, razones, generado_en")
          .in(
            "candidato_id",
            lista.map((c) => c.id)
          )
          .order("generado_en", { ascending: false });

        // el match más reciente por candidato (la query ya viene ordenada desc)
        const matchPorCandidato = new Map<string, { match_pct: number; razones: MatchCvResultado["razones"] }>();
        for (const m of (matches ?? []) as { candidato_id: string; match_pct: number; razones: MatchCvResultado["razones"] }[]) {
          if (!matchPorCandidato.has(m.candidato_id)) matchPorCandidato.set(m.candidato_id, m);
        }

        for (const c of lista) {
          const match = matchPorCandidato.get(c.id);
          if (!match) continue; // sin match calculado todavía: no hay nada que re-evaluar

          const { descartar, motivo } = evaluarDescarteCv(
            { match_pct: match.match_pct, razones: match.razones ?? [] },
            corteMatchCv
          );

          const descartadoPorCorteCv =
            c.etapa_actual === "descartado" && (c.motivo_descarte ?? "").startsWith(MOTIVO_CORTE_CV);

          // Reactivar: estaba descartado por corte de CV y con el corte nuevo
          // ya pasa (y no tiene ningún requisito excluyente incumplido).
          if (descartadoPorCorteCv && !descartar) {
            await supabaseAdmin
              .from("mindeval_candidatos")
              .update({ etapa_actual: "filtro_cv", estado: "activo", motivo_descarte: null })
              .eq("id", c.id);
            resumen.reactivados += 1;
            resumen.nombres_reactivados.push(c.nombre_completo);
            continue;
          }

          // Descartar: sigue en el filtro de CV, está activo, y con el corte
          // nuevo ya no llega. No aplica a quien ya avanzó a pruebas.
          if (descartar && c.estado === "activo" && ETAPAS_EN_FILTRO.includes(c.etapa_actual)) {
            await supabaseAdmin
              .from("mindeval_candidatos")
              .update({ etapa_actual: "descartado", estado: "descartado", motivo_descarte: motivo })
              .eq("id", c.id);
            resumen.descartados += 1;
            resumen.nombres_descartados.push(c.nombre_completo);
          }
        }
      }

      // Cambiar el corte de STEN o de técnica puede hacer que alguien que ya
      // rindió ambas pruebas ahora sí califique para avanzar a SENESCYT.
      // avanzarASenescytSiAplica ya trae todas las guardas (solo candidatos
      // activos, solo en psicometricas/tecnica) -- no hace falta repetirlas.
      if (cortesPruebasCambiaron) {
        for (const c of lista) {
          if (c.estado !== "activo") continue;
          if (c.etapa_actual !== "psicometricas" && c.etapa_actual !== "tecnica") continue;
          const avanzo = await avanzarASenescytSiAplica(supabaseAdmin, c.id, {
            corte_sten: corteSten,
            corte_tecnica: corteTecnica,
          });
          if (avanzo) resumen.avanzados += 1;
        }
      }
    }

    return NextResponse.json({ ok: true, resumen });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo actualizar la vacante";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

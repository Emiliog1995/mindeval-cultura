import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { autorizarInstitucion, NOMBRE_TEST, type TestPsico } from "@/lib/mindeval-institucion";
import { generarClaveTemporal, hashClave } from "@/lib/mindeval-clave";
import { enviarInvitacionInstitucion } from "@/lib/mindeval-email";

/**
 * Agenda e invita a los evaluados elegidos de un proceso de institución.
 * Por cada uno: nueva sesión psicométrica con contraseña temporal (solo se
 * guarda su hash) y correo con enlace + clave. Reinvitar invalida la
 * invitación anterior y genera una clave nueva.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const vacanteId = body?.vacante_id as string | undefined;
  const candidatoIds = (Array.isArray(body?.candidato_ids) ? body.candidato_ids : []) as string[];
  const fecha = body?.fecha_programada as string | undefined;
  if (!vacanteId || candidatoIds.length === 0 || !fecha || Number.isNaN(new Date(fecha).getTime())) {
    return NextResponse.json({ error: "Faltan datos: proceso, evaluados y fecha/hora" }, { status: 400 });
  }

  const aut = await autorizarInstitucion(req, { roles: ["super_admin", "administrador", "evaluador"], vacanteId });
  if ("error" in aut) return aut.error;
  const vacante = aut.vacante as { titulo: string; estado: string; tests_psicometricos: TestPsico[]; tiempo_limite_min: number | null };
  if (vacante.estado !== "abierta") {
    return NextResponse.json({ error: "El proceso está cerrado. Reábrelo para enviar invitaciones." }, { status: 409 });
  }

  const { permitido } = checkRateLimit(req, "mindeval-institucion-invitar");
  if (!permitido) return rateLimitResponse();

  // Solo evaluados de ESTE proceso.
  const { data: candidatos } = await supabaseAdmin
    .from("mindeval_candidatos")
    .select("id, nombre_completo, email, perfil_evaluado")
    .eq("vacante_id", vacanteId)
    .in("id", candidatoIds);

  const pruebas = (vacante.tests_psicometricos ?? []).map((t) => NOMBRE_TEST[t] ?? t);
  const resultados: { candidato_id: string; nombre: string; ok: boolean; motivo?: string; clave_manual?: string }[] = [];

  for (const id of candidatoIds) {
    const c = candidatos?.find((x) => x.id === id);
    if (!c) {
      resultados.push({ candidato_id: id, nombre: "—", ok: false, motivo: "Evaluado no encontrado en este proceso" });
      continue;
    }
    if (!c.email) {
      resultados.push({ candidato_id: id, nombre: c.nombre_completo, ok: false, motivo: "Sin correo registrado" });
      continue;
    }

    await supabaseAdmin
      .from("mindeval_sesiones_prueba")
      .update({ estado: "expirada" })
      .eq("candidato_id", id)
      .eq("vacante_id", vacanteId)
      .eq("tipo", "psicometrica")
      .in("estado", ["programada", "en_curso"]);

    const clave = generarClaveTemporal();
    const { data: sesion, error: sErr } = await supabaseAdmin
      .from("mindeval_sesiones_prueba")
      .insert({
        candidato_id: id,
        vacante_id: vacanteId,
        tipo: "psicometrica",
        fecha_programada: new Date(fecha).toISOString(),
        clave_hash: hashClave(clave),
        perfil_evaluado: c.perfil_evaluado ?? null,
      })
      .select("token")
      .single();
    if (sErr || !sesion) {
      const msg = /clave_hash/.test(sErr?.message ?? "")
        ? "Falta correr la migración mindeval-institucion-proceso.sql en Supabase."
        : "No se pudo crear la invitación";
      resultados.push({ candidato_id: id, nombre: c.nombre_completo, ok: false, motivo: msg });
      continue;
    }

    const envio = await enviarInvitacionInstitucion({
      to: c.email,
      nombreEvaluado: c.nombre_completo,
      proceso: vacante.titulo,
      institucion: aut.empresaNombre,
      fechaProgramada: fecha,
      tiempoLimiteMin: vacante.tiempo_limite_min,
      pruebas,
      link: `${req.nextUrl.origin}/seleccion/prueba/${sesion.token}`,
      clave,
      contacto: { nombre: aut.ctx.email, email: aut.ctx.email },
    });

    resultados.push(
      envio.ok
        ? { candidato_id: id, nombre: c.nombre_completo, ok: true }
        : {
            candidato_id: id,
            nombre: c.nombre_completo,
            ok: false,
            motivo: `Invitación creada, pero falló el correo: ${envio.error}. Entrega la clave en persona.`,
            clave_manual: clave,
          }
    );
  }

  return NextResponse.json({ resultados });
}

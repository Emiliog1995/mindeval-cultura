import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { enviarInvitacionPrueba } from "@/lib/mindeval-email";
import { sesionExpirada } from "@/lib/mindeval-ventana-prueba";

/**
 * Autoservicio para el candidato que perdió su correo o lo tiene en spam
 * (auditoría 2026-09, M-5). Antes no había ningún camino: la única vía era
 * escribirle al reclutador, que tenía que atender cada caso a mano.
 *
 * Ruta pública, sin login — como el formulario de postulación. Dos decisiones
 * de seguridad deliberadas:
 *
 *  1) La respuesta es SIEMPRE la misma, encuentre o no una sesión. Si dijera
 *     "esa cédula no existe", cualquiera podría usar esto para averiguar quién
 *     se postuló a una vacante probando números de cédula.
 *  2) El enlace se manda al correo YA registrado del candidato, nunca a uno
 *     que venga en la petición. Quien no controle ese buzón no recibe nada.
 *
 * No reactiva sesiones vencidas ni completadas: solo reenvía el acceso a una
 * invitación que sigue viva. Reabrir un plazo es decisión del reclutador.
 */
export async function POST(req: NextRequest) {
  const { permitido } = checkRateLimit(req, "mindeval-recuperar-acceso");
  if (!permitido) return rateLimitResponse();

  // Misma respuesta pase lo que pase — ver punto 1 arriba.
  const respuesta = NextResponse.json({
    ok: true,
    mensaje:
      "Si hay una prueba pendiente asociada a esa cédula, te acabamos de enviar el enlace al correo con el que te postulaste. Revisa también tu carpeta de spam.",
  });

  try {
    const { cedula }: { cedula?: string } = await req.json();
    if (!cedula || !/^\d{10}$/.test(cedula)) {
      return NextResponse.json({ error: "Escribe tu cédula (10 dígitos)." }, { status: 400 });
    }

    const { data: candidatos } = await supabaseAdmin
      .from("mindeval_candidatos")
      .select("id, nombre_completo, email")
      .eq("cedula", cedula);
    if (!candidatos?.length) return respuesta;

    const { data: sesiones } = await supabaseAdmin
      .from("mindeval_sesiones_prueba")
      .select("*")
      .in("candidato_id", candidatos.map((c) => c.id))
      .in("estado", ["programada", "en_curso"])
      .order("fecha_programada", { ascending: false });

    // Puede tener procesos en varias empresas a la vez: se le reenvía cada
    // acceso que siga vigente, no solo el más reciente.
    for (const sesion of sesiones ?? []) {
      if (sesionExpirada(sesion)) continue;

      const candidato = candidatos.find((c) => c.id === sesion.candidato_id);
      if (!candidato?.email) continue;

      const { data: vacante } = await supabaseAdmin
        .from("mindeval_vacantes")
        .select("titulo, empresa, contacto_nombre, contacto_email")
        .eq("id", sesion.vacante_id)
        .maybeSingle();
      if (!vacante) continue;

      await enviarInvitacionPrueba({
        to: candidato.email,
        nombreCandidato: candidato.nombre_completo,
        tituloVacante: vacante.titulo,
        empresa: vacante.empresa,
        tipo: sesion.tipo,
        fechaProgramada: sesion.fecha_programada,
        link: `${req.nextUrl.origin}/seleccion/prueba/${sesion.token}`,
        contacto: { nombre: vacante.contacto_nombre, email: vacante.contacto_email },
      });
    }

    return respuesta;
  } catch {
    return respuesta;
  }
}

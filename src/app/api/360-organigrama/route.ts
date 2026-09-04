import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import type { Jefatura, MapaJefaturas } from "@/lib/360-organigrama";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Structured outputs: el esquema lo hace cumplir la API, no el prompt. Aquí
// pesa más que en el PDI porque la salida son ids de personas reales — un JSON
// cortado a la mitad se traduciría en mandarle el formulario a quien no es.
const JEFATURAS_SCHEMA = {
  type: "object",
  properties: {
    jefaturas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          persona_id: { type: "string" },
          jefe_persona_id: { type: ["string", "null"] },
          confianza: { type: "string", enum: ["alta", "media", "baja"] },
          motivo: { type: "string" },
        },
        required: ["persona_id", "jefe_persona_id", "confianza", "motivo"],
        additionalProperties: false,
      },
    },
  },
  required: ["jefaturas"],
  additionalProperties: false,
} as const;

interface PersonaRoster {
  id: string;
  nombre: string;
  email: string | null;
  cargo_externo: string | null;
  puestos: {
    nombre_puesto: string;
    area: string | null;
    supervisado_por: string | null;
    supervisa_a: string | null;
  } | null;
}

function describirPersona(p: PersonaRoster): string {
  return [
    `  - id: ${p.id}`,
    `    nombre: ${p.nombre}`,
    `    correo: ${p.email ?? "sin correo"}`,
    // El cargo libre es lo que permite emparejar a un evaluador externo con el
    // organigrama: p. ej. quien representa a la "Asamblea General de Miembros",
    // que en el Manual figura como jefatura pero no es una persona.
    `    puesto: ${p.puestos?.nombre_puesto ?? p.cargo_externo ?? "sin puesto asignado"}`,
    `    area: ${p.puestos?.area ?? (p.cargo_externo ? "externo a la nomina de la organizacion" : "sin area")}`,
    `    reporta a (texto del Manual): ${p.puestos?.supervisado_por ?? "no indicado"}`,
    `    supervisa a (texto del Manual): ${p.puestos?.supervisa_a ?? "no indicado"}`,
  ].join("\n");
}

/**
 * Reconstruye la línea de mando real de una organización a partir del
 * organigrama en texto libre del Manual de Puestos.
 *
 * Se resuelve la nómina entera de una sola vez, no persona por persona: los
 * pares y los colaboradores se derivan después de este mapa (ver
 * derivarDestinatarios), y así el resultado es consistente consigo mismo —
 * si A es par de B, B es par de A. Resolviendo cada persona por separado el
 * modelo producía conjuntos de pares asimétricos entre una consulta y otra.
 */
// Llama a Claude y puede superar el límite por defecto de las funciones
// serverless de Vercel (10-15s) -- mismo motivo que maxDuration en
// /api/mindeval-postular: la función muere a mitad de camino y el navegador
// recibe la página de error de Vercel en vez de JSON.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req, "evaluacion_360");
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "360-organigrama");
  if (!permitido) return rateLimitResponse();

  try {
    const { empresa_id }: { empresa_id?: string } = await req.json();
    if (!empresa_id) {
      return NextResponse.json({ error: "Falta empresa_id" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("personas")
      .select("id, nombre, email, cargo_externo, puestos(nombre_puesto, area, supervisado_por, supervisa_a)")
      .eq("empresa_id", empresa_id)
      .order("nombre");
    if (error) throw new Error(error.message);

    const roster = (data ?? []) as unknown as PersonaRoster[];
    if (roster.length === 0) {
      return NextResponse.json({ jefaturas: [], con_ia: false } satisfies MapaJefaturas);
    }

    const prompt = `Eres un analista de talento humano reconstruyendo la línea de mando real de una organización.

La organización describe su organigrama como TEXTO LIBRE en el Manual de Puestos (campos "reporta a" y "supervisa a"). Ese texto casi nunca coincide palabra por palabra con el nombre real del puesto: puede estar abreviado ("Representante Legal" cuando el puesto se llama "Presidenta y Representante Legal"), estar en plural ("Coordinadores de Subproyecto"), enumerar varios puestos en una frase, o nombrar a alguien que NO está en la nómina (una asamblea, un directorio, voluntarios, becarios).

NÓMINA COMPLETA (${roster.length} personas):
${roster.map(describirPersona).join("\n")}

Para CADA UNA de las ${roster.length} personas devuelve quién es su jefe directo concreto: el id de la persona de la nómina que ocupa el puesto al que reporta.

REGLAS QUE NO PUEDES ROMPER:
- Devuelve exactamente una entrada por persona de la nómina, usando su id textual. Nunca inventes un id.
- "jefe_persona_id" debe ser un id de la nómina, o null si nadie de la nómina ocupa ese puesto superior (asamblea, directorio, cargo vacante). Devolver null es una respuesta correcta, no un fracaso.
- Nadie es jefe de sí mismo.
- Un mismo puesto puede tener varios ocupantes en distintas sucursales o subproyectos. Para elegir al jefe concreto usa el área del puesto y sobre todo el prefijo del correo institucional, que suele identificar la sede (dos correos con el mismo prefijo antes del punto pertenecen a la misma sucursal). Di en "motivo" qué señal usaste, citando el correo tal como aparece en la nómina y sin reconstruirlo de memoria.
- Prefiere null antes que arriesgar un jefe equivocado: si el formulario le llega a quien no corresponde, la evaluación queda contaminada.
- "confianza": "alta" solo si es inequívoco; "media" si es la lectura más razonable pero cabe otra; "baja" si es conjetura. Con jefe_persona_id null usa "baja".
- "motivo": UNA sola frase de máximo 20 palabras, en español. La lee la consultora antes de enviar los enlaces; no repitas la regla ni cites ids, di solo de dónde sale el match.`;

    const message = await client.messages.parse({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: jsonSchemaOutputFormat(JEFATURAS_SCHEMA) },
    });

    if (message.stop_reason === "max_tokens") {
      throw new Error("La respuesta de la IA se cortó por longitud. Vuelve a intentarlo.");
    }

    const parsed = message.parsed_output as { jefaturas: Jefatura[] } | null;
    if (!parsed) throw new Error("La IA no devolvió un organigrama válido");

    // Barrera dura sobre la salida del modelo: solo ids que existen en esta
    // nómina, nadie como jefe de sí mismo, una entrada por persona.
    const ids = new Set(roster.map((p) => p.id));
    const vistos = new Set<string>();
    const jefaturas: Jefatura[] = [];
    for (const j of parsed.jefaturas) {
      if (!ids.has(j.persona_id) || vistos.has(j.persona_id)) continue;
      vistos.add(j.persona_id);
      const jefeValido =
        j.jefe_persona_id && ids.has(j.jefe_persona_id) && j.jefe_persona_id !== j.persona_id
          ? j.jefe_persona_id
          : null;
      jefaturas.push({
        persona_id: j.persona_id,
        jefe_persona_id: jefeValido,
        confianza: jefeValido ? j.confianza : "baja",
        motivo: jefeValido
          ? j.motivo
          : j.motivo || "No se identificó en la nómina a quién ocupa el puesto superior.",
      });
    }

    return NextResponse.json({ jefaturas, con_ia: true } satisfies MapaJefaturas);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al resolver el organigrama" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import type { ResultadoConsolidado360 } from "@/lib/360-types";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PLAZOS_VALIDOS = ["1 mes", "3 meses", "6 meses", "12 meses"] as const;

// El esquema lo hace cumplir la API (structured outputs), no el prompt: antes se
// pedia JSON por texto y se extraia con regex, y cuando la respuesta crecia se
// cortaba por max_tokens dejando un JSON a medias que reventaba el JSON.parse.
const PDI_SCHEMA = {
  type: "object",
  properties: {
    areas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          area_mejora: { type: "string" },
          objetivo_smart: { type: "string" },
          accion: { type: "string" },
        },
        required: ["area_mejora", "objetivo_smart", "accion"],
        additionalProperties: false,
      },
    },
    plazo: { type: "string", enum: PLAZOS_VALIDOS },
    indicador: { type: "string" },
  },
  required: ["areas", "plazo", "indicador"],
  additionalProperties: false,
} as const;

// Llama a Claude y puede superar el límite por defecto de las funciones
// serverless de Vercel (10-15s) -- mismo motivo que maxDuration en
// /api/mindeval-postular: la función muere a mitad de camino y el navegador
// recibe la página de error de Vercel en vez de JSON.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req, "evaluacion_360");
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "360-pdi-sugerido");
  if (!permitido) return rateLimitResponse();

  try {
    const { resultado }: { resultado: ResultadoConsolidado360 } = await req.json();
    const { evaluado, brechas, nombreCuadrante, accionCuadrante, periodo } = resultado;

    // Contexto organizacional: genérico para cualquier tipo de cliente
    // (fundación, empresa privada, etc.) — se arma solo con lo que la
    // empresa tenga cargado, sin nada específico de una organización.
    let contextoEmpresa = "";
    if (evaluado.empresa_id) {
      const { data: emp } = await supabaseAdmin
        .from("empresas_mdt")
        .select("nombre, sector, giro_negocio, mision_empresa, objetivos, valores")
        .eq("id", evaluado.empresa_id)
        .single();
      if (emp) {
        contextoEmpresa = `\nContexto organizacional:
Organización: ${emp.nombre}${emp.sector ? `\nSector / tipo de organización: ${emp.sector}` : ""}${emp.giro_negocio ? `\nGiro: ${emp.giro_negocio}` : ""}${emp.mision_empresa ? `\nMisión institucional: ${emp.mision_empresa}` : ""}${emp.objetivos ? `\nObjetivos estratégicos: ${emp.objetivos}` : ""}${emp.valores ? `\nValores: ${emp.valores}` : ""}\n`;
      }
    }

    // Contexto del puesto tomado del Manual de Puestos (solo lectura): misión,
    // actividades esenciales MDT e indicadores de gestión con la calificación
    // real del jefe. Es lo que permite sustentar ante el cliente de dónde sale
    // cada acción del PDI, en vez de que la IA hable de competencias en abstracto.
    let contextoPuesto = "";
    if (evaluado.puesto_id) {
      const { data: puesto } = await supabaseAdmin
        .from("puestos")
        .select("mision")
        .eq("id", evaluado.puesto_id)
        .single();
      if (puesto?.mision) {
        contextoPuesto = `\nMisión del puesto: ${puesto.mision}\n`;
      }

      const { data: esenciales } = await supabaseAdmin
        .from("actividades_puesto")
        .select("id, descripcion")
        .eq("puesto_id", evaluado.puesto_id)
        .eq("es_esencial", true)
        .order("orden");

      if (esenciales?.length) {
        contextoPuesto += `\nActividades esenciales del puesto (metodología MDT):\n${esenciales
          .map((a) => `  - ${a.descripcion}`)
          .join("\n")}\n`;

        const { data: indicadores } = await supabaseAdmin
          .from("indicadores_puesto")
          .select("id, indicador, meta")
          .in("actividad_esencial_id", esenciales.map((a) => a.id));

        if (indicadores?.length) {
          const { data: notas } = await supabaseAdmin
            .from("indicadores_resultado_360")
            .select("indicador_puesto_id, calificacion")
            .eq("evaluado_id", evaluado.id)
            .eq("periodo", periodo);

          const notaPorIndicador = new Map(
            (notas ?? []).map((n) => [n.indicador_puesto_id, n.calificacion]),
          );
          contextoPuesto += `\nIndicadores de gestión de esas actividades esenciales, con la calificación del jefe directo (escala 1-5, donde 5 = superó la meta):\n${indicadores
            .map((i) => {
              const nota = notaPorIndicador.get(i.id);
              return `  - ${i.indicador} | meta: ${i.meta} | calificación: ${nota ?? "sin calificar"}`;
            })
            .join("\n")}\n`;
        }
      }
    }

    const brechasPrioritarias = brechas.slice(0, 3);
    const brechasTexto = brechasPrioritarias
      .map((b) => `  - ${b.label}: actual ${b.actual.toFixed(2)} / meta ${b.meta.toFixed(1)} (brecha ${b.brecha.toFixed(2)}, prioridad ${b.prioridad})`)
      .join("\n");

    const prompt = `Eres un experto en psicología organizacional y desarrollo de talento humano.
Con base en los resultados de la evaluación 360° de este colaborador, redacta una PROPUESTA INICIAL de Plan de Desarrollo Individual (PDI) que el equipo de Talento Humano revisará y ajustará antes de formalizarla.

DATOS DEL COLABORADOR:
- Nombre: ${evaluado.nombre}
- Cargo: ${evaluado.cargo}
- Departamento / área: ${evaluado.departamento}
${contextoEmpresa}${contextoPuesto}
POSICIÓN EN LA MATRIZ DE 9 CAJAS: ${nombreCuadrante}
Acción recomendada según el cuadrante: ${accionCuadrante}

BRECHAS PRIORITARIAS (competencias con mayor diferencia frente a la meta):
${brechasTexto}

Al redactar las acciones, aterrízalas en las actividades esenciales y en los indicadores de gestión listados arriba, dando prioridad a los indicadores con calificación más baja. El plan debe servir para mejorar el desempeño real del puesto y no solo la competencia en abstracto. Si un indicador está "sin calificar", no lo uses como evidencia.

Para cada una de las brechas listadas arriba (en el mismo orden, una por una), propone:
- Un "área de mejora" (nombre corto y claro)
- Un "objetivo SMART" (específico, medible, alcanzable, relevante, con plazo)
- Una "acción concreta" de desarrollo, realista para el contexto de esta organización y este puesto

También propone:
- Un plazo de cumplimiento para todo el plan
- Un indicador de éxito medible para verificar el cumplimiento del plan

Devuelve un objeto en "areas" por cada brecha recibida, en el mismo orden. Escribe en español, en prosa directa y sin relleno: el objetivo SMART y la acción no deben pasar de dos líneas cada uno.`;

    const message = await client.messages.parse({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: jsonSchemaOutputFormat(PDI_SCHEMA) },
    });

    if (message.stop_reason === "max_tokens") {
      throw new Error(
        "La respuesta de la IA se cortó por longitud. Vuelve a intentarlo.",
      );
    }

    const sugerencia = message.parsed_output;
    if (!sugerencia) throw new Error("La IA no devolvió una sugerencia válida");

    return NextResponse.json(sugerencia);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al generar la sugerencia de PDI" },
      { status: 500 },
    );
  }
}

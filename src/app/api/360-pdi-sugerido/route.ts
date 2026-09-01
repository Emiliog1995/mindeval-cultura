import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ResultadoConsolidado360 } from "@/lib/360-types";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PLAZOS_VALIDOS = ["1 mes", "3 meses", "6 meses", "12 meses"];

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req, "evaluacion_360");
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "360-pdi-sugerido");
  if (!permitido) return rateLimitResponse();

  try {
    const { resultado }: { resultado: ResultadoConsolidado360 } = await req.json();
    const { evaluado, brechas, nombreCuadrante, accionCuadrante } = resultado;

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

Para cada una de las brechas listadas arriba (en el mismo orden, una por una), propone:
- Un "área de mejora" (nombre corto y claro)
- Un "objetivo SMART" (específico, medible, alcanzable, relevante, con plazo)
- Una "acción concreta" de desarrollo, realista para el contexto de esta organización y este puesto

También propone:
- Un plazo de cumplimiento, que debe ser EXACTAMENTE uno de estos valores: ${PLAZOS_VALIDOS.join(", ")}
- Un indicador de éxito medible para verificar el cumplimiento del plan

Responde ÚNICAMENTE en JSON con esta estructura exacta (un objeto por cada brecha recibida, en el mismo orden):
{
  "areas": [
    {"area_mejora": "...", "objetivo_smart": "...", "accion": "..."}
  ],
  "plazo": "3 meses",
  "indicador": "..."
}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const texto = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("La IA no devolvió una sugerencia válida");
    const sugerencia = JSON.parse(jsonMatch[0]);

    if (!PLAZOS_VALIDOS.includes(sugerencia.plazo)) {
      sugerencia.plazo = "3 meses";
    }

    return NextResponse.json(sugerencia);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al generar la sugerencia de PDI" },
      { status: 500 },
    );
  }
}

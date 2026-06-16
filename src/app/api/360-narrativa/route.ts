import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ResultadoConsolidado360 } from "@/lib/360-types";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { permitido } = checkRateLimit(req, "360-narrativa");
  if (!permitido) return rateLimitResponse();

  try {
    const { resultado }: { resultado: ResultadoConsolidado360 } = await req.json();
    const { evaluado, periodo, puntaje360, nivelDesempeno, puntajePotencial,
            nivelPotencial, cuadrante, nombreCuadrante, accionCuadrante, brechas } = resultado;

    const competenciasTexto = brechas
      .map((b) => `  - ${b.label}: actual ${b.actual.toFixed(2)} / meta ${b.meta.toFixed(1)} (brecha ${b.brecha.toFixed(2)}, prioridad ${b.prioridad})`)
      .join("\n");

    const prompt = `Eres un experto en psicología organizacional y desarrollo de talento humano.
Analiza los resultados de evaluación 360° del siguiente colaborador y redacta un informe narrativo profesional en español.

DATOS DEL COLABORADOR:
- Nombre: ${evaluado.nombre}
- Cargo: ${evaluado.cargo}
- Departamento: ${evaluado.departamento}
- Período: ${periodo}

RESULTADOS 360°:
- Puntaje global: ${puntaje360.toFixed(2)} / 5.0 — Nivel: ${nivelDesempeno}
- Potencial: ${puntajePotencial.toFixed(2)} / 5.0 — Nivel: ${nivelPotencial}
- Posición Nine Box: Cuadrante ${cuadrante} — ${nombreCuadrante}
- Acción recomendada según Nine Box: ${accionCuadrante}

ANÁLISIS DE BRECHAS (ordenado por prioridad):
${competenciasTexto}

Redacta un informe de 4 párrafos:
1. Resumen ejecutivo del desempeño global
2. Fortalezas identificadas (competencias con mayor puntaje)
3. Áreas de oportunidad prioritarias según brechas y cuadrante Nine Box
4. Recomendaciones específicas de desarrollo para los próximos 6 meses

Tono: profesional, objetivo, constructivo. Evitar juicios de valor negativos. Máximo 400 palabras.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const narrativa = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    return NextResponse.json({ narrativa });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al generar narrativa";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

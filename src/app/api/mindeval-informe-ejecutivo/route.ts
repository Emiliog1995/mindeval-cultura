import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { categoriaSten } from "@/lib/mindeval-scoring";
import type { Candidato } from "@/lib/mindeval-types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface InformeInput {
  candidato: Candidato;
  titulo_vacante: string;
  matchCv?: number;
  stenPromedio?: number;
  tecnicaTotal?: number;
  assessmentPromedio?: number;
  idoneidadGlobal: number | null;
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "mindeval-informe-ejecutivo");
  if (!permitido) return rateLimitResponse();

  try {
    const input: InformeInput = await req.json();
    const { candidato, titulo_vacante, matchCv, stenPromedio, tecnicaTotal, assessmentPromedio, idoneidadGlobal } = input;

    const lineas: string[] = [];
    if (matchCv !== undefined) lineas.push(`- Match de CV con IA: ${matchCv}%`);
    if (stenPromedio !== undefined) lineas.push(`- Promedio psicométrico: STEN ${stenPromedio.toFixed(1)} (${categoriaSten(Math.round(stenPromedio))})`);
    if (tecnicaTotal !== undefined) lineas.push(`- Prueba técnica: ${tecnicaTotal}/100`);
    if (assessmentPromedio !== undefined) lineas.push(`- Assessment Center: ${assessmentPromedio.toFixed(1)}/10`);

    if (!lineas.length) {
      return NextResponse.json(
        { error: "El candidato aún no tiene resultados registrados en ninguna etapa" },
        { status: 400 }
      );
    }

    const prompt = `Eres un consultor de selección de talento. Redacta un informe ejecutivo breve
y profesional sobre este candidato, en español.

VACANTE: ${titulo_vacante}
CANDIDATO: ${candidato.nombre_completo}${candidato.anios_experiencia ? ` · ${candidato.anios_experiencia} años de experiencia` : ""}${candidato.ciudad ? ` · ${candidato.ciudad}` : ""}

RESULTADOS DISPONIBLES:
${lineas.join("\n")}
${idoneidadGlobal !== null ? `- % Idoneidad global (consolidado): ${idoneidadGlobal}%` : ""}

Redacta 3 párrafos:
1. Ajuste general al perfil del puesto, basado únicamente en los resultados dados arriba
2. Fortalezas más relevantes según los resultados disponibles
3. Recomendación (avanzar / mantener en espera / descartar) y riesgo de rotación estimado

Reglas: usa solo los datos provistos arriba, nunca inventes puntajes de etapas no incluidas
en la lista. Tono profesional, objetivo, constructivo. Máximo 350 palabras.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    });

    const contenido = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    return NextResponse.json({ contenido });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al generar el informe ejecutivo";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

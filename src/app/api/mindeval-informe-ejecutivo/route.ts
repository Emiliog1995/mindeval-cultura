import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { categoriaSten } from "@/lib/mindeval-scoring";
import { NOMBRES_CATEGORIA_TEXTO_DISC, type CategoriaTextoDISC } from "@/lib/mindeval-disc";
import type { Candidato } from "@/lib/mindeval-types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface DatoEscala { nombre: string; valor: number }

interface InformeInput {
  candidato: Candidato;
  titulo_vacante: string;
  matchCv?: number;
  stenPromedio?: number;
  tecnicaTotal?: number;
  assessmentPromedio?: number;
  idoneidadGlobal: number | null;
  datos16pf5?: DatoEscala[];
  datosKostick?: DatoEscala[];
  datosDisc?: DatoEscala[];
  patronDisc?: string;
  textosPatronDisc?: Partial<Record<CategoriaTextoDISC, string>>;
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "mindeval-informe-ejecutivo");
  if (!permitido) return rateLimitResponse();

  try {
    const input: InformeInput = await req.json();
    const {
      candidato, titulo_vacante, matchCv, stenPromedio, tecnicaTotal, assessmentPromedio, idoneidadGlobal,
      datos16pf5, datosKostick, datosDisc, patronDisc, textosPatronDisc,
    } = input;

    const lineas: string[] = [];
    if (matchCv !== undefined) lineas.push(`- Match de CV con IA: ${matchCv}%`);
    if (stenPromedio !== undefined) lineas.push(`- Promedio psicométrico: STEN ${stenPromedio.toFixed(1)} (${categoriaSten(Math.round(stenPromedio))})`);
    if (tecnicaTotal !== undefined) lineas.push(`- Prueba técnica: ${tecnicaTotal}/100`);
    if (assessmentPromedio !== undefined) lineas.push(`- Assessment Center: ${assessmentPromedio.toFixed(1)}/10`);

    const detallePsicometrico: string[] = [];
    if (datos16pf5?.length) {
      detallePsicometrico.push(`16PF-5 (rasgos de personalidad, decatipo 1-10, 5-6 es la media poblacional):`);
      datos16pf5.forEach((d) => detallePsicometrico.push(`  - ${d.nombre}: ${d.valor}`));
    }
    if (datosKostick?.length) {
      detallePsicometrico.push(`KOSTICK / PDI (preferencias de estilo de trabajo, conteo 0-9, no es un decatipo normado):`);
      datosKostick.forEach((d) => detallePsicometrico.push(`  - ${d.nombre}: ${d.valor}`));
    }
    if (datosDisc?.length) {
      detallePsicometrico.push(`DISC (estilo conductual, segmento 1-7 por rasgo):`);
      datosDisc.forEach((d) => detallePsicometrico.push(`  - ${d.nombre}: ${d.valor}`));
      if (patronDisc) detallePsicometrico.push(`  Patrón DISC resultante: ${patronDisc}`);
      if (textosPatronDisc) {
        detallePsicometrico.push(`  Descripción interpretativa del patrón "${patronDisc}":`);
        for (const [cat, texto] of Object.entries(textosPatronDisc)) {
          const nombreCategoria = NOMBRES_CATEGORIA_TEXTO_DISC[cat as CategoriaTextoDISC] ?? cat;
          detallePsicometrico.push(`    · ${nombreCategoria}: ${texto}`);
        }
      }
    }

    if (!lineas.length && !detallePsicometrico.length) {
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
${lineas.length ? lineas.join("\n") : "(sin puntajes consolidados de etapa)"}
${idoneidadGlobal !== null ? `- % Idoneidad global (consolidado): ${idoneidadGlobal}%` : ""}
${detallePsicometrico.length ? `\nDETALLE DE PRUEBAS PSICOMÉTRICAS:\n${detallePsicometrico.join("\n")}` : ""}

Redacta 3 párrafos:
1. Ajuste general al perfil del puesto, basado únicamente en los resultados dados arriba
2. Fortalezas más relevantes según los resultados disponibles — si hay detalle de pruebas
   psicométricas, interpreta qué implican los rasgos/factores/patrón más relevantes para el
   desempeño en este puesto, no te limites a repetir los puntajes
3. Áreas de atención o riesgo (incluyendo rasgos psicométricos que convenga vigilar, si aplica)
   y recomendación final (avanzar / mantener en espera / descartar) con riesgo de rotación estimado

Reglas: usa solo los datos provistos arriba, nunca inventes puntajes, factores o rasgos que no
estén en la lista. Tono profesional, objetivo, constructivo. Máximo 450 palabras.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
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

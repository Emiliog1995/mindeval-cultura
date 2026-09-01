import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { categoriaSten } from "@/lib/mindeval-scoring";
import { NOMBRES_CATEGORIA_TEXTO_DISC, type CategoriaTextoDISC } from "@/lib/mindeval-disc";
import type { Candidato } from "@/lib/mindeval-types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// El Informe Final es un texto largo generado por Claude -- puede superar
// el límite por defecto de las funciones serverless de Vercel con un cold
// start, mismo motivo que maxDuration en /api/mindeval-postular.
export const maxDuration = 60;

interface DatoEscala { nombre: string; valor: number }

type EstadoSenescyt = "pendiente" | "registrado" | "sin_registro";

const LABEL_SENESCYT: Record<EstadoSenescyt, string> = {
  registrado: "Registrado",
  sin_registro: "Sin registro",
  pendiente: "Pendiente",
};

interface InformeInput {
  candidato: Candidato;
  titulo_vacante: string;
  matchCv?: number;
  estadoSenescyt?: EstadoSenescyt;
  stenPromedio?: number;
  tecnicaTotal?: number;
  assessmentPromedio?: number;
  datos16pf5?: DatoEscala[];
  datosKostick?: DatoEscala[];
  datosDisc?: DatoEscala[];
  patronDisc?: string;
  textosPatronDisc?: Partial<Record<CategoriaTextoDISC, string>>;
  datosValanti?: DatoEscala[];
}

// Texto fijo en el código, la IA nunca lo redacta -- así no se diluye ni
// varía de una generación a otra. Este informe es la Etapa 7 (Informe
// Final): se genera ANTES de la Entrevista Virtual (Etapa 8) y nunca la usa
// como evidencia -- la entrevista es decisión humana del panel, no un dato
// que la IA deba consolidar.
const NOTA_DE_ALCANCE =
  "Los resultados de instrumentos de elección forzada (Kostick, DISC, VALANTI) expresan prioridad relativa, no diagnóstico individual. Este informe se generó antes de la entrevista y no la sustituye ni constituye una evaluación clínica.";

export async function POST(req: NextRequest) {
  const { permitido } = checkRateLimit(req, "mindeval-informe-ejecutivo");
  if (!permitido) return rateLimitResponse();

  try {
    const input: InformeInput = await req.json();

    // A diferencia del resto de rutas del módulo, esta no lee la base de
    // datos (recibe los puntajes ya calculados en el body) -- por eso no
    // filtraba por empresa como las demás. No es una fuga de datos ajenos,
    // pero rompía el patrón "toda ruta de Selección valida el recurso
    // contra la empresa de la cuenta" (auditoría 2026-09).
    const authError = await requireAuth(req, "seleccion", { candidatoId: input?.candidato?.id });
    if (authError) return authError;

    const {
      candidato, titulo_vacante, matchCv, estadoSenescyt, stenPromedio, tecnicaTotal, assessmentPromedio,
      datos16pf5, datosKostick, datosDisc, patronDisc, textosPatronDisc, datosValanti,
    } = input;

    // Nivel 1 -- desempeño verificado en una tarea representativa del
    // puesto. Nunca incluye datos de mindeval_entrevistas: esa etapa (8,
    // Entrevista Virtual) va DESPUÉS de este informe y queda fuera del
    // framework de niveles de evidencia por diseño.
    const nivel1: string[] = [];
    if (tecnicaTotal !== undefined) nivel1.push(`- Prueba técnica: ${tecnicaTotal}/100`);
    if (assessmentPromedio !== undefined) nivel1.push(`- Assessment Center: ${assessmentPromedio.toFixed(1)}/10`);

    // Contexto de entrada -- nunca es evidencia de desempeño, nunca sustenta
    // una fortaleza de Nivel 1. Se reporta siempre que exista.
    const contexto: string[] = [];
    if (matchCv !== undefined) contexto.push(`- Match de CV con IA (filtro de entrada, no evidencia de desempeño): ${matchCv}%`);
    if (estadoSenescyt) contexto.push(`- Verificación SENESCYT (dato factual, no evidencia de desempeño): ${LABEL_SENESCYT[estadoSenescyt]}`);

    // Nivel 2 -- solo convergencia real de 2+ instrumentos de formato
    // distinto sobre el mismo constructo. La IA decide si existe o no;
    // nunca se la fuerza a encontrar una.
    const detallePsicometrico: string[] = [];
    if (stenPromedio !== undefined) detallePsicometrico.push(`Promedio STEN normado (excluye Kostick/DISC/VALANTI, no normados): ${stenPromedio.toFixed(1)} (${categoriaSten(Math.round(stenPromedio))})`);
    if (datos16pf5?.length) {
      detallePsicometrico.push(`16PF-5 (rasgos de personalidad, decatipo 1-10 normado, 5-6 es la media poblacional):`);
      datos16pf5.forEach((d) => detallePsicometrico.push(`  - ${d.nombre}: ${d.valor}`));
    }
    if (datosKostick?.length) {
      detallePsicometrico.push(`KOSTICK / PDI (preferencias de estilo de trabajo, conteo 0-9, ipsativo -- prioridad relativa dentro del propio perfil, no comparable entre personas):`);
      datosKostick.forEach((d) => detallePsicometrico.push(`  - ${d.nombre}: ${d.valor}`));
    }
    if (datosDisc?.length) {
      detallePsicometrico.push(`DISC (estilo conductual, segmento 1-7 por rasgo, ipsativo -- prioridad relativa, no comparable entre personas):`);
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
    if (datosValanti?.length) {
      detallePsicometrico.push(`VALANTI (5 Valores Humanos -- Verdad, Rectitud, Paz, Amor, No violencia; puntaje estándar tipo T, media 50/DE 10, ipsativo -- prioridad relativa, no comparable entre personas):`);
      datosValanti.forEach((d) => detallePsicometrico.push(`  - ${d.nombre}: ${d.valor}`));
    }

    if (!nivel1.length && !detallePsicometrico.length) {
      return NextResponse.json(
        { error: "El candidato aún no tiene resultados de técnica, assessment o psicométricas -- todavía no se puede generar el Informe Final" },
        { status: 400 }
      );
    }

    const prompt = `Eres un consultor de selección de talento redactando el INFORME FINAL de un
candidato (Etapa 7 del proceso, antes de la entrevista) en español. Este informe se
sustenta en NIVELES DE EVIDENCIA, nunca en un índice compuesto ni en un perfil
psicológico inventado:

- Nivel 1 (desempeño verificado en tarea representativa del puesto): prueba técnica y
  assessment center. Es la evidencia principal.
- Nivel 2 (convergencia de 2+ instrumentos psicométricos de FORMATO DISTINTO sobre el
  mismo constructo, ej. 16PF-5 + DISC + Kostick apuntando a lo mismo): complementario,
  nunca sustituye al Nivel 1. Repórtalo SOLO si de verdad hay 2+ instrumentos alineados
  en los datos de abajo -- nunca inventes ni fuerces una convergencia que no está ahí.
- Nivel 3 (un hallazgo de una sola escala, o contradicho por otro instrumento): nunca es
  una fortaleza, se reporta como punto a verificar en la entrevista (que aún no ha
  ocurrido), no como conclusión.

VACANTE: ${titulo_vacante}
CANDIDATO: ${candidato.nombre_completo}${candidato.anios_experiencia ? ` · ${candidato.anios_experiencia} años de experiencia` : ""}${candidato.ciudad ? ` · ${candidato.ciudad}` : ""}

EVIDENCIA DE NIVEL 1 (desempeño verificado):
${nivel1.length ? nivel1.join("\n") : "(sin resultados de técnica o assessment todavía -- decláralo pendiente, no inventes un puntaje)"}

CONTEXTO DE ENTRADA (nunca evidencia de desempeño, nunca fortaleza de Nivel 1):
${contexto.length ? contexto.join("\n") : "(sin datos de match de CV ni SENESCYT)"}
${detallePsicometrico.length ? `\nDATOS PSICOMÉTRICOS PARA BUSCAR CONVERGENCIAS DE NIVEL 2:\n${detallePsicometrico.join("\n")}` : ""}

Estructura del informe (condensado, 300-400 palabras en prosa -- no cuentan tablas/bullets):
1. Encabezado breve: candidato, puesto, verificación SENESCYT si existe, dictamen
   (Recomendado / Recomendado con condiciones / No recomendado / Pendiente de más etapas
   si aún falta técnica o assessment).
2. Resumen (2-3 líneas): posición relativa y evidencia principal que sustenta el dictamen.
3. Evidencia de Nivel 1: el resultado concreto con cifra real -- nunca "buen desempeño" sin
   el número.
4. Convergencias de Nivel 2 (solo si existen de verdad, máximo 3).
5. Fortalezas sustentadas: bullets, cada uno etiquetado [Nivel 1] o [Nivel 2] -- nunca un
   hallazgo de Nivel 3.
6. Riesgos y mitigación: bullets breves, riesgo + de dónde sale + una acción concreta. Un
   riesgo de "autonomía" o similar se sugiere verificar en la entrevista, sin adelantar su
   resultado (todavía no ha ocurrido).
7. Recomendación: el dictamen otra vez, con foco sugerido para la entrevista si aplica.

Reglas estrictas: usa solo los datos provistos arriba, nunca inventes puntajes, factores o
convergencias fuera de la lista. NUNCA calcules ni menciones un índice compuesto o
porcentaje de idoneidad agregado. NUNCA uses ni menciones datos de una entrevista -- esa
etapa todavía no ha ocurrido cuando se genera este informe. NUNCA trates un puntaje
ipsativo (Kostick/DISC/VALANTI) como magnitud comparable entre personas. Tono profesional,
objetivo, constructivo. NO incluyas una nota de alcance/disclaimer al final -- esa se agrega
aparte, fuera de tu respuesta.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const textoGenerado = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    // La nota de alcance es texto fijo, no generado por la IA -- se agrega
    // siempre, aquí en el servidor, para que nunca se diluya ni varíe.
    const contenido = `${textoGenerado.trim()}\n\n---\n${NOTA_DE_ALCANCE}`;

    return NextResponse.json({ contenido });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al generar el informe ejecutivo";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

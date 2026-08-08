import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { PerfilCargoManual } from "./mindeval-types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface MatchCvResultado {
  match_pct: number;
  razones: { criterio: string; cumple: boolean; detalle: string }[];
}

function extraerJson(texto: string): Record<string, unknown> {
  const jsonMatch = texto.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("La IA no devolvió un JSON válido");
  return JSON.parse(jsonMatch[0]);
}

function textoDeMensaje(message: Anthropic.Message): string {
  return message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n");
}

/**
 * Compara un CV (texto plano, ya extraído del PDF/DOCX) contra el perfil del
 * puesto y devuelve un % de match semántico + razones. Compartido entre la
 * ruta autenticada (/api/mindeval-cv-match, candidatos añadidos a mano) y la
 * ruta pública de postulación (/api/mindeval-postular, match automático).
 */
export async function calcularMatchCv(cvTexto: string, perfilCargo: PerfilCargoManual | null): Promise<MatchCvResultado> {
  const durasTexto = (perfilCargo?.competencias_duras ?? [])
    .map((c) => `  - ${c.nombre}${c.excluyente ? " (EXCLUYENTE)" : ""} — peso ${c.peso}%`)
    .join("\n");
  const blandasTexto = (perfilCargo?.competencias_blandas ?? [])
    .map((c) => `  - ${c.nombre} (nivel esperado ${c.nivel_esperado}/10)`)
    .join("\n");

  const prompt = `Eres un reclutador experto. Compara el siguiente CV contra el perfil del puesto
y determina un porcentaje de match semántico (0-100).

PERFIL DEL PUESTO:
Misión: ${perfilCargo?.mision || "No especificada"}
Competencias duras (las marcadas EXCLUYENTE son obligatorias):
${durasTexto || "  (sin competencias duras registradas)"}
Competencias blandas esperadas:
${blandasTexto || "  (sin competencias blandas registradas)"}

CV DEL CANDIDATO:
${cvTexto}

Responde SOLO con JSON exacto, sin texto adicional:
{
  "match_pct": number,
  "razones": [{ "criterio": string, "cumple": boolean, "detalle": string }]
}

Si el CV no menciona explícitamente un requisito excluyente, márcalo como no cumplido — no asumas ni inventes experiencia que no esté escrita.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return extraerJson(textoDeMensaje(message)) as unknown as MatchCvResultado;
}

export interface CasoTecnico {
  caso_generado: string;
  criterios: { analisis: number; estrategia: number; kpis: number; claridad: number };
}

export async function generarCasoTecnico(tituloVacante: string, perfilCargo: PerfilCargoManual | null): Promise<CasoTecnico> {
  const durasTexto = (perfilCargo?.competencias_duras ?? [])
    .map((c) => `  - ${c.nombre}${c.excluyente ? " (excluyente)" : ""}`)
    .join("\n");

  const prompt = `Eres un diseñador de pruebas técnicas de selección. Genera UN caso práctico
para evaluar al cargo "${tituloVacante}".

MISIÓN DEL CARGO: ${perfilCargo?.mision || "No especificada"}
COMPETENCIAS DURAS DEL CARGO:
${durasTexto || "  (sin competencias duras registradas)"}

El caso debe:
- Ser un escenario realista de 1-2 párrafos que el candidato deba resolver por escrito
- Tener un nivel de dificultad adecuado al cargo (ni trivial ni un examen de certificación)
- Poder responderse en un máximo de 90 minutos

Responde SOLO con JSON exacto, sin texto adicional:
{
  "caso_generado": string,
  "criterios": { "analisis": 25, "estrategia": 30, "kpis": 25, "claridad": 20 }
}

Los 4 valores de "criterios" son los puntos máximos de cada rúbrica y deben sumar 100.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return extraerJson(textoDeMensaje(message)) as unknown as CasoTecnico;
}

export interface CorreccionTecnica {
  puntaje_analisis: number;
  puntaje_estrategia: number;
  puntaje_kpis: number;
  puntaje_claridad: number;
  justificacion: string;
}

export async function corregirCasoTecnico(
  casoGenerado: string,
  criterios: CasoTecnico["criterios"],
  respuestaCandidato: string
): Promise<CorreccionTecnica> {
  const prompt = `Eres un evaluador de pruebas técnicas de selección. Corrige la siguiente respuesta
contra el caso planteado y la rúbrica dada.

CASO:
${casoGenerado}

RÚBRICA (puntos máximos por criterio):
- Análisis: ${criterios.analisis}
- Estrategia: ${criterios.estrategia}
- KPIs: ${criterios.kpis}
- Claridad: ${criterios.claridad}

RESPUESTA DEL CANDIDATO:
${respuestaCandidato}

Responde SOLO con JSON exacto, sin texto adicional:
{
  "puntaje_analisis": number,
  "puntaje_estrategia": number,
  "puntaje_kpis": number,
  "puntaje_claridad": number,
  "justificacion": string
}

Cada puntaje no puede superar el máximo de su criterio. La justificación es un párrafo breve
explicando el porqué de los puntajes — el reclutador puede ajustar cualquier valor manualmente
después, así que sé objetivo y específico sobre qué faltó o sobró en la respuesta.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return extraerJson(textoDeMensaje(message)) as unknown as CorreccionTecnica;
}

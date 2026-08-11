import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { OpcionPregunta, PerfilCargoManual } from "./mindeval-types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface MatchCvResultado {
  match_pct: number;
  razones: { criterio: string; cumple: boolean; excluyente: boolean; detalle: string }[];
}

function extraerJson(texto: string): Record<string, unknown> {
  const jsonMatch = texto.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("La IA no devolvió un JSON válido");
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("La respuesta de la IA quedó incompleta (posiblemente por un CV muy extenso). Intenta de nuevo.");
  }
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
  "razones": [{ "criterio": string, "cumple": boolean, "excluyente": boolean, "detalle": string }]
}

"excluyente" debe ser true únicamente cuando el criterio corresponde a una competencia dura marcada EXCLUYENTE arriba; false para el resto (competencias blandas, competencias duras no excluyentes, u otros criterios generales).

Si el CV no menciona explícitamente un requisito excluyente, márcalo como no cumplido — no asumas ni inventes experiencia que no esté escrita.

"detalle" debe ser una frase breve de máximo 15 palabras — el perfil puede tener muchas competencias y cada razón debe ser corta para que la respuesta completa quepa en el presupuesto de salida.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
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

export interface PreguntaGenerada {
  enunciado: string;
  opciones: OpcionPregunta[];
  respuesta_correcta: string;
}

/**
 * Genera un banco de preguntas de opción múltiple (respuesta objetiva, sin
 * interpretación de IA al calificar) a partir del perfil del puesto. El
 * reclutador revisa/edita/borra estas preguntas antes de activarlas — ver
 * /seleccion/[vacanteId]/banco-preguntas.
 */
export async function generarBancoPreguntas(
  tituloVacante: string,
  perfilCargo: PerfilCargoManual | null,
  cantidad: number = 10
): Promise<{ preguntas: PreguntaGenerada[] }> {
  const durasTexto = (perfilCargo?.competencias_duras ?? [])
    .map((c) => `  - ${c.nombre}${c.excluyente ? " (EXCLUYENTE)" : ""}`)
    .join("\n");

  const prompt = `Eres un diseñador de exámenes técnicos de selección. Genera ${cantidad} preguntas de
opción múltiple para evaluar el conocimiento técnico del cargo "${tituloVacante}".

MISIÓN DEL CARGO: ${perfilCargo?.mision || "No especificada"}
COMPETENCIAS DURAS DEL CARGO:
${durasTexto || "  (sin competencias duras registradas)"}

Cada pregunta debe:
- Evaluar conocimiento técnico verificable (no opinión ni criterio subjetivo)
- Tener exactamente 4 opciones, con una única respuesta correcta
- Ser clara y breve — enunciado y opciones concisos, sin párrafos largos

Responde SOLO con JSON exacto, sin texto adicional, sin backticks de markdown:
{
  "preguntas": [
    {
      "enunciado": string,
      "opciones": [{ "id": "a", "texto": string }, { "id": "b", "texto": string }, { "id": "c", "texto": string }, { "id": "d", "texto": string }],
      "respuesta_correcta": "a" | "b" | "c" | "d"
    }
  ]
}

Genera exactamente ${cantidad} preguntas. Manten cada enunciado y cada opción cortos —
el banco completo debe caber en la respuesta sin cortarse.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 6144,
    messages: [{ role: "user", content: prompt }],
  });

  return extraerJson(textoDeMensaje(message)) as unknown as { preguntas: PreguntaGenerada[] };
}

export interface EjercicioGenerado {
  competencia: string;
  enunciado: string;
  criterios_evaluacion: string;
}

/**
 * Genera un banco de escenarios abiertos de Assessment Center a partir del
 * perfil del puesto — prioriza competencias_blandas (propósito real de esta
 * etapa; las duras ya se evalúan en la Etapa 4 técnica). El reclutador
 * revisa/edita/activa estos ejercicios antes de que lleguen a un candidato —
 * ver /seleccion/[vacanteId]/banco-ejercicios.
 */
export async function generarBancoEjercicios(
  tituloVacante: string,
  perfilCargo: PerfilCargoManual | null,
  cantidad: number = 5
): Promise<{ ejercicios: EjercicioGenerado[] }> {
  const blandasTexto = (perfilCargo?.competencias_blandas ?? [])
    .map((c) => `  - ${c.nombre} (nivel esperado ${c.nivel_esperado}/10)`)
    .join("\n");
  const durasTexto = (perfilCargo?.competencias_duras ?? [])
    .map((c) => `  - ${c.nombre}${c.excluyente ? " (EXCLUYENTE)" : ""}`)
    .join("\n");

  const prompt = `Eres un psicólogo organizacional experto en Assessment Center. Genera ${cantidad}
escenarios prácticos abiertos para evaluar competencias conductuales del cargo "${tituloVacante}".

MISIÓN DEL CARGO: ${perfilCargo?.mision || "No especificada"}
COMPETENCIAS BLANDAS DEL CARGO (prioriza estas — es el propósito de Assessment Center):
${blandasTexto || "  (sin competencias blandas registradas)"}
COMPETENCIAS DURAS DEL CARGO (contexto adicional, ya se evalúan en la prueba técnica):
${durasTexto || "  (sin competencias duras registradas)"}

Cada ejercicio debe:
- Plantear una situación realista del día a día del cargo que el candidato deba resolver por escrito
- Evaluar UNA competencia blanda específica del cargo (usa el nombre exacto de la lista de arriba cuando aplique)
- Ser breve — 2 a 4 frases, no un párrafo largo
- Traer una rúbrica breve de qué debe incluir una buena respuesta, para que otra IA la califique después

Responde SOLO con JSON exacto, sin texto adicional, sin backticks de markdown:
{
  "ejercicios": [
    {
      "competencia": string,
      "enunciado": string,
      "criterios_evaluacion": string
    }
  ]
}

Genera exactamente ${cantidad} ejercicios. Manten cada enunciado y cada rúbrica cortos —
el banco completo debe caber en la respuesta sin cortarse.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  return extraerJson(textoDeMensaje(message)) as unknown as { ejercicios: EjercicioGenerado[] };
}

export interface CorreccionEjercicio {
  puntaje: number;
  notas: string;
}

/**
 * Califica la respuesta de un candidato a UN ejercicio de Assessment Center
 * contra su rúbrica — mismo patrón que corregirCasoTecnico, pero puntaje
 * único 0-10 sobre una sola competencia en vez de una rúbrica de 4 criterios.
 */
export async function corregirEjercicioAssessment(
  enunciado: string,
  criteriosEvaluacion: string,
  respuestaCandidato: string
): Promise<CorreccionEjercicio> {
  const prompt = `Eres un psicólogo organizacional evaluando una prueba de Assessment Center.
Corrige la siguiente respuesta contra el escenario planteado y su rúbrica.

ESCENARIO:
${enunciado}

RÚBRICA (qué debe incluir una buena respuesta):
${criteriosEvaluacion}

RESPUESTA DEL CANDIDATO:
${respuestaCandidato}

Responde SOLO con JSON exacto, sin texto adicional:
{
  "puntaje": number,
  "notas": string
}

"puntaje" va de 0 a 10. "notas" es una justificación breve (1-2 frases) de por qué —
el reclutador puede ajustar el valor manualmente después, así que sé objetivo y específico.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return extraerJson(textoDeMensaje(message)) as unknown as CorreccionEjercicio;
}

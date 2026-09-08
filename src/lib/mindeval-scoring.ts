import type { SupabaseClient } from "@supabase/supabase-js";
import type { RespuestaBancoDetalle, SeveridadAlerta, Vacante } from "./mindeval-types";
import type { MatchCvResultado } from "./mindeval-ia";
import { ITEMS_16PF5, NORMAS_16PF5, type Escala16PF5 } from "./mindeval-16pf5";
import { ITEMS_KOSTICK, type FactorKostick } from "./mindeval-kostick";
import { ITEMS_DISC, PATRONES_DISC, TEXTOS_PATRON_DISC, type CategoriaTextoDISC } from "./mindeval-disc";
import { ITEMS_VALANTI, NORMAS_VALANTI, NIVELES_VALANTI, MENSAJE_AREA_MAS_IMPORTANTE, MENSAJE_AREA_MENOS_IMPORTANTE, type EscalaVALANTI } from "./mindeval-valanti";

export function categoriaSten(sten: number): string {
  if (sten >= 9) return "Muy alto";
  if (sten >= 7) return "Alto";
  if (sten >= 5) return "Medio";
  if (sten >= 3) return "Bajo";
  return "Muy bajo";
}

export function percentilDeSten(sten: number): number {
  return Math.round(((sten - 1) / 9) * 100);
}

/**
 * `ajustePsicometrico` ya viene en 0-100 y mide ajuste al perfil del puesto
 * (ver calcularAjustePsicometrico). Antes este parámetro era `stenPromedio`
 * —el promedio de los 17 decatipos del 16PF-5— que valía ~5.5 para
 * cualquier persona y por lo tanto aportaba un 55% fijo a todos los
 * candidatos: ocupaba un 25% del puntaje sin distinguir a nadie.
 */
export function calcularIdoneidadGlobal(input: {
  matchCv?: number;
  ajustePsicometrico?: number;
  tecnicaTotal?: number;
  assessmentPromedio?: number;
}): number | null {
  const pesos: Array<[number | undefined, number]> = [
    [input.matchCv, 0.3],
    [input.ajustePsicometrico, 0.25],
    [input.tecnicaTotal, 0.25],
    [input.assessmentPromedio !== undefined ? (input.assessmentPromedio / 10) * 100 : undefined, 0.2],
  ];
  const disponibles = pesos.filter(([v]) => v !== undefined) as Array<[number, number]>;
  if (!disponibles.length) return null;
  const pesoTotal = disponibles.reduce((s, [, p]) => s + p, 0);
  const suma = disponibles.reduce((s, [v, p]) => s + v * p, 0);
  return Math.round(suma / pesoTotal);
}

// ─── Ajuste al perfil psicométrico ──────────────────────────────────────────
//
// Por qué existe esto (auditoría 2026-09-08, con los resultados reales del
// primer proceso en la mano): el ranking promediaba los 17 decatipos del
// 16PF-5 y usaba ese número como "nivel psicométrico". Estaba mal por tres
// razones independientes, y las tres a la vez explican por qué TODOS los
// candidatos salían "Bajo":
//
//  1. El decatipo está normado con media 5.5 en CADA escala. Promediar 17
//     escalas de cualquier persona da siempre ~5.5: el número no puede
//     discriminar entre candidatos, por construcción.
//  2. Los factores del 16PF-5 son BIPOLARES, no "más es mejor". Vigilancia
//     (L) alta es desconfianza; Aprensión (O) alta es ansiedad; Tensión (Q4)
//     alta es irritabilidad. El promedio premiaba "desconfiado, ansioso y
//     tenso" exactamente igual que "cálido y estable".
//  3. Metía el IM (Índice de manipulación) como si fuera una competencia. El
//     IM es una escala de VALIDEZ: mide si respondió con sinceridad. Un IM
//     alto hace que el perfil sea MENOS confiable, no mejor candidato.
//
// La única forma correcta de convertir un perfil de personalidad en un
// puntaje de selección es contra un PERFIL OBJETIVO del puesto: qué factores
// importan y en qué dirección. Eso no se infiere del test, lo define quien
// conoce el cargo.

export type DireccionFactor = "alto" | "medio" | "bajo";

export type PerfilObjetivo16PF5 = Partial<Record<Escala16PF5, DireccionFactor>>;

/**
 * Perfil objetivo por defecto, derivado del cargo tipo "promotor/gestor
 * social de campo" (acompañamiento a familias, visitas domiciliarias,
 * talleres, gestión de fichas y expedientes, cumplimiento de políticas de
 * protección) y validado con la consultora responsable del proceso.
 *
 * Los factores que NO aparecen aquí no puntúan a propósito: no tienen una
 * dirección clara de "mejor" para este cargo, y puntuarlos sería inventar
 * criterio. Se siguen mostrando completos en la ficha del candidato, que es
 * donde el perfil se interpreta.
 *
 * B (Razonamiento) queda fuera deliberadamente: la escala de razonamiento del
 * 16PF-5 es muy breve y no es un test cognitivo — usarla para rankear sería
 * estirarla más de lo que aguanta.
 *
 * IM nunca entra aquí: es validez, no competencia (ver interpretarIM).
 */
export const PERFIL_16PF5_PROMOTOR_SOCIAL: PerfilObjetivo16PF5 = {
  A: "alto",    // Afabilidad — trabaja cara a cara con las familias
  C: "alto",    // Estabilidad emocional — sostiene situaciones duras
  G: "alto",    // Atención a las normas — políticas de protección, no negociable
  H: "medio",   // Atrevimiento — toca puertas, pero sin invadir
  I: "alto",    // Sensibilidad — empatía real con población vulnerable
  Q2: "alto",   // Autosuficiencia — trabaja solo en campo
  Q3: "alto",   // Perfeccionismo — fichas, expedientes, registros
  L: "bajo",    // Vigilancia — la desconfianza rompe el vínculo
  O: "bajo",    // Aprensión — la ansiedad alta desgasta y rota
  Q4: "bajo",   // Tensión — el puesto ya trae carga emocional propia
};

/**
 * Qué tan cerca está un decatipo (1-10) del polo deseado, en 0-100.
 * "medio" penaliza la desviación en AMBAS direcciones desde el centro (5.5).
 */
export function ajusteFactor(decatipo: number, direccion: DireccionFactor): number {
  const d = Math.max(1, Math.min(10, decatipo));
  if (direccion === "alto") return ((d - 1) / 9) * 100;
  if (direccion === "bajo") return ((10 - d) / 9) * 100;
  return Math.max(0, 1 - Math.abs(d - 5.5) / 4.5) * 100;
}

export interface DetalleAjusteFactor {
  escala: Escala16PF5;
  decatipo: number;
  direccion: DireccionFactor;
  ajuste: number;
}

/**
 * Ajuste del candidato al perfil objetivo del puesto, en 0-100. `undefined`
 * si no rindió el 16PF-5 o si ninguno de los factores del perfil llegó.
 */
export function calcularAjuste16PF5(
  filas: { bateria: string; sten: number | null }[],
  perfil: PerfilObjetivo16PF5 = PERFIL_16PF5_PROMOTOR_SOCIAL
): { ajuste: number | undefined; detalle: DetalleAjusteFactor[] } {
  const detalle: DetalleAjusteFactor[] = [];
  for (const fila of filas) {
    if (!fila.bateria.startsWith("16pf5_") || fila.sten === null) continue;
    const escala = fila.bateria.replace("16pf5_", "") as Escala16PF5;
    const direccion = perfil[escala];
    if (!direccion) continue;
    detalle.push({ escala, decatipo: fila.sten, direccion, ajuste: ajusteFactor(fila.sten, direccion) });
  }
  if (!detalle.length) return { ajuste: undefined, detalle };
  return { ajuste: detalle.reduce((s, d) => s + d.ajuste, 0) / detalle.length, detalle };
}

/**
 * Ajuste al estándar organizacional de VALANTI, en 0-100.
 *
 * VALANTI es IPSATIVO (el candidato reparte 3 puntos entre dos frases, el
 * total está fijo), así que nadie puede salir alto en los cinco valores:
 * subir en uno obliga a bajar en otro. Por eso no se mide "qué tan alto
 * puntuó" sino qué tan parecida es la FORMA de su perfil a la que la
 * organización busca — la desviación media absoluta contra el estándar que
 * el propio instrumento define para cada valor.
 *
 * 0 puntos de desviación = 100. La escala se satura a 20 puntos de
 * desviación media (2 desviaciones típicas), donde el ajuste llega a 0.
 */
const DESVIACION_MAXIMA_VALANTI = 20;

export function calcularAjusteVALANTI(
  filas: { bateria: string; puntaje_estandar?: number | null }[]
): { ajuste: number | undefined; desviacionMedia: number | undefined } {
  const desviaciones: number[] = [];
  for (const fila of filas) {
    if (!fila.bateria.startsWith("valanti_") || fila.puntaje_estandar === null || fila.puntaje_estandar === undefined) continue;
    const escala = fila.bateria.replace("valanti_", "") as EscalaVALANTI;
    const norma = NORMAS_VALANTI[escala];
    if (!norma) continue;
    desviaciones.push(Math.abs(fila.puntaje_estandar - norma.estandarOrganizacional));
  }
  if (!desviaciones.length) return { ajuste: undefined, desviacionMedia: undefined };
  const desviacionMedia = desviaciones.reduce((s, d) => s + d, 0) / desviaciones.length;
  const ajuste = Math.max(0, 1 - desviacionMedia / DESVIACION_MAXIMA_VALANTI) * 100;
  return { ajuste, desviacionMedia };
}

/**
 * El número psicométrico que entra al % de idoneidad: el promedio de los
 * ajustes disponibles. Si el candidato rindió las dos baterías pesan igual;
 * si rindió una sola, esa manda. `undefined` si no hay ninguna.
 */
export function calcularAjustePsicometrico(input: { ajuste16pf5?: number; ajusteValanti?: number }): number | undefined {
  const partes = [input.ajuste16pf5, input.ajusteValanti].filter((v): v is number => v !== undefined);
  if (!partes.length) return undefined;
  return partes.reduce((s, v) => s + v, 0) / partes.length;
}

/**
 * El IM no puntúa: avisa. Un decatipo alto significa que el candidato
 * respondió buscando dar buena imagen, así que TODO su perfil debe leerse
 * con cautela — no que sea peor candidato.
 */
export function interpretarIM(decatipo: number | null | undefined): { nivel: "ok" | "revisar" | "alerta"; mensaje: string } | null {
  if (decatipo === null || decatipo === undefined) return null;
  if (decatipo >= 8) {
    return {
      nivel: "alerta",
      mensaje: "Índice de manipulación alto: respondió buscando dar una buena imagen. Interpreta todo su perfil con cautela y contrástalo en la entrevista.",
    };
  }
  if (decatipo >= 7) {
    return {
      nivel: "revisar",
      mensaje: "Índice de manipulación algo elevado: puede haber respondido pensando en lo que se espera de él. Contrasta los rasgos clave en la entrevista.",
    };
  }
  return { nivel: "ok", mensaje: "Índice de manipulación dentro de lo esperado: el perfil se puede interpretar con normalidad." };
}

const PENALIZACION: Record<SeveridadAlerta, number> = { bajo: 0, medio: 5, alto: 15, critico: 30 };

export function calcularIndiceIntegridad(alertas: { severidad: SeveridadAlerta }[]): number {
  const total = alertas.reduce((s, a) => s + PENALIZACION[a.severidad], 0);
  return Math.max(0, 100 - total);
}

export function promedio(nums: number[]): number | undefined {
  if (!nums.length) return undefined;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export interface FilaCompletitudPsicometrica {
  items_respondidos?: number | null;
  items_esperados?: number | null;
}

/**
 * Una prueba psicométrica está incompleta cuando el candidato respondió
 * menos ítems de los que tenía la batería — típicamente porque se le acabó
 * el tiempo y el portal envió lo que había. Su decatipo se calculó sobre un
 * puntaje bruto parcial, así que NO es interpretable ni comparable contra el
 * corte de la vacante: se conserva como evidencia de que rindió, pero queda
 * fuera de todo cálculo agregado (ver mindeval-psicometricas-completitud.sql).
 *
 * Filas anteriores a esa migración tienen ambas columnas en NULL: se tratan
 * como completas, para no invalidar retroactivamente procesos ya cerrados.
 */
export function psicometricaIncompleta(fila: FilaCompletitudPsicometrica): boolean {
  const { items_respondidos: respondidos, items_esperados: esperados } = fila;
  if (respondidos === null || respondidos === undefined) return false;
  if (esperados === null || esperados === undefined) return false;
  return respondidos < esperados;
}

/**
 * Descarte automático de CV: por debajo del corte definido en la vacante, o
 * por incumplir una competencia dura marcada como excluyente en el Manual
 * de Puestos — lo mismo que hoy se revisa a ojo, pero aplicado apenas llega
 * el % de match, sin esperar a que el reclutador revise candidato por
 * candidato.
 */
export function evaluarDescarteCv(
  resultado: MatchCvResultado,
  corteMatchCv: number
): { descartar: boolean; motivo?: string } {
  const faltante = resultado.razones?.find((r) => r.excluyente && !r.cumple);
  if (faltante) {
    return { descartar: true, motivo: `No cumple requisito excluyente: ${faltante.criterio}` };
  }
  if (resultado.match_pct < corteMatchCv) {
    return { descartar: true, motivo: `Match de CV ${resultado.match_pct}% por debajo del corte de ${corteMatchCv}%` };
  }
  return { descartar: false };
}

/**
 * Avance automático a Verificación SENESCYT: mismo criterio que
 * evaluarDescarteCv pero en sentido inverso (avanzar en vez de descartar).
 * El corte ya lo definió el reclutador al crear la vacante — esto no es una
 * IA decidiendo, es aplicar ese corte apenas existen ambos puntajes en vez
 * de esperar a que el reclutador revise candidato por candidato.
 */
/**
 * `corte_sten` se guarda en 0-10 por historia (era un corte sobre el promedio
 * de decatipos, que ya no existe). De cara al usuario SIEMPRE se muestra y se
 * edita como un porcentaje de ajuste al perfil — de ahí el ×10. Se conserva la
 * columna tal cual para no migrar cortes en medio de un proceso en curso: un
 * corte de 6 sigue significando lo mismo que significaba, "60 sobre 100".
 */
export function corteAjustePorcentaje(corteSten: number): number {
  return corteSten * 10;
}

export function apruebaPsicometricaYTecnica(
  ajustePsicometrico: number | undefined,
  tecnicaTotal: number | undefined,
  corteSten: number,
  corteTecnica: number
): boolean {
  return (
    ajustePsicometrico !== undefined &&
    tecnicaTotal !== undefined &&
    ajustePsicometrico >= corteAjustePorcentaje(corteSten) &&
    tecnicaTotal >= corteTecnica
  );
}

/**
 * Revisa si un candidato ya reúne ambos puntajes por encima del corte de su
 * vacante y, si sigue en psicométricas o técnica (no descartado ni ya
 * avanzado), lo mueve a verificacion_titulo. Se llama después de guardar
 * cualquiera de los dos puntajes — psicométrica o técnica puede ser la que
 * complete el par, sin importar el orden. La consulta en SENESCYT en sí
 * sigue siendo 100% manual (ver /candidato/[id]/verificacion): esto solo
 * evita que el reclutador tenga que mover la etapa candidato por candidato.
 *
 * Funciona tanto con el cliente anon autenticado como con supabaseAdmin —
 * misma API de SupabaseClient (mismo patrón que resolverPerfilCargo).
 */
export async function avanzarASenescytSiAplica(
  db: SupabaseClient,
  candidatoId: string,
  vacante: Pick<Vacante, "corte_sten" | "corte_tecnica">
): Promise<boolean> {
  const { data: candidato } = await db
    .from("mindeval_candidatos")
    .select("etapa_actual, estado")
    .eq("id", candidatoId)
    .single();
  if (!candidato || candidato.estado !== "activo") return false;
  if (candidato.etapa_actual !== "psicometricas" && candidato.etapa_actual !== "tecnica") return false;

  const [{ data: psico }, { data: tecnica }] = await Promise.all([
    db.from("mindeval_pruebas_psicometricas").select("bateria, sten, puntaje_estandar, items_respondidos, items_esperados").eq("candidato_id", candidatoId),
    db.from("mindeval_pruebas_tecnicas").select("puntaje_total").eq("candidato_id", candidatoId).order("created_at", { ascending: false }).limit(1),
  ]);

  // Una prueba incompleta (enviada por tiempo agotado) queda fuera: sus
  // decatipos se calcularon sobre puntajes brutos parciales y no son
  // interpretables. Sin baterías válidas el ajuste queda undefined y el
  // candidato no avanza solo, que es exactamente lo que debe pasar — lo
  // decide el reclutador a mano.
  const filasPsico = ((psico ?? []) as (FilaCompletitudPsicometrica & {
    bateria: string;
    sten: number | null;
    puntaje_estandar?: number | null;
  })[]).filter((p) => !psicometricaIncompleta(p));

  const ajustePsicometrico = calcularAjustePsicometrico({
    ajuste16pf5: calcularAjuste16PF5(filasPsico).ajuste,
    ajusteValanti: calcularAjusteVALANTI(filasPsico).ajuste,
  });
  const tecnicaTotal = (tecnica?.[0] as { puntaje_total: number | null } | undefined)?.puntaje_total ?? undefined;

  if (!apruebaPsicometricaYTecnica(ajustePsicometrico, tecnicaTotal, vacante.corte_sten, vacante.corte_tecnica)) return false;

  await db.from("mindeval_candidatos").update({ etapa_actual: "verificacion_titulo" }).eq("id", candidatoId);
  return true;
}

/**
 * Calificación 100% objetiva del banco de preguntas técnicas: compara cada
 * respuesta elegida contra la respuesta correcta guardada en el snapshot de
 * la prueba (sin ninguna interpretación de IA) y normaliza a 0-100 para que
 * se compare igual que cualquier otro puntaje técnico contra corte_tecnica.
 */
export function calificarBanco(
  preguntas: { id: string; respuesta_correcta: string; puntos: number }[],
  respuestas: { pregunta_id: string; opcion_elegida: string }[]
): { detalle: RespuestaBancoDetalle[]; puntaje_objetivo: number } {
  const respuestaPorPregunta = new Map(respuestas.map((r) => [r.pregunta_id, r.opcion_elegida]));

  const detalle: RespuestaBancoDetalle[] = preguntas.map((p) => {
    const opcion_elegida = respuestaPorPregunta.get(p.id) ?? "";
    const correcta = opcion_elegida === p.respuesta_correcta;
    return {
      pregunta_id: p.id,
      opcion_elegida,
      respuesta_correcta: p.respuesta_correcta,
      correcta,
      puntos_obtenidos: correcta ? p.puntos : 0,
    };
  });

  const puntosTotales = preguntas.reduce((s, p) => s + p.puntos, 0);
  const puntosObtenidos = detalle.reduce((s, d) => s + d.puntos_obtenidos, 0);
  const puntaje_objetivo = puntosTotales > 0 ? Math.round((puntosObtenidos / puntosTotales) * 100) : 0;

  return { detalle, puntaje_objetivo };
}

// ─── 16PF-5 (banco real) ──────────────────────────────────────────────────

export interface RespuestaItem16PF5 {
  num: number;
  letra: "a" | "b" | "c";
}

export interface PuntajeEscala16PF5 {
  escala: Escala16PF5;
  puntoBruto: number;
  decatipo: number | null;
  percentil: number | null;
}

function buscarEnNorma(pares: [number, number][], bruto: number): number | null {
  const exacto = pares.find(([raw]) => raw === bruto);
  if (exacto) return exacto[1];
  // el bruto puede superar el máximo de la tabla (fuera de rango real) — se
  // recorta al extremo más cercano en vez de devolver null, mismo criterio
  // que un baremo impreso (todo lo que se sale de la tabla va al último tramo).
  if (!pares.length) return null;
  const max = pares[pares.length - 1];
  const min = pares[0];
  if (bruto > max[0]) return max[1];
  if (bruto < min[0]) return min[1];
  return null;
}

/**
 * Convierte las respuestas crudas del 16PF-5 (185 ítems, letra elegida por
 * ítem) en puntaje bruto + decatipo + percentil por escala, usando el
 * baremo real extraído del Excel fuente (mindeval-16pf5.ts). El sexo es
 * obligatorio porque el baremo está separado por género. No calcula los 5
 * factores globales (EX, AX, TM, IN, SC) — ver nota en mindeval-16pf5.ts.
 */
export function calificar16PF5(respuestas: RespuestaItem16PF5[], sexo: "H" | "F"): PuntajeEscala16PF5[] {
  const letraPorItem = new Map(respuestas.map((r) => [r.num, r.letra]));
  const brutoPorEscala = new Map<Escala16PF5, number>();

  for (const item of ITEMS_16PF5) {
    const letra = letraPorItem.get(item.num);
    if (!letra) continue;
    const opcion = item.opciones.find((o) => o.letra === letra);
    if (!opcion) continue;
    brutoPorEscala.set(item.escala, (brutoPorEscala.get(item.escala) ?? 0) + opcion.peso);
  }

  return Array.from(brutoPorEscala.entries()).map(([escala, puntoBruto]) => {
    const norma = NORMAS_16PF5[escala];
    const decatipo = norma ? buscarEnNorma(norma[sexo], puntoBruto) : null;
    const normaPercentil = NORMAS_16PF5.PERCENTIL;
    const percentil = normaPercentil ? buscarEnNorma(normaPercentil[sexo], puntoBruto) : null;
    return { escala, puntoBruto, decatipo, percentil };
  });
}

// ─── KOSTICK (banco real) ──────────────────────────────────────────────────

export interface RespuestaItemKostick {
  num: number;
  eleccion: "a" | "b";
}

export interface PuntajeFactorKostick {
  factor: FactorKostick;
  conteo: number;
}

/**
 * Cuenta, por cada uno de los 20 factores del KOSTICK, cuántas veces salió
 * elegido a lo largo de los 90 pares (calificación ipsativa: cada ítem suma
 * 1 punto al factor de la opción elegida). No hay conversión a decatipo —
 * ver nota en mindeval-kostick.ts sobre por qué no se implementó.
 */
export function calificarKostick(respuestas: RespuestaItemKostick[]): PuntajeFactorKostick[] {
  const eleccionPorItem = new Map(respuestas.map((r) => [r.num, r.eleccion]));
  const conteoPorFactor = new Map<FactorKostick, number>();

  for (const item of ITEMS_KOSTICK) {
    const eleccion = eleccionPorItem.get(item.num);
    if (!eleccion) continue;
    const factor = eleccion === "a" ? item.factorA : item.factorB;
    conteoPorFactor.set(factor, (conteoPorFactor.get(factor) ?? 0) + 1);
  }

  return Array.from(conteoPorFactor.entries()).map(([factor, conteo]) => ({ factor, conteo }));
}

// ─── DISC (banco real) ──────────────────────────────────────────────────────

export interface RespuestaItemDISC {
  num: number;
  mas: 1 | 2 | 3 | 4;
  menos: 1 | 2 | 3 | 4;
}

export interface PuntajeRasgoDISC {
  rasgo: "D" | "I" | "S" | "C";
  puntoBruto: number;
  segmento: number;
}

export interface ResultadoDISC {
  puntajes: PuntajeRasgoDISC[];
  codigoSegmento: string;
  patron: string;
  textos: Record<CategoriaTextoDISC, string> | null;
}

// umbrales reales de segmento (1-7), transcritos literalmente de las fórmulas
// Q36/R36/S36/T36 de la hoja de evaluación del Excel fuente — no reordenar ni
// "simplificar" los rangos, cada IF replica exactamente el original.
function segmentoD(x: number): number {
  if (x < -7) return 1;
  if (x < -3 && x > -8) return 2;
  if (x < 0 && x > -4) return 3;
  if (x < 2 && x > -1) return 4;
  if (x > 1 && x < 5) return 5;
  if (x > 4 && x < 9) return 6;
  return 7;
}
function segmentoI(x: number): number {
  if (x < -7) return 1;
  if (x < -3 && x > -8) return 2;
  if (x < -1 && x > -4) return 3;
  if (x < 2 && x > -2) return 4;
  if (x > 1 && x < 4) return 5;
  if (x > 3 && x < 7) return 6;
  return 7;
}
function segmentoS(x: number): number {
  if (x < -10) return 1;
  if (x < -6 && x > -11) return 2;
  if (x < -3 && x > -7) return 3;
  if (x < 0 && x > -4) return 4;
  if (x > -1 && x < 3) return 5;
  if (x > 2 && x < 8) return 6;
  return 7;
}
function segmentoC(x: number): number {
  if (x < -5) return 1;
  if (x < -2 && x > -6) return 2;
  if (x < 0 && x > -3) return 3;
  if (x < 3 && x > -1) return 4;
  if (x > 2 && x < 5) return 5;
  if (x > 4 && x < 9) return 6;
  return 7;
}

/**
 * Convierte las 28 elecciones "más/menos" del DISC en puntaje bruto + segmento
 * (1-7) por rasgo D/I/S/C, usando el rasgo real de cada palabra (rasgoMas al
 * elegirla como más, rasgoMenos al elegirla como menos — casi siempre el
 * mismo, con 2 excepciones reales del Excel, ver mindeval-disc.ts). Clasifica
 * la combinación de los 4 segmentos contra la tabla real de 2401 patrones
 * para obtener el nombre del patrón y, si es uno de los 15 con nombre, su
 * banco de texto interpretativo.
 */
export function calificarDISC(respuestas: RespuestaItemDISC[]): ResultadoDISC {
  const porItem = new Map(respuestas.map((r) => [r.num, r]));
  const bruto: Record<"D" | "I" | "S" | "C", number> = { D: 0, I: 0, S: 0, C: 0 };

  for (const item of ITEMS_DISC) {
    const resp = porItem.get(item.num);
    if (!resp) continue;
    const palabraMas = item.palabras[resp.mas - 1];
    const palabraMenos = item.palabras[resp.menos - 1];
    if (palabraMas && palabraMas.rasgoMas !== "N") bruto[palabraMas.rasgoMas] += 1;
    if (palabraMenos && palabraMenos.rasgoMenos !== "N") bruto[palabraMenos.rasgoMenos] -= 1;
  }

  const segD = segmentoD(bruto.D);
  const segI = segmentoI(bruto.I);
  const segS = segmentoS(bruto.S);
  const segC = segmentoC(bruto.C);
  const codigoSegmento = `${segD}${segI}${segS}${segC}`;
  const patron = PATRONES_DISC[codigoSegmento] ?? "";
  const textos = TEXTOS_PATRON_DISC[patron] ?? null;

  return {
    puntajes: [
      { rasgo: "D", puntoBruto: bruto.D, segmento: segD },
      { rasgo: "I", puntoBruto: bruto.I, segmento: segI },
      { rasgo: "S", puntoBruto: bruto.S, segmento: segS },
      { rasgo: "C", puntoBruto: bruto.C, segmento: segC },
    ],
    codigoSegmento,
    patron,
    textos,
  };
}

// ─── VALANTI (banco real) ────────────────────────────────────────────────

export interface RespuestaItemVALANTI {
  num: number;
  puntosFraseA: 0 | 1 | 2 | 3; // puntosFraseB siempre es 3 - puntosFraseA (regla del cuestionario original)
}

export interface PuntajeEscalaVALANTI {
  escala: EscalaVALANTI;
  puntoBruto: number;
  puntajeEstandar: number;
  nivel: string;
  distanciaOrganizacion: number;
}

export interface ResultadoVALANTI {
  puntajes: PuntajeEscalaVALANTI[];
  areaMasImportante: string;
  areaMenosImportante: string;
}

function nivelPuntajeEstandar(x: number): { etiqueta: string } {
  let actual = NIVELES_VALANTI[0];
  for (const nivel of NIVELES_VALANTI) {
    if (x >= nivel.minimo) actual = nivel;
    else break;
  }
  return actual;
}

/**
 * Convierte las 30 respuestas del VALANTI (puntos 0-3 asignados a la fraseA
 * de cada ítem — la fraseB recibe siempre el complemento 3-x) en puntaje
 * bruto + puntaje estándar (tipo T, media 50/DE 10, NO decatipo) por cada una
 * de las 5 escalas, usando el baremo real "Normas nacionales" del Excel
 * fuente (mindeval-valanti.ts — ver esa nota sobre el bug de fórmula
 * corregido con confirmación del usuario). Cada ítem suma su fraseA a
 * escalaFraseA y su fraseB (3-fraseA) a escalaFraseB.
 */
export function calificarVALANTI(respuestas: RespuestaItemVALANTI[], nombreCandidato: string): ResultadoVALANTI {
  const porItem = new Map(respuestas.map((r) => [r.num, r.puntosFraseA]));
  const bruto: Record<EscalaVALANTI, number> = { verdad: 0, rectitud: 0, paz: 0, amor: 0, no_violencia: 0 };

  for (const item of ITEMS_VALANTI) {
    const a = porItem.get(item.num);
    if (a === undefined) continue;
    const b = 3 - a;
    bruto[item.escalaFraseA] += a;
    bruto[item.escalaFraseB] += b;
  }

  const puntajes: PuntajeEscalaVALANTI[] = (Object.keys(bruto) as EscalaVALANTI[]).map((escala) => {
    const { media, desviacion, estandarOrganizacional } = NORMAS_VALANTI[escala];
    const puntoBruto = bruto[escala];
    const puntajeEstandar = Math.round(((puntoBruto - media) / desviacion) * 10 + 50);
    return {
      escala,
      puntoBruto,
      puntajeEstandar,
      nivel: nivelPuntajeEstandar(puntajeEstandar).etiqueta,
      distanciaOrganizacion: puntajeEstandar - estandarOrganizacional,
    };
  });

  const maxEscala = puntajes.reduce((a, b) => (b.puntajeEstandar > a.puntajeEstandar ? b : a));
  const minEscala = puntajes.reduce((a, b) => (b.puntajeEstandar < a.puntajeEstandar ? b : a));

  return {
    puntajes,
    areaMasImportante: MENSAJE_AREA_MAS_IMPORTANTE[maxEscala.escala](nombreCandidato),
    areaMenosImportante: MENSAJE_AREA_MENOS_IMPORTANTE[minEscala.escala],
  };
}

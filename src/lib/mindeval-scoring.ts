import type { SupabaseClient } from "@supabase/supabase-js";
import type { RespuestaBancoDetalle, SeveridadAlerta, Vacante } from "./mindeval-types";
import type { MatchCvResultado } from "./mindeval-ia";
import { ITEMS_16PF5, NORMAS_16PF5, type Escala16PF5 } from "./mindeval-16pf5";
import { ITEMS_KOSTICK, type FactorKostick } from "./mindeval-kostick";
import { ITEMS_DISC, PATRONES_DISC, TEXTOS_PATRON_DISC, type CategoriaTextoDISC } from "./mindeval-disc";

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

export function calcularIdoneidadGlobal(input: {
  matchCv?: number;
  stenPromedio?: number;
  tecnicaTotal?: number;
  assessmentPromedio?: number;
}): number | null {
  const pesos: Array<[number | undefined, number]> = [
    [input.matchCv, 0.3],
    [input.stenPromedio !== undefined ? (input.stenPromedio / 10) * 100 : undefined, 0.25],
    [input.tecnicaTotal, 0.25],
    [input.assessmentPromedio !== undefined ? (input.assessmentPromedio / 10) * 100 : undefined, 0.2],
  ];
  const disponibles = pesos.filter(([v]) => v !== undefined) as Array<[number, number]>;
  if (!disponibles.length) return null;
  const pesoTotal = disponibles.reduce((s, [, p]) => s + p, 0);
  const suma = disponibles.reduce((s, [v, p]) => s + v * p, 0);
  return Math.round(suma / pesoTotal);
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
export function apruebaPsicometricaYTecnica(
  stenPromedio: number | undefined,
  tecnicaTotal: number | undefined,
  corteSten: number,
  corteTecnica: number
): boolean {
  return stenPromedio !== undefined && tecnicaTotal !== undefined && stenPromedio >= corteSten && tecnicaTotal >= corteTecnica;
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
    db.from("mindeval_pruebas_psicometricas").select("bateria, sten").eq("candidato_id", candidatoId),
    db.from("mindeval_pruebas_tecnicas").select("puntaje_total").eq("candidato_id", candidatoId).order("created_at", { ascending: false }).limit(1),
  ]);

  // el conteo ipsativo de KOSTICK (0-9) y el segmento de DISC (1-7) no son un
  // STEN normado, se excluyen del promedio.
  const stenPromedio = promedio(
    ((psico ?? []) as { bateria: string; sten: number | null }[])
      .filter((p) => !p.bateria.startsWith("kostick_") && !p.bateria.startsWith("disc_"))
      .map((p) => p.sten)
      .filter((s): s is number => s !== null)
  );
  const tecnicaTotal = (tecnica?.[0] as { puntaje_total: number | null } | undefined)?.puntaje_total ?? undefined;

  if (!apruebaPsicometricaYTecnica(stenPromedio, tecnicaTotal, vacante.corte_sten, vacante.corte_tecnica)) return false;

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

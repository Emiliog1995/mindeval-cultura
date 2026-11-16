/**
 * Test vocacional de Holland (RIASEC), versión de 30 ítems Sí/No entregada
 * por USECIPOL ("Test de Holland (RIASEC).xlsx"). 5 ítems por área.
 *
 * Calificación (tal como la define el documento):
 *  - Puntaje por área = número de "Sí" (0 a 5).
 *  - Las tres áreas más altas forman el código vocacional (ej. "SIA").
 *  - 4-5 interés alto · 2-3 moderado · 0-1 bajo.
 *
 * Dos decisiones propias, porque el documento no las cubre:
 *  - Corrección: la fórmula del Excel para Realista sumaba solo 4 ítems
 *    (F4:F7). Aquí suman los 5, igual que las demás áreas.
 *  - Empates: se desempata en el orden R-I-A-S-E-C y se marca `empate` para
 *    que quien revise sepa que el tercer lugar no es único.
 */

export type AreaHolland = "R" | "I" | "A" | "S" | "E" | "C";
export const ORDEN_HOLLAND: AreaHolland[] = ["R", "I", "A", "S", "E", "C"];

export const NOMBRES_AREA_HOLLAND: Record<AreaHolland, string> = {
  R: "Realista",
  I: "Investigadora",
  A: "Artística",
  S: "Social",
  E: "Emprendedora",
  C: "Convencional",
};

export interface ItemHolland {
  num: number;
  area: AreaHolland;
  texto: string;
}

export const ITEMS_HOLLAND: ItemHolland[] = [
  { num: 1, area: "R", texto: "Me gusta reparar objetos o aparatos." },
  { num: 2, area: "R", texto: "Disfruto trabajar con herramientas." },
  { num: 3, area: "R", texto: "Me gusta realizar actividades al aire libre." },
  { num: 4, area: "R", texto: "Prefiero tareas prácticas antes que teóricas." },
  { num: 5, area: "R", texto: "Me interesa la mecánica o la construcción." },
  { num: 6, area: "I", texto: "Me gusta resolver problemas complejos." },
  { num: 7, area: "I", texto: "Disfruto investigar temas nuevos." },
  { num: 8, area: "I", texto: "Me interesa la ciencia y la tecnología." },
  { num: 9, area: "I", texto: "Me gusta analizar información detalladamente." },
  { num: 10, area: "I", texto: "Disfruto realizar experimentos o estudios." },
  { num: 11, area: "A", texto: "Me gusta dibujar, pintar o diseñar." },
  { num: 12, area: "A", texto: "Disfruto escribir historias o poemas." },
  { num: 13, area: "A", texto: "Me considero una persona creativa." },
  { num: 14, area: "A", texto: "Me gusta expresarme mediante el arte." },
  { num: 15, area: "A", texto: "Prefiero actividades con libertad de expresión." },
  { num: 16, area: "S", texto: "Me gusta ayudar a otras personas." },
  { num: 17, area: "S", texto: "Disfruto enseñar o explicar temas." },
  { num: 18, area: "S", texto: "Me interesa comprender los sentimientos de los demás." },
  { num: 19, area: "S", texto: "Prefiero trabajar en equipo." },
  { num: 20, area: "S", texto: "Me agrada participar en actividades de servicio comunitario." },
  { num: 21, area: "E", texto: "Me gusta liderar grupos." },
  { num: 22, area: "E", texto: "Disfruto convencer a otras personas de mis ideas." },
  { num: 23, area: "E", texto: "Me interesa crear negocios o proyectos." },
  { num: 24, area: "E", texto: "Me siento cómodo tomando decisiones importantes." },
  { num: 25, area: "E", texto: "Me gusta asumir retos y riesgos." },
  { num: 26, area: "C", texto: "Me gusta organizar documentos o información." },
  { num: 27, area: "C", texto: "Prefiero seguir procedimientos establecidos." },
  { num: 28, area: "C", texto: "Me considero una persona ordenada." },
  { num: 29, area: "C", texto: "Disfruto trabajar con números y registros." },
  { num: 30, area: "C", texto: "Me gusta planificar y controlar actividades." },
];

/** Los 4 códigos con carreras que trae el documento, con su texto exacto. */
export const CARRERAS_CODIGO: Record<string, string> = {
  SIA: "Psicología, Educación, Trabajo Social.",
  ISA: "Psicología Clínica, Investigación, Neurociencias.",
  ERI: "Administración, Derecho, Negocios.",
  RIA: "Ingenierías, Arquitectura, Diseño Técnico.",
};

/** Campos típicos por área (descripción estándar de Holland), para los códigos que el documento no lista. */
export const CAMPOS_AREA: Record<AreaHolland, string> = {
  R: "trabajo técnico, mecánica y construcción",
  I: "ciencia, investigación y análisis",
  A: "arte, diseño y comunicación",
  S: "educación, psicología y servicio a las personas",
  E: "liderazgo, administración y negocios",
  C: "organización, registros y procedimientos",
};

export function nivelHolland(puntaje: number): "Alto" | "Moderado" | "Bajo" {
  return puntaje >= 4 ? "Alto" : puntaje >= 2 ? "Moderado" : "Bajo";
}

export interface ResultadoHolland {
  puntajes: { area: AreaHolland; puntaje: number; nivel: "Alto" | "Moderado" | "Bajo" }[];
  codigo: string;
  empate: boolean;
}

export function calificarHolland(respuestas: { num: number; si: boolean }[]): ResultadoHolland {
  const cuenta: Record<AreaHolland, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  const vistos = new Set<number>();
  for (const r of respuestas) {
    if (vistos.has(r.num)) continue;
    vistos.add(r.num);
    const item = ITEMS_HOLLAND.find((i) => i.num === r.num);
    if (item && r.si === true) cuenta[item.area] += 1;
  }
  const ordenadas = [...ORDEN_HOLLAND].sort((a, b) => cuenta[b] - cuenta[a] || ORDEN_HOLLAND.indexOf(a) - ORDEN_HOLLAND.indexOf(b));
  return {
    puntajes: ORDEN_HOLLAND.map((area) => ({ area, puntaje: cuenta[area], nivel: nivelHolland(cuenta[area]) })),
    codigo: ordenadas.slice(0, 3).join(""),
    empate: cuenta[ordenadas[2]] === cuenta[ordenadas[3]],
  };
}

/** Observación en el formato del informe de USECIPOL. */
export function observacionHolland(codigo: string, perfil: "estudiante" | "docente" | null): string {
  const sujeto = perfil === "docente" ? "EL DOCENTE" : perfil === "estudiante" ? "EL ESTUDIANTE" : "EL EVALUADO";
  const exacto = CARRERAS_CODIGO[codigo];
  if (exacto) return `${sujeto} CUENTA CON UN PERFIL EN ${exacto}`;
  const areas = codigo.split("").filter((c): c is AreaHolland => ORDEN_HOLLAND.includes(c as AreaHolland));
  const partes = areas.map((a) => `${NOMBRES_AREA_HOLLAND[a]} (${CAMPOS_AREA[a]})`);
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}` : partes[0] ?? "";
  return `${sujeto} CUENTA CON UN PERFIL EN las áreas ${lista}.`;
}

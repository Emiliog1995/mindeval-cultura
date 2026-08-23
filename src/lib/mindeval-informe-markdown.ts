/**
 * Parser ligero para el subconjunto de Markdown que usa el prompt de
 * /api/mindeval-informe-ejecutivo (encabezados con # y ##, negritas con
 * **texto**, separadores de sección con ---, bullets con "- "). No es un
 * parser de Markdown genérico -- cubre exactamente lo que ese prompt puede
 * producir, para poder renderizarlo de verdad tanto en pantalla (React)
 * como en el PDF exportado (jsPDF, que no entiende Markdown por sí solo).
 */

export interface SegmentoTexto {
  texto: string;
  negrita: boolean;
}

export type BloqueInforme =
  | { tipo: "h1" | "h2"; segmentos: SegmentoTexto[] }
  | { tipo: "p" | "bullet"; segmentos: SegmentoTexto[] }
  | { tipo: "hr" };

function partirNegritas(texto: string): SegmentoTexto[] {
  return texto
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((p) => p.length > 0)
    .map((p) => (p.startsWith("**") && p.endsWith("**") ? { texto: p.slice(2, -2), negrita: true } : { texto: p, negrita: false }));
}

export function parseInformeMarkdown(texto: string): BloqueInforme[] {
  const bloques: BloqueInforme[] = [];
  let parrafoActual: string[] = [];

  function cerrarParrafo() {
    if (parrafoActual.length) {
      bloques.push({ tipo: "p", segmentos: partirNegritas(parrafoActual.join(" ")) });
      parrafoActual = [];
    }
  }

  for (const lineaRaw of texto.split("\n")) {
    const linea = lineaRaw.trim();
    if (!linea) {
      cerrarParrafo();
      continue;
    }
    if (linea === "---") {
      cerrarParrafo();
      bloques.push({ tipo: "hr" });
      continue;
    }
    if (linea.startsWith("## ")) {
      cerrarParrafo();
      bloques.push({ tipo: "h2", segmentos: partirNegritas(linea.slice(3)) });
      continue;
    }
    if (linea.startsWith("# ")) {
      cerrarParrafo();
      bloques.push({ tipo: "h1", segmentos: partirNegritas(linea.slice(2)) });
      continue;
    }
    if (/^[-•]\s+/.test(linea)) {
      cerrarParrafo();
      bloques.push({ tipo: "bullet", segmentos: partirNegritas(linea.replace(/^[-•]\s+/, "")) });
      continue;
    }
    parrafoActual.push(linea);
  }
  cerrarParrafo();
  return bloques;
}

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { parseInformeMarkdown, type SegmentoTexto } from "./mindeval-informe-markdown";

// Branding propio de MindEval (navy #1B2A5B / dorado #F5B800) -- no la
// paleta de MINDTALENT/otros sub-productos del ecosistema, son marcas
// distintas dentro del mismo ecosistema (ver Branding en la skill).
const NAVY = [27, 42, 91] as [number, number, number];
const GOLD = [245, 184, 0] as [number, number, number];

type EstadoSenescyt = "pendiente" | "registrado" | "sin_registro";

const LABEL_SENESCYT: Record<EstadoSenescyt, string> = {
  registrado: "Registrado",
  sin_registro: "Sin registro",
  pendiente: "Pendiente",
};

interface DatosInformeCandidato {
  nombreCompleto: string;
  vacante: string;
  empresa: string;
  matchCv?: number;
  stenPromedio?: number;
  tecnicaTotal?: number;
  assessmentPromedio?: number;
  estadoSenescyt?: EstadoSenescyt;
}

const MARGEN_IZQ = 14;
const ANCHO_CONTENIDO = 182;
const LIMITE_INFERIOR = 275;

function asegurarEspacio(doc: jsPDF, y: number, necesario: number): number {
  if (y + necesario > LIMITE_INFERIOR) {
    doc.addPage();
    return 20;
  }
  return y;
}

/**
 * Dibuja segmentos con negrita real (cambia de fuente por tramo, no solo
 * deja los ** literales) con salto de línea palabra por palabra -- jsPDF no
 * tiene texto enriquecido nativo, así que el ancho de cada palabra se mide
 * a mano para decidir cuándo saltar de línea y cuándo saltar de página.
 */
function dibujarSegmentos(doc: jsPDF, segmentos: SegmentoTexto[], x: number, y: number, anchoMax: number, fontSize: number, lineHeight: number): number {
  doc.setFontSize(fontSize);
  let cursorX = x;
  let cursorY = y;

  for (const seg of segmentos) {
    doc.setFont("helvetica", seg.negrita ? "bold" : "normal");
    // Los espacios se parten como su propio token (en vez de dividir por
    // palabra y sumar un espacio fijo después de cada una) para no forzar
    // uno entre el final de un tramo en negrita y el texto normal que le
    // sigue pegado en el original (ej. "**100**." no debe quedar "100 .").
    const tokens = seg.texto.split(/(\s+)/).filter((t) => t.length > 0);
    for (const token of tokens) {
      if (/^\s+$/.test(token)) {
        cursorX += doc.getTextWidth(" ");
        continue;
      }
      const anchoToken = doc.getTextWidth(token);
      if (cursorX !== x && cursorX + anchoToken > x + anchoMax) {
        cursorX = x;
        cursorY += lineHeight;
        if (cursorY > LIMITE_INFERIOR) {
          doc.addPage();
          cursorY = 20;
        }
      }
      doc.text(token, cursorX, cursorY);
      cursorX += anchoToken;
    }
  }
  return cursorY + lineHeight;
}

function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/**
 * Exporta el Informe Final (Etapa 7) ya generado a PDF. Nunca regenera el
 * texto -- recibe exactamente el contenido que ya se guardó en
 * mindeval_informes_ia, para que el PDF descargado coincida siempre con lo
 * que el reclutador vio en pantalla antes de presentarlo.
 */
export function exportarInformeCandidatoPDF(datos: DatosInformeCandidato, textoInforme: string) {
  const doc = new jsPDF();

  // Header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("MindEval", 14, 13);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("BY MINDTALENT · Informe Final de Selección", 14, 19);
  doc.text(datos.empresa, 196, 12, { align: "right" });
  doc.text(`Fecha: ${new Date().toLocaleDateString("es-EC")}`, 196, 18, { align: "right" });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.line(0, 24, 210, 24);

  let y = 34;

  doc.setTextColor(28, 43, 58);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(datos.nombreCompleto, 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Vacante: ${datos.vacante}`, 14, y);
  y += 10;

  // Tabla resumen de instrumentos aplicados -- valores en bruto, la
  // interpretación por niveles de evidencia va en el cuerpo del informe.
  autoTable(doc, {
    startY: y,
    head: [["Match CV", "STEN prom.", "Técnica", "Assessment", "SENESCYT"]],
    body: [
      [
        datos.matchCv !== undefined ? `${datos.matchCv}%` : "—",
        datos.stenPromedio !== undefined ? datos.stenPromedio.toFixed(1) : "—",
        datos.tecnicaTotal !== undefined ? `${datos.tecnicaTotal}/100` : "—",
        datos.assessmentPromedio !== undefined ? `${datos.assessmentPromedio.toFixed(1)}/10` : "—",
        datos.estadoSenescyt ? LABEL_SENESCYT[datos.estadoSenescyt] : "—",
      ],
    ],
    headStyles: { fillColor: NAVY, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3, halign: "center" },
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Cuerpo del informe -- ya incluye la nota de alcance fija, agregada por
  // la ruta /api/mindeval-informe-ejecutivo, no por este exportador. El
  // texto viene en el subconjunto de Markdown que usa ese prompt (#, ##,
  // **negrita**, ---); se parsea y se dibuja con formato real en vez de
  // volcar los símbolos tal cual, que es lo que hacía splitTextToSize().
  const bloques = parseInformeMarkdown(textoInforme);
  for (const bloque of bloques) {
    if (bloque.tipo === "hr") {
      y = asegurarEspacio(doc, y, 8);
      y += 2;
      doc.setDrawColor(220, 224, 234);
      doc.setLineWidth(0.3);
      doc.line(MARGEN_IZQ, y, MARGEN_IZQ + ANCHO_CONTENIDO, y);
      y += 5;
      continue;
    }
    if (bloque.tipo === "h1" || bloque.tipo === "h2") {
      const fontSize = bloque.tipo === "h1" ? 12.5 : 11;
      y = asegurarEspacio(doc, y, fontSize / 2 + 4);
      y += 2;
      doc.setTextColor(...NAVY);
      y = dibujarSegmentos(doc, bloque.segmentos.map((s) => ({ ...s, negrita: true })), MARGEN_IZQ, y, ANCHO_CONTENIDO, fontSize, fontSize / 1.8);
      doc.setTextColor(51, 64, 95);
      y += 1;
      continue;
    }
    // párrafo o bullet
    const x = bloque.tipo === "bullet" ? MARGEN_IZQ + 4 : MARGEN_IZQ;
    const anchoMax = bloque.tipo === "bullet" ? ANCHO_CONTENIDO - 4 : ANCHO_CONTENIDO;
    y = asegurarEspacio(doc, y, 5.2);
    // el espacio va pegado al texto del bullet (no es un segmento aparte)
    // porque ya no se fuerza un espacio entre segmentos -- eso es justo lo
    // que arregla el caso "**100**." (sin ese espacio, quedaría "•Riesgo").
    const segmentos = bloque.tipo === "bullet" ? [{ texto: "•  ", negrita: false }, ...bloque.segmentos] : bloque.segmentos;
    doc.setTextColor(51, 64, 95);
    y = dibujarSegmentos(doc, segmentos, x, y, anchoMax, 10, 5.2);
    y += 1.5;
  }

  // Pie de página en todas las páginas
  const totalPaginas = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GOLD);
    doc.line(14, 285, 196, 285);
    doc.setTextColor(124, 137, 168);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("MindEval by MINDTALENT · Informe Final generado por IA — no sustituye la entrevista", 14, 290);
    doc.text(`Pág. ${i} / ${totalPaginas}`, 196, 290, { align: "right" });
  }

  doc.save(`informe-${slugificar(datos.nombreCompleto)}-${slugificar(datos.vacante)}.pdf`);
}

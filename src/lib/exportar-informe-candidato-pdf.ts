import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  // la ruta /api/mindeval-informe-ejecutivo, no por este exportador.
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 64, 95);
  const textoLimpio = textoInforme.replace(/[•‣]/g, "-");
  const lineas = doc.splitTextToSize(textoLimpio, 182) as string[];
  for (const linea of lineas) {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(linea, 14, y);
    y += 5.2;
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

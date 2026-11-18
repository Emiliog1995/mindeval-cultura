"use client";

import { NOMBRES_AREA_HOLLAND, ORDEN_HOLLAND, nivelHolland } from "@/lib/mindeval-holland";

/**
 * Informe individual del test vocacional de Holland en PDF (instituciones).
 * Mismo contenido que una fila del informe general, en una página por
 * evaluado: datos, código, puntajes por área con barra y observación.
 * Solo datos calculados (sin el informe descriptivo de IA).
 */

export interface FichaIndividualHolland {
  nombre: string;
  cedula: string | null;
  perfil: string | null;
  fecha: string | null; // ISO de cuando terminó la prueba
  codigo: string | null;
  incompleta: boolean;
  observacion: string | null;
  puntajes: Record<string, number | null> | null; // clave = nombre del área
}

const NAVY: [number, number, number] = [27, 42, 91];
const GOLD: [number, number, number] = [245, 184, 0];
const GRIS: [number, number, number] = [65, 80, 122];
const MAX_AREA = 5;

function nombreArchivo(t: string): string {
  return t.replace(/[\\/:*?"<>|]/g, "-").trim();
}

export async function descargarInformesIndividualesPdf(
  fichas: FichaIndividualHolland[],
  meta: { institucion: string; proceso: string },
  archivo?: string
): Promise<void> {
  const validas = fichas.filter((f) => f.codigo);
  if (!validas.length) return;

  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const M = 16;
  const generado = new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" });

  validas.forEach((f, idx) => {
    if (idx > 0) doc.addPage();

    // Encabezado
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, ancho, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("INFORME INDIVIDUAL", M, 14);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.text("Test vocacional de Holland (RIASEC)", M, 22);

    doc.setTextColor(...GRIS);
    doc.setFontSize(10);
    doc.text(`Institución ${meta.institucion} · ${meta.proceso}`, M, 39);

    // Datos del evaluado
    const perfil = f.perfil ? f.perfil.charAt(0).toUpperCase() + f.perfil.slice(1) : "-";
    const fecha = f.fecha ? new Date(f.fecha).toLocaleString("es-EC", { dateStyle: "long", timeStyle: "short" }) : "-";
    autoTable(doc, {
      startY: 44,
      margin: { left: M, right: M },
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2.6, lineColor: [154, 166, 194], lineWidth: 0.2, textColor: NAVY },
      columnStyles: { 0: { fontStyle: "bold", fillColor: [233, 237, 246], cellWidth: 50 } },
      body: [
        ["NOMBRE", f.nombre],
        ["CÉDULA", f.cedula ?? "-"],
        ["PERFIL", perfil],
        ["FECHA DE EVALUACIÓN", fecha],
      ],
    });

    // Resultado
    let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("RESULTADO DEL TEST", M, y);
    y += 3;
    doc.setFillColor(...GOLD);
    doc.roundedRect(M, y, 46, 18, 2, 2, "F");
    doc.setFontSize(22);
    doc.text(`${f.codigo}${f.incompleta ? " *" : ""}`, M + 23, y + 12.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...GRIS);
    doc.text("Código formado por las tres áreas con más respuestas afirmativas.", M + 52, y + 10.5);
    y += 28;

    // Puntajes por área
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("PUNTAJES POR ÁREA", M, y);
    const filas = ORDEN_HOLLAND.map((a) => {
      const nombre = NOMBRES_AREA_HOLLAND[a];
      const p = f.puntajes?.[nombre];
      return [`${a} · ${nombre}`, p == null ? "-" : `${p} de ${MAX_AREA}`, p == null ? "-" : nivelHolland(p), p == null ? "" : String(p)];
    });
    autoTable(doc, {
      startY: y + 3,
      margin: { left: M, right: M },
      theme: "grid",
      head: [["ÁREA", "RESPUESTAS SÍ", "NIVEL", ""]],
      body: filas,
      headStyles: { fillColor: [233, 237, 246], textColor: NAVY, fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 2.6, lineColor: [154, 166, 194], lineWidth: 0.2, textColor: NAVY, minCellHeight: 9 },
      columnStyles: { 0: { cellWidth: 52, fontStyle: "bold" }, 1: { cellWidth: 32, halign: "center" }, 2: { cellWidth: 28, halign: "center" }, 3: { textColor: [255, 255, 255] } },
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 3) return;
        const valor = Number(data.cell.raw);
        if (!Number.isFinite(valor)) return;
        const x = data.cell.x + 3;
        const w = data.cell.width - 6;
        const yb = data.cell.y + data.cell.height / 2 - 2;
        doc.setFillColor(238, 241, 247);
        doc.roundedRect(x, yb, w, 4, 1, 1, "F");
        if (valor > 0) {
          doc.setFillColor(...NAVY);
          doc.roundedRect(x, yb, (w * Math.min(valor, MAX_AREA)) / MAX_AREA, 4, 1, 1, "F");
        }
      },
    });

    // Observación
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("OBSERVACIÓN", M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const lineas = doc.splitTextToSize(f.observacion ?? "-", ancho - 2 * M - 8);
    const altoObs = lineas.length * 5 + 8;
    doc.setDrawColor(154, 166, 194);
    doc.setLineWidth(0.2);
    doc.rect(M, y + 3, ancho - 2 * M, altoObs);
    doc.text(lineas, M + 4, y + 9);
    y += altoObs + 10;

    if (f.incompleta) {
      doc.setFontSize(9);
      doc.setTextColor(...GRIS);
      doc.text("* Test no respondido en su totalidad.", M, y);
    }

    // Pie
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(M, alto - 16, ancho - M, alto - 16);
    doc.setFontSize(8.5);
    doc.setTextColor(124, 137, 168);
    doc.text(`MindEval · Generado el ${generado}`, M, alto - 10);
    doc.text(`Página ${idx + 1} de ${validas.length}`, ancho - M, alto - 10, { align: "right" });
  });

  const nombre = archivo ?? (validas.length === 1 ? `Informe individual - ${validas[0].nombre}` : `Informes individuales - ${meta.proceso}`);
  doc.save(`${nombreArchivo(nombre)}.pdf`);
}

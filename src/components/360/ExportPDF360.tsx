"use client";

import { useState } from "react";
import type { ResultadoConsolidado360 } from "@/lib/360-types";

interface Props {
  resultado: ResultadoConsolidado360;
  narrativa?: string;
  radarRef: React.RefObject<HTMLDivElement | null>;
}

export default function ExportPDF360({ resultado, narrativa, radarRef }: Props) {
  const [generando, setGenerando] = useState(false);

  async function exportar() {
    setGenerando(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const { evaluado, periodo, puntaje360, cumplimientoIndicadores, puntajeDesempenoFinal,
              nivelDesempeno, puntajePotencial,
              nivelPotencial, potencialPendiente, nombreCuadrante, accionCuadrante,
              brechas, pdi, indicadoresEsenciales } = resultado;

      const PRIMARY = [26, 32, 53] as [number, number, number];
      const GOLD    = [201, 168, 76] as [number, number, number];
      const WHITE   = [255, 255, 255] as [number, number, number];

      // Header
      doc.setFillColor(...PRIMARY);
      doc.rect(0, 0, 210, 35, "F");
      doc.setTextColor(...GOLD);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("MINDTALENT", 14, 14);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...WHITE);
      doc.text("Informe de Evaluación 360° + Nine Box", 14, 21);
      doc.text(`Período: ${periodo}   |   Fecha: ${new Date().toLocaleDateString("es-MX")}`, 14, 28);

      // Datos del evaluado
      doc.setTextColor(30, 42, 66);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(evaluado.nombre, 14, 45);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`${evaluado.cargo} · ${evaluado.departamento}${evaluado.jefe ? ` · Jefe: ${evaluado.jefe}` : ""}`, 14, 52);

      // KPI cards (text-based)
      doc.setFillColor(240, 244, 248);
      doc.roundedRect(14, 58, 85, 26, 3, 3, "F");
      doc.roundedRect(111, 58, 85, 26, 3, 3, "F");

      doc.setTextColor(...PRIMARY);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(puntajeDesempenoFinal.toFixed(2), 56, 70, { align: "center" });
      doc.text(potencialPendiente ? "—" : puntajePotencial.toFixed(2), 153, 70, { align: "center" });

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Desempeño final — ${nivelDesempeno}`, 56, 76, { align: "center" });
      doc.text(potencialPendiente ? "Potencial — pendiente evaluación del jefe" : `Potencial — ${nivelPotencial}`, 153, 76, { align: "center" });
      doc.setFontSize(7);
      doc.text(
        cumplimientoIndicadores !== null
          ? `360°: ${puntaje360.toFixed(2)} (60%)  ·  Indicadores esenciales: ${cumplimientoIndicadores.toFixed(2)} (40%)`
          : `360°: ${puntaje360.toFixed(2)} (sin indicadores esenciales vinculados)`,
        56, 81, { align: "center" },
      );

      // Nine Box position
      doc.setFillColor(...GOLD);
      doc.roundedRect(14, 88, 182, 14, 3, 3, "F");
      doc.setTextColor(...PRIMARY);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(
        potencialPendiente ? "Nine Box: pendiente (falta evaluación del Jefe Directo)" : `Nine Box: Cuadrante ${resultado.cuadrante} — ${nombreCuadrante}`,
        105, 96, { align: "center" },
      );
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        potencialPendiente ? "El potencial y la posición en la matriz se calculan cuando el jefe complete su evaluación." : `Acción recomendada: ${accionCuadrante}`,
        105, 100, { align: "center" },
      );

      // Intenta captura del radar
      let yAfterRadar = 108;
      if (radarRef.current) {
        try {
          const { default: html2canvas } = await import("html2canvas");
          const canvas = await html2canvas(radarRef.current, { backgroundColor: "#ffffff", scale: 1.5 });
          const imgData = canvas.toDataURL("image/png");
          doc.addImage(imgData, "PNG", 40, 108, 130, 70);
          yAfterRadar = 182;
        } catch {
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text("(Ver gráfico radar en la plataforma)", 105, 114, { align: "center" });
          yAfterRadar = 120;
        }
      }

      // Tabla de puntajes por competencia
      autoTable(doc, {
        startY: yAfterRadar + 2,
        head: [["Competencia", "Meta", "Actual", "Brecha", "Prioridad"]],
        body: brechas.map((b) => [
          b.label, b.meta.toFixed(1), b.actual.toFixed(2),
          b.brecha.toFixed(2),
          b.prioridad.toUpperCase(),
        ]),
        headStyles: { fillColor: PRIMARY, textColor: GOLD, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: { 4: { fontStyle: "bold" } },
        didDrawCell: (data) => {
          if (data.column.index === 4 && data.section === "body") {
            const val = brechas[data.row.index]?.prioridad;
            if (val === "alta") doc.setTextColor(220, 38, 38);
            else if (val === "media") doc.setTextColor(202, 138, 4);
            else doc.setTextColor(22, 163, 74);
          }
        },
      });

      // Indicadores esenciales del puesto (detalle, si hay puesto vinculado)
      if (indicadoresEsenciales.length > 0) {
        const finalYBrechas = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yAfterRadar + 40;
        autoTable(doc, {
          startY: finalYBrechas + 8,
          head: [["Indicador esencial", "Meta", "Calificación (1-5)"]],
          body: indicadoresEsenciales.map((ind) => [
            ind.indicador,
            ind.meta,
            ind.calificacion !== null ? ind.calificacion.toFixed(1) : "Pendiente",
          ]),
          headStyles: { fillColor: PRIMARY, textColor: GOLD, fontStyle: "bold", fontSize: 9 },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: { 2: { fontStyle: "bold", halign: "center" } },
        });
      }

      // PDI
      if (pdi) {
        doc.addPage();
        doc.setFillColor(...PRIMARY);
        doc.rect(0, 0, 210, 18, "F");
        doc.setTextColor(...GOLD);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Plan de Desarrollo Individual (PDI)", 14, 12);

        const pdiRows: string[][] = [];
        for (let i = 1; i <= 3; i++) {
          const pdiAny = pdi as unknown as Record<string, string | undefined>;
          const area = pdiAny[`area_mejora_${i}`];
          const obj  = pdiAny[`objetivo_smart_${i}`];
          const acc  = pdiAny[`accion_${i}`];
          if (area) pdiRows.push([`Área ${i}`, area ?? "", obj ?? "", acc ?? ""]);
        }

        autoTable(doc, {
          startY: 24,
          head: [["#", "Área de mejora", "Objetivo SMART", "Acción"]],
          body: pdiRows,
          headStyles: { fillColor: PRIMARY, textColor: GOLD, fontSize: 9 },
          bodyStyles: { fontSize: 8 },
        });

        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Plazo: ${pdi.plazo ?? "—"}   |   Indicador: ${pdi.indicador ?? "—"}`, 14,
          ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 80) + 8);
      }

      // Narrativa IA
      if (narrativa) {
        doc.addPage();
        doc.setFillColor(...PRIMARY);
        doc.rect(0, 0, 210, 18, "F");
        doc.setTextColor(...GOLD);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Análisis Narrativo — Inteligencia Artificial", 14, 12);
        doc.setTextColor(30, 42, 66);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(narrativa, 182);
        doc.text(lines, 14, 26);
      }

      // Footer en todas las páginas
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`gerencia@mindtalentrh.com  ·  Pág. ${i} de ${totalPages}`, 105, 290, { align: "center" });
      }

      doc.save(`360_${evaluado.nombre.replace(/\s+/g, "_")}_${periodo}.pdf`);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <button
      onClick={exportar}
      disabled={generando}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
      style={{ backgroundColor: "#1e2a42", color: "#10b981", border: "1px solid #10b981" }}
    >
      {generando ? "Generando PDF…" : "⬇ Exportar PDF"}
    </button>
  );
}

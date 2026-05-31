"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";
import { obtenerEvaluacion, type Evaluacion } from "@/lib/supabase";
import { getLevelColor, interpretacion } from "@/lib/scoring";
import { isAdmin } from "@/lib/auth";
import type { ScoringResult } from "@/lib/scoring";

function ResultadosContent() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const [ev, setEv] = useState<Evaluacion | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAdmin()) { router.replace("/admin"); return; }
    if (!id) { setError("No se encontró el ID de evaluación."); return; }
    obtenerEvaluacion(id)
      .then(setEv)
      .catch(() => setError("No se pudo cargar la evaluación."));
  }, [id, router]);

  async function descargarPDF() {
    if (!ev) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const scores: ScoringResult = ev.scores as ScoringResult;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();

    // Cabecera
    doc.setFillColor(26, 32, 53);
    doc.rect(0, 0, W, 35, "F");
    doc.setTextColor(201, 168, 76);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("MINDTALENT", 14, 14);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Assessment Center Digital — Diagnóstico de Cultura Organizacional DOCS", 14, 22);
    doc.text(`Quito, Ecuador · ${new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" })}`, 14, 29);

    // Datos del evaluado
    doc.setTextColor(26, 32, 53);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DEL EVALUADO", 14, 46);
    autoTable(doc, {
      startY: 50,
      head: [],
      body: [
        ["Nombre", ev.nombre],
        ["Cargo", ev.cargo],
        ["Área", ev.area],
        ["Empresa", ev.empresa],
        ["Fecha", new Date(ev.created_at).toLocaleDateString("es-EC")],
      ],
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: { 0: { fontStyle: "bold", fillColor: [240, 244, 248], cellWidth: 35 } },
    });

    // Puntuación global
    const afterDatos = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFillColor(26, 32, 53);
    doc.roundedRect(14, afterDatos, W - 28, 18, 3, 3, "F");
    doc.setTextColor(201, 168, 76);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Puntuación Global: ${scores.global.toFixed(2)} / 5.00`, 20, afterDatos + 8);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`Nivel: ${scores.globalLevel}`, 20, afterDatos + 14);

    // Tabla de dimensiones
    const afterGlobal = afterDatos + 26;
    doc.setTextColor(26, 32, 53);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("RESULTADOS POR DIMENSIÓN", 14, afterGlobal);
    autoTable(doc, {
      startY: afterGlobal + 4,
      head: [["Dimensión", "Puntuación", "Nivel"]],
      body: scores.dimensions.map((d) => [d.label, d.mean.toFixed(2), d.level]),
      theme: "striped",
      headStyles: { fillColor: [26, 32, 53], textColor: [201, 168, 76], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 2.5 },
    });

    // Tabla de subescalas
    const afterDims = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("RESULTADOS POR SUBESCALA", 14, afterDims);
    autoTable(doc, {
      startY: afterDims + 4,
      head: [["Cód.", "Subescala", "Dimensión", "Puntuación", "Nivel"]],
      body: scores.subscales.map((s) => [s.code, s.label, s.dimension, s.mean.toFixed(2), s.level]),
      theme: "striped",
      headStyles: { fillColor: [26, 32, 53], textColor: [201, 168, 76], fontStyle: "bold" },
      styles: { fontSize: 8.5, cellPadding: 2 },
    });

    // Interpretación
    const afterSubs = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(26, 32, 53);
    doc.text("INTERPRETACIÓN", 14, afterSubs);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lineas = doc.splitTextToSize(interpretacion(scores.globalLevel), W - 28);
    doc.text(lineas, 14, afterSubs + 6);

    // Pie
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text("MINDTALENT · gerencia@mindtalentrh.com · Modelo DOCS-Denison", 14, 285);

    doc.save(`DOCS_${ev.nombre.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f0f4f8" }}>
      <div className="bg-white rounded-2xl shadow p-8 text-center max-w-md">
        <p className="text-red-600 font-semibold">{error}</p>
        <Link href="/" className="mt-4 inline-block text-sm underline" style={{ color: "#1a2035" }}>Volver al portal</Link>
      </div>
    </div>
  );

  if (!ev) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f0f4f8" }}>
      <div className="text-center">
        <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: "#1a2035", borderTopColor: "#c9a84c" }} />
        <p className="text-gray-500 text-sm">Cargando resultados...</p>
      </div>
    </div>
  );

  const scores: ScoringResult = ev.scores as ScoringResult;
  const radarData = scores.dimensions.map((d) => ({ subject: d.label, value: d.mean, fullMark: 5 }));

  return (
    <div className="min-h-screen" style={{ background: "#f0f4f8" }}>
      <header style={{ background: "#1a2035" }} className="py-4 px-6 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <span style={{ color: "#c9a84c" }} className="text-xl font-bold tracking-wide">MINDTALENT</span>
            <p className="text-white text-xs mt-0.5 opacity-70">Assessment Center Digital · Quito, Ecuador</p>
          </div>
          <button
            onClick={descargarPDF}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "#c9a84c", color: "#1a2035" }}
          >
            Descargar PDF
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Encabezado del evaluado */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h1 className="text-xl font-bold mb-1" style={{ color: "#1a2035" }}>Informe Individual DOCS</h1>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
            {[
              { l: "Nombre", v: ev.nombre },
              { l: "Cargo", v: ev.cargo },
              { l: "Área", v: ev.area },
              { l: "Empresa", v: ev.empresa },
            ].map(({ l, v }) => (
              <div key={l}>
                <p className="text-xs text-gray-400">{l}</p>
                <p className="font-semibold text-gray-800">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Puntuación global */}
        <div className="rounded-2xl shadow p-6 text-center" style={{ background: "#1a2035" }}>
          <p className="text-white text-sm mb-1">Puntuación Global</p>
          <p style={{ color: "#c9a84c" }} className="text-5xl font-bold">{scores.global.toFixed(2)}</p>
          <p className="text-white text-lg font-semibold mt-1">{scores.globalLevel}</p>
          <p className="text-white text-xs mt-3 opacity-70 max-w-xl mx-auto">{interpretacion(scores.globalLevel)}</p>
        </div>

        {/* Radar chart */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-base font-bold mb-4" style={{ color: "#1a2035" }}>Perfil por Dimensión</h2>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#1a2035" }} />
              <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 9 }} />
              <Radar name="Score" dataKey="value" stroke="#1a2035" fill="#c9a84c" fillOpacity={0.55} />
              <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla de dimensiones */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-base font-bold mb-4" style={{ color: "#1a2035" }}>Resultados por Dimensión</h2>
          <div className="space-y-3">
            {scores.dimensions.map((d) => (
              <div key={d.code} className="flex items-center gap-4">
                <div className="w-36 text-sm font-medium text-gray-700 shrink-0">{d.label}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-3">
                  <div
                    className="h-3 rounded-full"
                    style={{ width: `${(d.mean / 5) * 100}%`, background: getLevelColor(d.level) }}
                  />
                </div>
                <div className="w-14 text-right text-sm font-bold" style={{ color: getLevelColor(d.level) }}>
                  {d.mean.toFixed(2)}
                </div>
                <div className="w-20 text-xs font-semibold" style={{ color: getLevelColor(d.level) }}>
                  {d.level}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabla de subescalas */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-base font-bold mb-4" style={{ color: "#1a2035" }}>Detalle por Subescala</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#1a2035" }}>
                  {["Cód.", "Subescala", "Dimensión", "Puntuación", "Nivel"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold" style={{ color: "#c9a84c" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scores.subscales.map((s, i) => (
                  <tr key={s.code} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="px-3 py-2 font-bold text-gray-500">{s.code}</td>
                    <td className="px-3 py-2 text-gray-800">{s.label}</td>
                    <td className="px-3 py-2 text-gray-500">{s.dimension}</td>
                    <td className="px-3 py-2 font-bold" style={{ color: getLevelColor(s.level) }}>{s.mean.toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs font-semibold" style={{ color: getLevelColor(s.level) }}>{s.level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-center pt-2 pb-8">
          <Link href="/dashboard" className="text-sm underline" style={{ color: "#1a2035" }}>
            Ver dashboard de todos los evaluados →
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function ResultadosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f0f4f8" }}>
        <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: "#1a2035", borderTopColor: "#c9a84c" }} />
      </div>
    }>
      <ResultadosContent />
    </Suspense>
  );
}

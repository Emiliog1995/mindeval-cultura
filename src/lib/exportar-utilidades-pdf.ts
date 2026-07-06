import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ResultadoUtilidades } from './nomina-scoring'

const money = (n: number) => `$${n.toFixed(2)}`

export function exportarUtilidadesPDF(
  empresaNombre: string,
  anio: number,
  utilidadLiquida: number,
  resultado: ResultadoUtilidades,
) {
  const doc = new jsPDF()
  const DARK = [26, 32, 53] as [number, number, number]
  const NAVY = [36, 52, 71] as [number, number, number]
  const GOLD = [201, 168, 76] as [number, number, number]

  doc.setFillColor(...DARK)
  doc.rect(0, 0, 210, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16); doc.setFont('helvetica', 'bold')
  doc.text('MINDTALENT', 14, 12)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text('Consultoría HR Tech · Quito, Ecuador', 14, 18)
  doc.text('Reparto de Utilidades — Nómina Ecuador', 196, 12, { align: 'right' })
  doc.text(`${empresaNombre}  ·  Ejercicio ${anio}`, 196, 18, { align: 'right' })

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(1)
  doc.line(0, 22, 210, 22)

  let y = 30

  const seccion = (num: number, titulo: string) => {
    if (y > 260) { doc.addPage(); y = 20 }
    doc.setFillColor(...NAVY)
    doc.rect(14, y, 182, 7, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text(`${num}. ${titulo}`, 17, y + 5)
    y += 10
    doc.setTextColor(28, 43, 58); doc.setFont('helvetica', 'normal')
  }

  seccion(1, 'RESUMEN DEL EJERCICIO')
  autoTable(doc, {
    startY: y,
    body: [
      ['Utilidad líquida de la empresa:', money(utilidadLiquida)],
      ['Total utilidades a repartir (15%):', money(resultado.totalUtilidades)],
      ['10% partes iguales:', money(resultado.pool10Porciento)],
      ['5% por cargas familiares:', money(resultado.pool5Porciento)],
      ['Empleados beneficiarios:', String(resultado.reparticiones.length)],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    theme: 'plain',
    margin: { left: 14, right: 14 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  seccion(2, 'DETALLE POR EMPLEADO')
  autoTable(doc, {
    startY: y,
    head: [['Empleado', '10% partes iguales', '5% por cargas', 'Total a recibir']],
    body: resultado.reparticiones.map(r => [r.nombre, money(r.montoIgual), money(r.montoCargas), money(r.total)]),
    headStyles: { fillColor: DARK, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  if (y > 260) { doc.addPage(); y = 20 }
  doc.setFontSize(7); doc.setTextColor(90, 90, 90)
  const aviso = 'Este reporte es un cálculo de referencia interno de MINDTALENT. La utilidad líquida es la declarada por la empresa en su impuesto a la renta; verifícala con el contador antes de proceder al pago.'
  doc.text(doc.splitTextToSize(aviso, 178), 14, y)

  const totalPaginas = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setDrawColor(...GOLD)
    doc.line(14, 285, 196, 285)
    doc.setTextColor(90, 113, 132); doc.setFontSize(7)
    doc.text('MINDTALENT · Nómina Ecuador — Reparto de utilidades', 14, 290)
    doc.text(`Pág. ${i} / ${totalPaginas}  ·  Generado: ${new Date().toLocaleDateString('es-EC')}`, 196, 290, { align: 'right' })
  }

  doc.save(`Utilidades-${empresaNombre.replace(/\s+/g, '-')}-${anio}.pdf`)
}

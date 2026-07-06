import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CausalLiquidacion, ResultadoLiquidacion } from './nomina-scoring'

interface EmpleadoLiquidacion {
  nombre: string
  cedula?: string | null
  cargo?: string | null
}

const money = (n: number) => `$${n.toFixed(2)}`

const CAUSAL_LABEL: Record<CausalLiquidacion, string> = {
  renuncia_voluntaria: 'Renuncia voluntaria (desahucio)',
  despido_intempestivo: 'Despido intempestivo',
  mutuo_acuerdo: 'Mutuo acuerdo',
  visto_bueno: 'Visto bueno',
}

export function exportarLiquidacionPDF(
  empleado: EmpleadoLiquidacion,
  empresaNombre: string,
  causal: CausalLiquidacion,
  fechaLiquidacion: string,
  resultado: ResultadoLiquidacion,
) {
  const doc = new jsPDF()
  const DARK = [26, 32, 53] as [number, number, number]
  const NAVY = [36, 52, 71] as [number, number, number]
  const GOLD = [201, 168, 76] as [number, number, number]

  // Header
  doc.setFillColor(...DARK)
  doc.rect(0, 0, 210, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16); doc.setFont('helvetica', 'bold')
  doc.text('MINDTALENT', 14, 12)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text('Consultoría HR Tech · Quito, Ecuador', 14, 18)
  doc.text('Borrador de Liquidación — Nómina Ecuador', 196, 12, { align: 'right' })
  doc.text(`${empresaNombre}  ·  ${fechaLiquidacion}`, 196, 18, { align: 'right' })

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(1)
  doc.line(0, 22, 210, 22)

  // Marca de agua BORRADOR — siempre presente: esto nunca es un acta válida
  doc.setTextColor(201, 168, 76)
  doc.setFontSize(60); doc.setFont('helvetica', 'bold')
  doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.08 }))
  doc.text('BORRADOR', 105, 160, { align: 'center', angle: 45 })
  doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 1 }))

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

  // 1. Datos
  seccion(1, 'DATOS DEL EMPLEADO Y LA LIQUIDACIÓN')
  autoTable(doc, {
    startY: y,
    body: [
      ['Nombre:', empleado.nombre, 'Cédula:', empleado.cedula ?? '[ Por completar ]'],
      ['Cargo:', empleado.cargo ?? '[ Por completar ]', 'Causal:', CAUSAL_LABEL[causal]],
      ['Fecha de liquidación:', fechaLiquidacion, 'Años de servicio:', resultado.aniosServicio.toFixed(2)],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    theme: 'plain',
    margin: { left: 14, right: 14 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // 2. Detalle
  seccion(2, 'DETALLE DE LA LIQUIDACIÓN')
  const filas: (string | number)[][] = [
    ['Proporcional décimo tercero', money(resultado.proporcionalDecimo3)],
    ['Proporcional décimo cuarto', money(resultado.proporcionalDecimo4)],
    ['Vacaciones no gozadas', money(resultado.vacacionesNoGozadas)],
  ]
  if (causal === 'renuncia_voluntaria') filas.push(['Bonificación por desahucio (25% × sueldo × años)', money(resultado.bonificacionDesahucio)])
  if (causal === 'despido_intempestivo') filas.push(['Indemnización despido intempestivo (Art. 188 CT)', money(resultado.indemnizacionDespido)])

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Valor']],
    body: filas,
    headStyles: { fillColor: DARK, fontSize: 8 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 14, right: 14 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  doc.setFillColor(...GOLD)
  doc.rect(14, y, 182, 10, 'F')
  doc.setTextColor(...DARK); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text('TOTAL LIQUIDACIÓN', 17, y + 7)
  doc.text(money(resultado.total), 193, y + 7, { align: 'right' })
  y += 20

  // 3. Aviso legal
  seccion(3, 'AVISO')
  doc.setFontSize(8)
  const aviso = 'Este documento es un cálculo de referencia interno de MINDTALENT, basado en las reglas generales del régimen general del Código del Trabajo de Ecuador. No cubre casos especiales (fuero de maternidad/paternidad, discapacidad, adultos mayores, dirigentes sindicales) ni incluye fondos de reserva pendientes (verificar directamente en el IESS). No constituye un acta de finiquito válida ante el Ministerio de Trabajo (SUT) — el acta oficial debe tramitarse en el sistema SUT por el empleador o su representante legal.'
  const lineas = doc.splitTextToSize(aviso, 178)
  doc.text(lineas, 14, y)
  y += lineas.length * 4 + 20

  // Firmas
  if (y > 250) { doc.addPage(); y = 30 }
  doc.setDrawColor(150, 150, 150)
  doc.line(20, y, 90, y)
  doc.line(120, y, 190, y)
  doc.setFontSize(8); doc.setTextColor(90, 90, 90)
  doc.text('Firma empleador', 40, y + 5)
  doc.text('Firma empleado (recibí conforme)', 125, y + 5)

  // Pie de página
  const totalPaginas = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setDrawColor(...GOLD)
    doc.line(14, 285, 196, 285)
    doc.setTextColor(90, 113, 132); doc.setFontSize(7)
    doc.text('MINDTALENT · Borrador de referencia — no reemplaza el acta de finiquito SUT', 14, 290)
    doc.text(`Pág. ${i} / ${totalPaginas}  ·  Generado: ${new Date().toLocaleDateString('es-EC')}`, 196, 290, { align: 'right' })
  }

  const nombreArchivo = `Liquidacion-${empleado.nombre.replace(/\s+/g, '-')}-${fechaLiquidacion}.pdf`
  doc.save(nombreArchivo)
}

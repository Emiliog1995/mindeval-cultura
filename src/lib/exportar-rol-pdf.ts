import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ResultadoNomina } from './nomina-scoring'

interface EmpleadoRol {
  nombre: string
  cedula?: string | null
  cargo?: string | null
  area?: string | null
}

interface NovedadesRol {
  diasTrabajados: number
  horasSuplementarias: number
  horasExtraordinarias: number
  comisiones: number
  bonos: number
  anticipos: number
  prestamoIess: number
  otrosDescuentos: number
}

const money = (n: number) => `$${n.toFixed(2)}`

export function exportarRolPDF(
  empleado: EmpleadoRol,
  novedades: NovedadesRol,
  resultado: ResultadoNomina,
  periodo: string,
  empresaNombre: string,
  esBorrador = false,
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
  doc.text('Rol de Pagos Individual — Nómina Ecuador', 196, 12, { align: 'right' })
  doc.text(`Período: ${periodo}  ·  ${empresaNombre}`, 196, 18, { align: 'right' })

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(1)
  doc.line(0, 22, 210, 22)

  if (esBorrador) {
    doc.setTextColor(201, 168, 76)
    doc.setFontSize(60); doc.setFont('helvetica', 'bold')
    doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.07 }))
    doc.text('BORRADOR', 105, 160, { align: 'center', angle: 45 })
    doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 1 }))
  }

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

  // 1. Datos del empleado
  seccion(1, 'DATOS DEL EMPLEADO')
  autoTable(doc, {
    startY: y,
    body: [
      ['Nombre:', empleado.nombre, 'Cédula:', empleado.cedula ?? '[ Por completar ]'],
      ['Cargo:', empleado.cargo ?? '[ Por completar ]', 'Área:', empleado.area ?? '[ Por completar ]'],
      ['Período:', periodo, 'Días trabajados:', String(novedades.diasTrabajados)],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    theme: 'plain',
    margin: { left: 14, right: 14 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // 2. Ingresos / Descuentos
  seccion(2, 'INGRESOS Y DESCUENTOS')
  autoTable(doc, {
    startY: y,
    head: [['INGRESOS', 'VALOR', 'DESCUENTOS', 'VALOR']],
    body: [
      ['Sueldo ganado', money(resultado.sueldoGanado), 'Aporte IESS personal', money(resultado.aporteIessPersonal)],
      ['Horas suplementarias', money(resultado.valorHorasSuplementarias), 'Anticipos', money(novedades.anticipos)],
      ['Horas extraordinarias', money(resultado.valorHorasExtraordinarias), 'Préstamo IESS', money(novedades.prestamoIess)],
      ['Comisiones / Bonos', money(novedades.comisiones + novedades.bonos), 'Otros descuentos', money(novedades.otrosDescuentos)],
      ['', '', 'Impuesto a la Renta', money(resultado.impuestoRenta)],
      ['TOTAL INGRESOS', money(resultado.totalIngresos), 'TOTAL DESCUENTOS', money(resultado.totalDescuentos)],
    ],
    headStyles: { fillColor: DARK, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.row.index === 5) data.cell.styles.fontStyle = 'bold'
    },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // 3. Líquido a recibir
  doc.setFillColor(...GOLD)
  doc.rect(14, y, 182, 10, 'F')
  doc.setTextColor(...DARK); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text('LÍQUIDO A RECIBIR', 17, y + 7)
  doc.text(money(resultado.liquidoRecibir), 193, y + 7, { align: 'right' })
  y += 16

  // 4. Informativo — costo patronal y provisiones
  seccion(3, 'INFORMATIVO — COSTO PATRONAL Y PROVISIONES (no afecta el líquido)')
  autoTable(doc, {
    startY: y,
    body: [
      ['Aporte patronal IESS', money(resultado.aportePatronal), 'Provisión décimo 3ro', money(resultado.provisionDecimo3)],
      ['Fondos de reserva', money(resultado.fondosReserva), 'Provisión décimo 4to', money(resultado.provisionDecimo4)],
      ['Costo total empresa', money(resultado.costoEmpresa), 'Provisión vacaciones', money(resultado.provisionVacaciones)],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    theme: 'plain',
    margin: { left: 14, right: 14 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20

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
    doc.text('MINDTALENT · Nómina Ecuador 2026 — Reporte de referencia interna, no reemplaza planilla IESS oficial', 14, 290)
    doc.text(`Pág. ${i} / ${totalPaginas}  ·  Generado: ${new Date().toLocaleDateString('es-EC')}`, 196, 290, { align: 'right' })
  }

  const nombreArchivo = `Rol-${empleado.nombre.replace(/\s+/g, '-')}-${periodo}.pdf`
  doc.save(nombreArchivo)
}

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Actividad {
  descripcion: string
  frecuencia: number
  consecuencia: number
  complejidad: number
}

interface Competencia {
  tipo: string
  descripcion: string
  requerimiento?: string
}

interface Indicador {
  indicador: string
  formula?: string
  meta?: string
  cliente?: string
}

interface Instruccion {
  nivel_educativo?: string
  titulo?: string
  area_especializacion?: string
  experiencia_tipo?: string
  experiencia_anios?: number
  capacitacion?: { tema: string; horas: number }[]
}

interface Puesto {
  nombre_puesto: string
  area: string
  supervisado_por?: string
  supervisa_a?: string
  mision?: string
  fecha?: string
}

export async function exportarFichaPDF(
  puesto: Puesto,
  actividades: Actividad[],
  esenciales: Actividad[],
  competencias: Competencia[],
  instruccion: Instruccion,
  indicadores: Indicador[],
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
  doc.text('Manual de Puestos por Competencias — Metodología MDT', 196, 12, { align: 'right' })
  doc.text(`Fecha: ${puesto.fecha ?? new Date().toLocaleDateString('es-EC')}`, 196, 18, { align: 'right' })

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(1)
  doc.line(0, 22, 210, 22)

  // Marca de agua BORRADOR
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

  // 1. Identificación
  seccion(1, 'DATOS DE IDENTIFICACIÓN DEL PUESTO')
  autoTable(doc, {
    startY: y,
    body: [
      ['Nombre del puesto:', puesto.nombre_puesto, 'Área / Departamento:', puesto.area],
      ['Supervisado por:', puesto.supervisado_por ?? '[ Por completar ]', 'Supervisa a:', puesto.supervisa_a ?? '[ Por completar ]'],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [240, 244, 248], cellWidth: 42 }, 2: { fontStyle: 'bold', fillColor: [240, 244, 248], cellWidth: 42 } },
    theme: 'plain', margin: { left: 14, right: 14 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // 2. Misión
  seccion(2, 'MISIÓN DEL PUESTO')
  doc.setFontSize(8)
  const misionLines = doc.splitTextToSize(puesto.mision ?? '[ Por completar ]', 180)
  doc.text(misionLines, 14, y)
  y += (misionLines.length * 5) + 6

  // 3. Actividades esenciales
  seccion(3, 'ACTIVIDADES ESENCIALES')
  autoTable(doc, {
    startY: y,
    head: [['N°', 'Actividad esencial', 'F', 'CE', 'CM', 'Total']],
    body: esenciales.map((a, i) => [
      i + 1, a.descripcion, a.frecuencia, a.consecuencia, a.complejidad,
      (a.frecuencia + a.consecuencia * a.complejidad).toFixed(0),
    ]),
    headStyles: { fillColor: DARK, fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8 },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 10, halign: 'center' },
      4: { cellWidth: 10, halign: 'center' },
      5: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // 4. Todas las actividades
  if (actividades.length > 0) {
    seccion(4, 'ACTIVIDADES DEL PUESTO — TABLA MDT COMPLETA')
    autoTable(doc, {
      startY: y,
      head: [['N°', 'Actividad', 'F', 'CE', 'CM', 'Total', 'Esencial']],
      body: actividades.map((a, i) => {
        const total = a.frecuencia + a.consecuencia * a.complejidad
        const esEsencial = esenciales.some(e => e.descripcion === a.descripcion)
        return [i + 1, a.descripcion, a.frecuencia || '—', a.consecuencia || '—', a.complejidad || '—', total || '—', esEsencial ? '✓' : '']
      }),
      headStyles: { fillColor: DARK, fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 8 },
        2: { cellWidth: 10, halign: 'center' },
        3: { cellWidth: 10, halign: 'center' },
        4: { cellWidth: 10, halign: 'center' },
        5: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        6: { cellWidth: 14, halign: 'center', textColor: GOLD },
      },
      margin: { left: 14, right: 14 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  // 5. Conocimientos
  const conocimientos = competencias.filter(c => c.tipo === 'conocimiento')
  seccion(5, 'CONOCIMIENTOS REQUERIDOS')
  if (conocimientos.length > 0) {
    autoTable(doc, {
      startY: y,
      body: conocimientos.map(c => [c.descripcion]),
      styles: { fontSize: 8, cellPadding: 2 },
      theme: 'plain', margin: { left: 14, right: 14 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  } else {
    doc.setFontSize(8); doc.text('[ Por completar ]', 14, y); y += 10
  }

  // 6. Herramientas y programas
  seccion(6, 'HERRAMIENTAS Y PROGRAMAS')
  const herramientas = competencias.filter(c => c.tipo === 'herramienta' || c.tipo === 'destreza_especifica')
  const filasHerr = herramientas.map(c => [c.descripcion, c.requerimiento ?? ''])
  if (filasHerr.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Herramienta / Programa', 'Nivel requerido']],
      body: filasHerr,
      headStyles: { fillColor: DARK, fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  } else {
    doc.setFontSize(8); doc.text('[ Por completar ]', 14, y); y += 10
  }

  // 7. Destrezas y habilidades
  seccion(7, 'DESTREZAS Y HABILIDADES')
  const destrezasG = competencias.filter(c => c.tipo === 'destreza_general')
  const filas = destrezasG.map(c => [c.descripcion, c.requerimiento ?? ''])
  if (filas.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Destreza', 'Nivel requerido']],
      body: filas,
      headStyles: { fillColor: DARK, fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  } else {
    doc.setFontSize(8); doc.text('[ Por completar ]', 14, y); y += 10
  }

  // 8. Competencias conductuales
  const capacidades = competencias.filter(c => c.tipo === 'capacidad')
  seccion(8, 'COMPETENCIAS CONDUCTUALES Y VALORES')
  if (capacidades.length > 0) {
    autoTable(doc, {
      startY: y,
      body: capacidades.map(c => [c.descripcion]),
      styles: { fontSize: 8, cellPadding: 2 },
      theme: 'plain', margin: { left: 14, right: 14 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  } else {
    doc.setFontSize(8); doc.text('[ Por completar ]', 14, y); y += 10
  }

  // 9. Instrucción y experiencia
  seccion(9, 'INSTRUCCIÓN FORMAL Y EXPERIENCIA LABORAL')
  autoTable(doc, {
    startY: y,
    body: [
      ['Nivel educativo:', instruccion.nivel_educativo ?? '[ Por completar ]', 'Título:', instruccion.titulo ?? '[ Por completar ]'],
      ['Área de especialización:', instruccion.area_especializacion ?? '[ Por completar ]', 'Años de experiencia:', instruccion.experiencia_anios != null ? `${instruccion.experiencia_anios} años` : '[ Por completar ]'],
      ['Tipo de experiencia:', instruccion.experiencia_tipo ?? '[ Por completar ]', '', ''],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [240, 244, 248], cellWidth: 42 }, 2: { fontStyle: 'bold', fillColor: [240, 244, 248], cellWidth: 42 } },
    theme: 'plain', margin: { left: 14, right: 14 },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // 10. Indicadores de gestión
  seccion(10, 'INDICADORES DE GESTIÓN')
  if (indicadores.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Indicador', 'Fórmula', 'Meta', 'Cliente / Beneficiario']],
      body: indicadores.map(ind => [ind.indicador, ind.formula ?? '', ind.meta ?? '', ind.cliente ?? '']),
      headStyles: { fillColor: DARK, fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  } else {
    doc.setFontSize(8); doc.text('[ Por completar ]', 14, y); y += 10
  }

  // Pie de página en todas las páginas
  const totalPaginas = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setDrawColor(...GOLD)
    doc.line(14, 285, 196, 285)
    doc.setTextColor(90, 113, 132); doc.setFontSize(7)
    doc.text('MINDTALENT · Manual de Puestos por Competencias · Metodología MDT — Ministerio de Trabajo Ecuador', 14, 290)
    doc.text(`Pág. ${i} / ${totalPaginas}  ·  Generado: ${new Date().toLocaleDateString('es-EC')}`, 196, 290, { align: 'right' })
  }

  const nombreArchivo = `Ficha-${puesto.nombre_puesto.replace(/\s+/g, '-')}-${puesto.fecha ?? 'sin-fecha'}.pdf`
  doc.save(nombreArchivo)
}

export interface Indicador {
  id: string
  nombre: string
  formula: string
  categoria: 'financiero' | 'satisfaccion' | 'ventas' | 'procesos' | 'rrhh'
  meta_referencia: string
}

export const INDICADORES: Indicador[] = [
  // Financieros
  { id: 'F1', categoria: 'financiero', nombre: 'Cumplimiento de presupuesto',     formula: '(Gasto ejecutado / Presupuesto asignado) × 100',                              meta_referencia: '≤ 100%' },
  { id: 'F2', categoria: 'financiero', nombre: 'Reducción de costos operativos',  formula: '((Costo anterior − Costo actual) / Costo anterior) × 100',                    meta_referencia: '≥ 5%' },
  { id: 'F3', categoria: 'financiero', nombre: 'ROI de capacitación',             formula: '(Beneficios generados − Costo capacitación) / Costo capacitación × 100',      meta_referencia: '≥ 100%' },
  { id: 'F4', categoria: 'financiero', nombre: 'Costo por unidad producida',      formula: 'Costo total / Unidades producidas',                                            meta_referencia: 'Según benchmark sector' },
  { id: 'F5', categoria: 'financiero', nombre: 'Índice de rentabilidad',          formula: '(Ingresos − Costos) / Ingresos × 100',                                        meta_referencia: '≥ 15%' },
  // Satisfacción
  { id: 'S1', categoria: 'satisfaccion', nombre: 'Índice de satisfacción del cliente',    formula: '(Clientes satisfechos / Total clientes encuestados) × 100',             meta_referencia: '≥ 85%' },
  { id: 'S2', categoria: 'satisfaccion', nombre: 'Net Promoter Score (NPS)',               formula: '% Promotores − % Detractores',                                          meta_referencia: '≥ 50' },
  { id: 'S3', categoria: 'satisfaccion', nombre: 'Tiempo de respuesta al cliente',         formula: 'Suma de tiempos de respuesta / Total solicitudes',                       meta_referencia: '≤ 24 horas' },
  { id: 'S4', categoria: 'satisfaccion', nombre: 'Tasa de resolución en primer contacto',  formula: '(Casos resueltos en 1er contacto / Total casos) × 100',                  meta_referencia: '≥ 80%' },
  { id: 'S5', categoria: 'satisfaccion', nombre: 'Índice de reclamos',                    formula: '(N° reclamos / Total transacciones) × 100',                              meta_referencia: '≤ 2%' },
  // Ventas
  { id: 'V1', categoria: 'ventas', nombre: 'Cumplimiento de meta de ventas', formula: '(Ventas reales / Meta de ventas) × 100',                                    meta_referencia: '≥ 100%' },
  { id: 'V2', categoria: 'ventas', nombre: 'Tasa de conversión',             formula: '(Clientes ganados / Prospectos contactados) × 100',                         meta_referencia: '≥ 20%' },
  { id: 'V3', categoria: 'ventas', nombre: 'Ticket promedio',                formula: 'Ingresos totales / Número de transacciones',                                meta_referencia: 'Crecimiento ≥ 10% anual' },
  { id: 'V4', categoria: 'ventas', nombre: 'Ciclo de ventas',                formula: 'Días promedio desde primer contacto hasta cierre',                          meta_referencia: 'Reducción ≥ 15%' },
  { id: 'V5', categoria: 'ventas', nombre: 'Retención de clientes',          formula: '(Clientes activos fin de período / Clientes inicio) × 100',                 meta_referencia: '≥ 85%' },
  // Procesos
  { id: 'P1', categoria: 'procesos', nombre: 'Cumplimiento de plazos',      formula: '(Tareas entregadas a tiempo / Total tareas) × 100',                         meta_referencia: '≥ 90%' },
  { id: 'P2', categoria: 'procesos', nombre: 'Índice de errores',           formula: '(Errores detectados / Total unidades procesadas) × 100',                    meta_referencia: '≤ 1%' },
  { id: 'P3', categoria: 'procesos', nombre: 'Productividad',               formula: 'Unidades producidas / Horas trabajadas',                                    meta_referencia: 'Crecimiento ≥ 5%' },
  { id: 'P4', categoria: 'procesos', nombre: 'Tiempo de ciclo del proceso', formula: 'Tiempo total desde inicio hasta fin del proceso',                            meta_referencia: 'Reducción ≥ 20%' },
  { id: 'P5', categoria: 'procesos', nombre: 'Tasa de reproceso',           formula: '(Trabajos reprocesados / Total trabajos) × 100',                            meta_referencia: '≤ 3%' },
  { id: 'P6', categoria: 'procesos', nombre: 'Disponibilidad de equipos',   formula: '(Horas disponibles / Horas programadas) × 100',                            meta_referencia: '≥ 95%' },
  { id: 'P7', categoria: 'procesos', nombre: 'Cumplimiento de auditorías',  formula: '(No conformidades cerradas / Total no conformidades) × 100',               meta_referencia: '100% en plazo' },
  { id: 'P8', categoria: 'procesos', nombre: 'Índice de digitalización',    formula: '(Procesos digitalizados / Total procesos) × 100',                          meta_referencia: '≥ 70%' },
  // RRHH
  { id: 'R1', categoria: 'rrhh', nombre: 'Índice de ausentismo',                  formula: '(Días de ausencia / Días laborables) × 100',                            meta_referencia: '≤ 3%' },
  { id: 'R2', categoria: 'rrhh', nombre: 'Rotación de personal',                  formula: '(Bajas del período / Promedio empleados) × 100',                        meta_referencia: '≤ 5% anual' },
  { id: 'R3', categoria: 'rrhh', nombre: 'Cumplimiento del plan de capacitación', formula: '(Horas ejecutadas / Horas planificadas) × 100',                         meta_referencia: '≥ 90%' },
  { id: 'R4', categoria: 'rrhh', nombre: 'Satisfacción del empleado',             formula: '(Empleados satisfechos / Total encuestados) × 100',                     meta_referencia: '≥ 75%' },
  { id: 'R5', categoria: 'rrhh', nombre: 'Tiempo promedio de contratación',       formula: 'Días desde solicitud hasta ingreso del nuevo colaborador',               meta_referencia: '≤ 30 días' },
  { id: 'R6', categoria: 'rrhh', nombre: 'Cobertura de evaluación 360°',          formula: '(Evaluados / Total colaboradores elegibles) × 100',                     meta_referencia: '100%' },
  { id: 'R7', categoria: 'rrhh', nombre: 'Cumplimiento de PDI',                   formula: '(Compromisos PDI cumplidos / Total compromisos) × 100',                  meta_referencia: '≥ 80%' },
  { id: 'R8', categoria: 'rrhh', nombre: 'Índice de clima laboral',               formula: 'Promedio instrumento equivalente (escala 1–5)',                          meta_referencia: '≥ 3.50' },
]

// Motor de cálculo de Nómina Ecuador — fórmulas exactas validadas contra
// Plantilla_Nomina_Ecuador_2026.xlsm (ver kit-nomina-ecuador-mindtalent skill).

export type TramoIR = {
  desde: number
  hasta: number
  impuesto_fraccion: number
  porcentaje_excedente: number
}

export type ParametrosLegales = {
  anio: number
  sbu: number
  aporte_personal: number
  aporte_patronal: number
  fondos_reserva: number
  factor_decimo3: number
  factor_decimo4: number
  factor_vacaciones: number
  tabla_ir: TramoIR[]
}

export type NovedadesEntrada = {
  diasTrabajados: number
  horasSuplementarias: number
  horasExtraordinarias: number
  comisiones: number
  bonos: number
  anticipos: number
  prestamoIess: number
  otrosDescuentos: number
}

export type EmpleadoParaCalculo = {
  sueldoNominal: number
  fondosReservaActivo: boolean
}

export type ResultadoNomina = {
  sueldoGanado: number
  valorHorasSuplementarias: number
  valorHorasExtraordinarias: number
  totalIngresos: number
  aporteIessPersonal: number
  impuestoRenta: number
  totalDescuentos: number
  liquidoRecibir: number
  aportePatronal: number
  fondosReserva: number
  costoEmpresa: number
  provisionDecimo3: number
  provisionDecimo4: number
  provisionVacaciones: number
}

const DIAS_BASE_MES = 30
const HORAS_BASE_MES = 240 // 30 días × 8 horas

export function sueldoGanado(sueldoNominal: number, diasTrabajados: number): number {
  return sueldoNominal * (diasTrabajados / DIAS_BASE_MES)
}

export function valorHoraSuplementaria(sueldoNominal: number): number {
  return (sueldoNominal / HORAS_BASE_MES) * 1.5
}

export function valorHoraExtraordinaria(sueldoNominal: number): number {
  return (sueldoNominal / HORAS_BASE_MES) * 2.0
}

export function aporteIessPersonal(totalIngresos: number, tasaPersonal: number): number {
  return totalIngresos * tasaPersonal
}

export function aportePatronal(totalIngresos: number, tasaPatronal: number): number {
  return totalIngresos * tasaPatronal
}

export function fondosReserva(totalIngresos: number, tasaFondos: number, activo: boolean): number {
  return activo ? totalIngresos * tasaFondos : 0
}

export function provisionDecimoTercero(totalIngresos: number, factorDecimo3: number): number {
  return totalIngresos * factorDecimo3
}

export function provisionDecimoCuarto(sbu: number): number {
  return sbu / 12
}

export function provisionVacaciones(totalIngresos: number, factorVacaciones: number): number {
  return totalIngresos * factorVacaciones
}

// Impuesto a la Renta: anualiza el ingreso gravado mensual (total_ingresos -
// aporte IESS personal) × 12, busca el tramo de la tabla SRI y calcula el
// impuesto anual; el resultado se vuelve a mensualizar (÷12).
export function impuestoRentaMensual(
  totalIngresosMensual: number,
  aporteIessPersonalMensual: number,
  tablaIR: TramoIR[]
): number {
  const baseAnual = (totalIngresosMensual - aporteIessPersonalMensual) * 12
  if (baseAnual <= 0) return 0

  const tramo = [...tablaIR].reverse().find(t => baseAnual >= t.desde)
  if (!tramo) return 0

  const impuestoAnual = tramo.impuesto_fraccion + (baseAnual - tramo.desde) * tramo.porcentaje_excedente
  return Math.max(0, impuestoAnual / 12)
}

export function calcularNomina(
  empleado: EmpleadoParaCalculo,
  novedades: NovedadesEntrada,
  parametros: ParametrosLegales
): ResultadoNomina {
  const sGanado = sueldoGanado(empleado.sueldoNominal, novedades.diasTrabajados)
  const valorSuplementaria = valorHoraSuplementaria(empleado.sueldoNominal) * novedades.horasSuplementarias
  const valorExtraordinaria = valorHoraExtraordinaria(empleado.sueldoNominal) * novedades.horasExtraordinarias

  const totalIngresos = sGanado + valorSuplementaria + valorExtraordinaria + novedades.comisiones + novedades.bonos

  const aportePersonal = aporteIessPersonal(totalIngresos, parametros.aporte_personal)
  const ir = impuestoRentaMensual(totalIngresos, aportePersonal, parametros.tabla_ir)

  const totalDescuentos = aportePersonal + ir + novedades.anticipos + novedades.prestamoIess + novedades.otrosDescuentos
  const liquidoRecibir = totalIngresos - totalDescuentos

  const aportePatr = aportePatronal(totalIngresos, parametros.aporte_patronal)
  const fReserva = fondosReserva(totalIngresos, parametros.fondos_reserva, empleado.fondosReservaActivo)
  const costoEmpresa = totalIngresos + aportePatr + fReserva

  return {
    sueldoGanado: sGanado,
    valorHorasSuplementarias: valorSuplementaria,
    valorHorasExtraordinarias: valorExtraordinaria,
    totalIngresos,
    aporteIessPersonal: aportePersonal,
    impuestoRenta: ir,
    totalDescuentos,
    liquidoRecibir,
    aportePatronal: aportePatr,
    fondosReserva: fReserva,
    costoEmpresa,
    provisionDecimo3: provisionDecimoTercero(totalIngresos, parametros.factor_decimo3),
    provisionDecimo4: provisionDecimoCuarto(parametros.sbu),
    provisionVacaciones: provisionVacaciones(totalIngresos, parametros.factor_vacaciones),
  }
}

// ── Liquidaciones ────────────────────────────────────────────────────────
// AVISO: son cálculos de referencia para el consultor, basados en las reglas
// generales del Código del Trabajo (régimen general). No cubren casos
// especiales (dirigentes sindicales, discapacidad, adultos mayores, fuero
// de maternidad/paternidad, etc.) ni sustituyen la revisión de un abogado
// laboral o contador antes de pagar una liquidación real.

export type CausalLiquidacion = 'renuncia_voluntaria' | 'despido_intempestivo' | 'mutuo_acuerdo' | 'visto_bueno'

export function aniosServicio(fechaIngreso: Date, fechaLiquidacion: Date): number {
  const msPorAnio = 1000 * 60 * 60 * 24 * 365.25
  return Math.max(0, (fechaLiquidacion.getTime() - fechaIngreso.getTime()) / msPorAnio)
}

// Bonificación por desahucio (renuncia con aviso previo): 25% de la última
// remuneración por cada año de servicio, sin tope legal de años.
export function bonificacionDesahucio(sueldoNominal: number, anios: number): number {
  return 0.25 * sueldoNominal * anios
}

// Indemnización por despido intempestivo (Art. 188 Código del Trabajo):
// hasta 3 años de servicio = 3 remuneraciones; más de 3 años = 1 remuneración
// por cada año completo (fracción ≥ 6 meses cuenta como año completo),
// con tope de 25 remuneraciones.
export function indemnizacionDespidoIntempestivo(sueldoNominal: number, anios: number): number {
  if (anios <= 3) return 3 * sueldoNominal
  const enteros = Math.floor(anios)
  const fraccion = anios - enteros
  const meses = fraccion >= 0.5 ? enteros + 1 : enteros
  return sueldoNominal * Math.min(25, Math.max(3, meses))
}

// ── Vacaciones ────────────────────────────────────────────────────────────
// 15 días anuales desde el primer año de servicio = 1.25 días por mes
// completo trabajado (Art. 69 Código del Trabajo, régimen general sin
// incremento por antigüedad a partir del 5to año, que se maneja aparte
// si el consultor lo necesita).

function mesesCompletosTranscurridos(desde: Date, hasta: Date): number {
  let meses = (hasta.getFullYear() - desde.getFullYear()) * 12 + (hasta.getMonth() - desde.getMonth())
  if (hasta.getDate() < desde.getDate()) meses -= 1
  return Math.max(0, meses)
}

export function diasVacacionesAcumulados(fechaIngreso: Date, fechaCorte: Date): number {
  return mesesCompletosTranscurridos(fechaIngreso, fechaCorte) * 1.25
}

export type ResultadoLiquidacion = {
  aniosServicio: number
  proporcionalDecimo3: number
  proporcionalDecimo4: number
  vacacionesNoGozadas: number
  bonificacionDesahucio: number
  indemnizacionDespido: number
  total: number
}

export function calcularLiquidacion(
  causal: CausalLiquidacion,
  sueldoNominal: number,
  fechaIngreso: Date,
  fechaLiquidacion: Date,
  diasVacacionesPendientes: number,
  mesesTranscurridosDecimo3: number, // desde el 1-dic anterior, 0 a 12
  mesesTranscurridosDecimo4: number, // desde el inicio del periodo escolar vigente, 0 a 12
  parametros: ParametrosLegales
): ResultadoLiquidacion {
  const anios = aniosServicio(fechaIngreso, fechaLiquidacion)

  const proporcionalDecimo3 = sueldoNominal * (mesesTranscurridosDecimo3 / 12)
  const proporcionalDecimo4 = parametros.sbu * (mesesTranscurridosDecimo4 / 12)
  const vacacionesNoGozadas = (sueldoNominal / 30) * diasVacacionesPendientes

  const desahucio = causal === 'renuncia_voluntaria' ? bonificacionDesahucio(sueldoNominal, anios) : 0
  const indemnizacion = causal === 'despido_intempestivo' ? indemnizacionDespidoIntempestivo(sueldoNominal, anios) : 0

  const total = proporcionalDecimo3 + proporcionalDecimo4 + vacacionesNoGozadas + desahucio + indemnizacion

  return {
    aniosServicio: anios,
    proporcionalDecimo3,
    proporcionalDecimo4,
    vacacionesNoGozadas,
    bonificacionDesahucio: desahucio,
    indemnizacionDespido: indemnizacion,
    total,
  }
}

// ── Utilidades ────────────────────────────────────────────────────────────
// 15% de la utilidad líquida de la empresa: 10% repartido en partes iguales
// entre todos los trabajadores, 5% en proporción a cargas familiares.
// utilidadLiquidaEmpresa se ingresa manualmente (viene de la declaración de
// impuesto a la renta de la empresa, no de datos que lleve este sistema).

export type EmpleadoParaUtilidades = {
  id: string
  nombre: string
  cargasFamiliares: number
}

export type ReparticionUtilidad = {
  empleadoId: string
  nombre: string
  montoIgual: number
  montoCargas: number
  total: number
}

export type ResultadoUtilidades = {
  totalUtilidades: number
  pool10Porciento: number
  pool5Porciento: number
  reparticiones: ReparticionUtilidad[]
}

export function calcularUtilidades(
  empleados: EmpleadoParaUtilidades[],
  utilidadLiquidaEmpresa: number
): ResultadoUtilidades {
  const pool10 = utilidadLiquidaEmpresa * 0.10
  const pool5 = utilidadLiquidaEmpresa * 0.05
  const n = empleados.length

  const montoIgualPorEmpleado = n > 0 ? pool10 / n : 0
  const totalCargas = empleados.reduce((acc, e) => acc + e.cargasFamiliares, 0)
  const montoPorCarga = totalCargas > 0 ? pool5 / totalCargas : 0

  const reparticiones: ReparticionUtilidad[] = empleados.map(e => {
    const montoCargas = e.cargasFamiliares * montoPorCarga
    return {
      empleadoId: e.id,
      nombre: e.nombre,
      montoIgual: montoIgualPorEmpleado,
      montoCargas,
      total: montoIgualPorEmpleado + montoCargas,
    }
  })

  return {
    totalUtilidades: utilidadLiquidaEmpresa * 0.15,
    pool10Porciento: pool10,
    pool5Porciento: pool5,
    reparticiones,
  }
}

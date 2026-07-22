'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthGuard } from '@/lib/useAuthGuard'
import { calcularNomina, resultadoDesdeGuardado, type ParametrosLegales, type ResultadoNomina } from '@/lib/nomina-scoring'
import { exportarRolPDF } from '@/lib/exportar-rol-pdf'

type EmpleadoNomina = {
  id: string
  empresa_id: string
  nombre: string
  cedula: string | null
  cargo: string | null
  area: string | null
  sueldo_nominal: number
  fondos_reserva_activo: boolean
}

type Novedades = {
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

export default function RolIndividual() {
  const router = useRouter()
  const params = useParams<{ periodo: string; empleadoId: string }>()
  const { periodo, empleadoId } = params
  const { verificando } = useAuthGuard()

  const [empleado, setEmpleado] = useState<EmpleadoNomina | null>(null)
  const [empresaNombre, setEmpresaNombre] = useState('')
  const [novedades, setNovedades] = useState<Novedades | null>(null)
  const [existeGuardado, setExisteGuardado] = useState(false)
  const [estadoRol, setEstadoRol] = useState<'borrador' | 'aprobado' | 'pagado'>('borrador')
  // Resultado congelado tal cual se guardó, solo cuando estadoRol es
  // 'aprobado' o 'pagado'. Si es null, se calcula en vivo más abajo.
  const [resultadoGuardado, setResultadoGuardado] = useState<ResultadoNomina | null>(null)
  const [parametros, setParametros] = useState<ParametrosLegales | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const anio = Number(periodo.split('-')[0])

    Promise.all([
      supabase.from('empleados_nomina').select('*').eq('id', empleadoId).single(),
      supabase.from('nomina_mensual').select('*').eq('empleado_id', empleadoId).eq('periodo', periodo).maybeSingle(),
      supabase.from('parametros_legales').select('*').eq('anio', anio).maybeSingle(),
    ]).then(async ([{ data: emp }, { data: nomina }, { data: param }]) => {
      if (emp) {
        setEmpleado(emp)
        const { data: empresa } = await supabase.from('empresas_mdt').select('nombre').eq('id', emp.empresa_id).single()
        setEmpresaNombre(empresa?.nombre ?? '')
      }
      if (nomina) {
        setExisteGuardado(true)
        const estado = (nomina.estado ?? 'borrador') as 'borrador' | 'aprobado' | 'pagado'
        setEstadoRol(estado)
        setNovedades({
          diasTrabajados: nomina.dias_trabajados,
          horasSuplementarias: nomina.horas_suplementarias,
          horasExtraordinarias: nomina.horas_extraordinarias,
          comisiones: nomina.comisiones,
          bonos: nomina.bonos,
          anticipos: nomina.anticipos,
          prestamoIess: nomina.prestamo_iess,
          otrosDescuentos: nomina.otros_descuentos,
        })
        // Aprobado/pagado: se congela el resultado tal cual se guardó, nunca
        // se recalcula con el sueldo o parámetros vigentes hoy.
        if (estado === 'aprobado' || estado === 'pagado') {
          setResultadoGuardado(resultadoDesdeGuardado(nomina))
        }
      } else {
        setNovedades({
          diasTrabajados: 30, horasSuplementarias: 0, horasExtraordinarias: 0,
          comisiones: 0, bonos: 0, anticipos: 0, prestamoIess: 0, otrosDescuentos: 0,
        })
      }
      if (param) {
        setParametros({
          anio: param.anio, sbu: param.sbu, aporte_personal: param.aporte_personal,
          aporte_patronal: param.aporte_patronal, fondos_reserva: param.fondos_reserva,
          factor_decimo3: param.factor_decimo3, factor_decimo4: param.factor_decimo4,
          factor_vacaciones: param.factor_vacaciones, tabla_ir: param.tabla_ir,
        })
      }
      setLoading(false)
    })
  }, [periodo, empleadoId])

  if (verificando || loading) return null

  if (!empleado) {
    return <div style={{ padding: 40, color: '#b91c1c' }}>Empleado no encontrado.</div>
  }

  if (!parametros) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: '2rem' }}>
        <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '1rem 1.25rem', color: '#b91c1c', fontSize: 13, maxWidth: 600 }}>
          No hay parámetros legales configurados para el año {periodo.split('-')[0]}. Ve a Nómina → Parámetros legales.
        </div>
      </div>
    )
  }

  if (!novedades) return null

  // Aprobado/pagado: usar el resultado congelado. Solo un borrador se calcula
  // en vivo con el sueldo y los parámetros legales vigentes.
  const resultado: ResultadoNomina = resultadoGuardado ?? calcularNomina(
    { sueldoNominal: empleado.sueldo_nominal, fondosReservaActivo: empleado.fondos_reserva_activo },
    novedades,
    parametros
  )

  // El PDF solo lleva marca de agua BORRADOR si el rol no está guardado o
  // sigue en estado 'borrador'; una vez aprobado o pagado, se exporta limpio.
  const esBorrador = !existeGuardado || estadoRol === 'borrador'

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <div style={{ background: '#1a2035', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push(`/nomina/periodo/${periodo}`)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
            ← Rol de nómina {periodo}
          </button>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{empleado.nombre}</span>
          {existeGuardado && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
              background: estadoRol === 'pagado' ? 'rgba(45,106,79,0.25)' : estadoRol === 'aprobado' ? 'rgba(255,255,255,0.15)' : 'rgba(201,168,76,0.25)',
              color: estadoRol === 'pagado' ? '#7ee6b0' : estadoRol === 'aprobado' ? 'white' : '#e8cf8a',
            }}>
              {estadoRol}
            </span>
          )}
        </div>
        <button
          onClick={() => exportarRolPDF(
            { nombre: empleado.nombre, cedula: empleado.cedula, cargo: empleado.cargo, area: empleado.area },
            novedades, resultado, periodo, empresaNombre, esBorrador
          )}
          style={{ background: '#c9a84c', color: '#1a2035', padding: '.45rem 1.1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          Exportar PDF
        </button>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {!existeGuardado && (
          <div style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)', borderRadius: 8, padding: '.75rem 1rem', color: '#7a6020', fontSize: 12, marginBottom: 20 }}>
            Este rol aún no ha sido guardado en el periodo {periodo} (se está mostrando con novedades por defecto). Ve a la grilla del rol de nómina para capturar novedades reales y guardarlo. El PDF se marcará como <b>BORRADOR</b>.
          </div>
        )}

        {existeGuardado && estadoRol === 'borrador' && (
          <div style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)', borderRadius: 8, padding: '.75rem 1rem', color: '#7a6020', fontSize: 12, marginBottom: 20 }}>
            Este rol está guardado pero aún no ha sido aprobado. Ve a la grilla del rol de nómina para aprobarlo. El PDF se marcará como <b>BORRADOR</b> mientras tanto.
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2035', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Datos del empleado
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: '#374151', marginBottom: 20 }}>
            <div><b>Cargo:</b> {empleado.cargo || '[ Por completar ]'}</div>
            <div><b>Área:</b> {empleado.area || '[ Por completar ]'}</div>
            <div><b>Cédula:</b> {empleado.cedula || '[ Por completar ]'}</div>
            <div><b>Días trabajados:</b> {novedades.diasTrabajados}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2035', marginBottom: 8, textTransform: 'uppercase' }}>Ingresos</div>
              <Fila label="Sueldo ganado" valor={resultado.sueldoGanado} />
              <Fila label="Horas suplementarias" valor={resultado.valorHorasSuplementarias} />
              <Fila label="Horas extraordinarias" valor={resultado.valorHorasExtraordinarias} />
              <Fila label="Comisiones / Bonos" valor={novedades.comisiones + novedades.bonos} />
              <Fila label="TOTAL INGRESOS" valor={resultado.totalIngresos} negrita />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2035', marginBottom: 8, textTransform: 'uppercase' }}>Descuentos</div>
              <Fila label="Aporte IESS personal" valor={resultado.aporteIessPersonal} />
              <Fila label="Anticipos" valor={novedades.anticipos} />
              <Fila label="Préstamo IESS" valor={novedades.prestamoIess} />
              <Fila label="Otros descuentos" valor={novedades.otrosDescuentos} />
              <Fila label="Impuesto a la Renta" valor={resultado.impuestoRenta} />
              <Fila label="TOTAL DESCUENTOS" valor={resultado.totalDescuentos} negrita />
            </div>
          </div>

          <div style={{ background: '#c9a84c', borderRadius: 6, padding: '.75rem 1rem', marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: '#1a2035', fontSize: 14 }}>LÍQUIDO A RECIBIR</span>
            <span style={{ fontWeight: 800, color: '#1a2035', fontSize: 16 }}>{money(resultado.liquidoRecibir)}</span>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2035', margin: '20px 0 8px', textTransform: 'uppercase' }}>
            Informativo — costo patronal y provisiones (no afecta el líquido)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <Fila label="Aporte patronal IESS" valor={resultado.aportePatronal} />
              <Fila label="Fondos de reserva" valor={resultado.fondosReserva} />
              <Fila label="Costo total empresa" valor={resultado.costoEmpresa} />
            </div>
            <div>
              <Fila label="Provisión décimo 3ro" valor={resultado.provisionDecimo3} />
              <Fila label="Provisión décimo 4to" valor={resultado.provisionDecimo4} />
              <Fila label="Provisión vacaciones" valor={resultado.provisionVacaciones} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Fila({ label, valor, negrita }: { label: string; valor: number; negrita?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', padding: '.25rem 0', fontWeight: negrita ? 800 : 400, borderTop: negrita ? '1px solid #e5e7eb' : 'none' }}>
      <span>{label}</span>
      <span>{money(valor)}</span>
    </div>
  )
}

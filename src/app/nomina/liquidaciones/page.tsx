'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthGuard } from '@/lib/useAuthGuard'
import { calcularLiquidacion, type CausalLiquidacion, type ParametrosLegales, type ResultadoLiquidacion } from '@/lib/nomina-scoring'
import { exportarLiquidacionPDF } from '@/lib/exportar-liquidacion-pdf'

type Empresa = { id: string; nombre: string }

type EmpleadoNomina = {
  id: string
  nombre: string
  cedula: string | null
  cargo: string | null
  sueldo_nominal: number
  fecha_ingreso: string | null
}

const inputStyle = { padding: '.4rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }

const CAUSALES: { value: CausalLiquidacion; label: string }[] = [
  { value: 'renuncia_voluntaria', label: 'Renuncia voluntaria (desahucio)' },
  { value: 'despido_intempestivo', label: 'Despido intempestivo' },
  { value: 'mutuo_acuerdo', label: 'Mutuo acuerdo' },
  { value: 'visto_bueno', label: 'Visto bueno' },
]

const money = (n: number) => `$${n.toFixed(2)}`

export default function Liquidaciones() {
  const router = useRouter()
  const { verificando } = useAuthGuard()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const [empleados, setEmpleados] = useState<EmpleadoNomina[]>([])
  const [empleadoId, setEmpleadoId] = useState('')
  const [parametros, setParametros] = useState<ParametrosLegales | null>(null)

  const [causal, setCausal] = useState<CausalLiquidacion>('renuncia_voluntaria')
  const [fechaLiquidacion, setFechaLiquidacion] = useState(new Date().toISOString().slice(0, 10))
  const [diasVacaciones, setDiasVacaciones] = useState('0')
  const [mesesDecimo3, setMesesDecimo3] = useState('0')
  const [mesesDecimo4, setMesesDecimo4] = useState('0')

  useEffect(() => {
    supabase.from('empresas_mdt').select('id, nombre').order('nombre').then(({ data }) => setEmpresas(data ?? []))
  }, [])

  useEffect(() => {
    if (!empresaSeleccionada) { setEmpleados([]); return }
    supabase.from('empleados_nomina').select('id, nombre, cedula, cargo, sueldo_nominal, fecha_ingreso').eq('empresa_id', empresaSeleccionada).order('nombre')
      .then(({ data }) => setEmpleados(data ?? []))
  }, [empresaSeleccionada])

  useEffect(() => {
    const anio = new Date(fechaLiquidacion).getFullYear()
    supabase.from('parametros_legales').select('*').eq('anio', anio).maybeSingle().then(({ data }) => {
      setParametros(data ? {
        anio: data.anio, sbu: data.sbu, aporte_personal: data.aporte_personal,
        aporte_patronal: data.aporte_patronal, fondos_reserva: data.fondos_reserva,
        factor_decimo3: data.factor_decimo3, factor_decimo4: data.factor_decimo4,
        factor_vacaciones: data.factor_vacaciones, tabla_ir: data.tabla_ir,
      } : null)
    })
  }, [fechaLiquidacion])

  const empleado = empleados.find(e => e.id === empleadoId)

  let resultado: ResultadoLiquidacion | null = null
  if (empleado && parametros && empleado.fecha_ingreso) {
    resultado = calcularLiquidacion(
      causal,
      empleado.sueldo_nominal,
      new Date(empleado.fecha_ingreso),
      new Date(fechaLiquidacion),
      Number(diasVacaciones) || 0,
      Number(mesesDecimo3) || 0,
      Number(mesesDecimo4) || 0,
      parametros
    )
  }

  if (verificando) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <div style={{ background: '#1a2035', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/nomina')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
          ← Nómina
        </button>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Liquidaciones</span>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '.9rem 1.1rem', color: '#8a1c1c', fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>
          <b>Aviso:</b> este cálculo es de referencia, basado en las reglas generales del régimen general del Código del Trabajo. No cubre casos especiales (fuero de maternidad/paternidad, discapacidad, adultos mayores, dirigentes sindicales). Valídalo con un abogado laboral o contador antes de pagar una liquidación real. El PDF generado es un borrador, no un acta de finiquito válida ante el Ministerio de Trabajo (SUT).
        </div>

        <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select value={empresaSeleccionada} onChange={e => { setEmpresaSeleccionada(e.target.value); setEmpleadoId('') }} style={inputStyle}>
                <option value=''>Empresa…</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
              <select value={empleadoId} onChange={e => setEmpleadoId(e.target.value)} style={inputStyle} disabled={!empresaSeleccionada}>
                <option value=''>Empleado…</option>
                {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>

            {empleado && !empleado.fecha_ingreso && (
              <div style={{ color: '#b91c1c', fontSize: 12 }}>
                Este empleado no tiene fecha de ingreso registrada. Ve a Nómina → Empleados y complétala antes de calcular la liquidación.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={causal} onChange={e => setCausal(e.target.value as CausalLiquidacion)} style={{ ...inputStyle, width: 240 }}>
                {CAUSALES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <label style={{ fontSize: 12, color: '#6b7280' }}>Fecha liquidación:</label>
              <input type="date" value={fechaLiquidacion} onChange={e => setFechaLiquidacion(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Campo label="Días de vacaciones pendientes">
                <input type="number" value={diasVacaciones} onChange={e => setDiasVacaciones(e.target.value)} style={{ ...inputStyle, width: 90 }} />
              </Campo>
              <Campo label="Meses transcurridos décimo 3ro (desde 1-dic)">
                <input type="number" value={mesesDecimo3} onChange={e => setMesesDecimo3(e.target.value)} style={{ ...inputStyle, width: 90 }} />
              </Campo>
              <Campo label="Meses transcurridos décimo 4to (periodo escolar)">
                <input type="number" value={mesesDecimo4} onChange={e => setMesesDecimo4(e.target.value)} style={{ ...inputStyle, width: 90 }} />
              </Campo>
            </div>
          </div>

          {!parametros && empleadoId && (
            <div style={{ marginTop: 16, color: '#b91c1c', fontSize: 12 }}>
              No hay parámetros legales configurados para {new Date(fechaLiquidacion).getFullYear()}.
            </div>
          )}

          {resultado && (
            <div style={{ marginTop: 24, borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
                Años de servicio: <b>{resultado.aniosServicio.toFixed(2)}</b>
              </div>
              <Fila label="Proporcional décimo tercero" valor={resultado.proporcionalDecimo3} />
              <Fila label="Proporcional décimo cuarto" valor={resultado.proporcionalDecimo4} />
              <Fila label="Vacaciones no gozadas" valor={resultado.vacacionesNoGozadas} />
              {causal === 'renuncia_voluntaria' && <Fila label="Bonificación por desahucio (25% × año × años servicio)" valor={resultado.bonificacionDesahucio} />}
              {causal === 'despido_intempestivo' && <Fila label="Indemnización despido intempestivo" valor={resultado.indemnizacionDespido} />}

              <div style={{ background: '#c9a84c', borderRadius: 6, padding: '.75rem 1rem', marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 800, color: '#1a2035' }}>TOTAL LIQUIDACIÓN</span>
                <span style={{ fontWeight: 800, color: '#1a2035' }}>{money(resultado.total)}</span>
              </div>

              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
                No incluye fondos de reserva pendientes: revisa el acumulado directamente en el portal del IESS, este sistema no lleva ese histórico.
              </div>

              <button
                onClick={() => empleado && exportarLiquidacionPDF(
                  { nombre: empleado.nombre, cedula: empleado.cedula, cargo: empleado.cargo },
                  empresas.find(e => e.id === empresaSeleccionada)?.nombre ?? '',
                  causal, fechaLiquidacion, resultado
                )}
                style={{ marginTop: 16, background: '#1a2035', color: 'white', padding: '.6rem 1.5rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                Exportar PDF (borrador)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

function Fila({ label, valor }: { label: string; valor: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', padding: '.3rem 0' }}>
      <span>{label}</span>
      <span>{money(valor)}</span>
    </div>
  )
}

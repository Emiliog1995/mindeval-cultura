'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthGuard } from '@/lib/useAuthGuard'
import { diasVacacionesAcumulados } from '@/lib/nomina-scoring'

type Empresa = { id: string; nombre: string }

type EmpleadoNomina = {
  id: string
  nombre: string
  fecha_ingreso: string | null
}

type SaldoVacaciones = {
  empleadoId: string
  diasAcumulados: number
  diasTomados: number
  diasPendientes: number
}

const inputStyle = { padding: '.4rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }

export default function Vacaciones() {
  const router = useRouter()
  const { verificando } = useAuthGuard()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const [empleados, setEmpleados] = useState<EmpleadoNomina[]>([])
  const [saldos, setSaldos] = useState<Record<string, SaldoVacaciones>>({})
  const [loading, setLoading] = useState(false)
  const [registrando, setRegistrando] = useState<string | null>(null)
  const [diasARegistrar, setDiasARegistrar] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.from('empresas_mdt').select('id, nombre').order('nombre').then(({ data }) => setEmpresas(data ?? []))
  }, [])

  useEffect(() => {
    if (!empresaSeleccionada) { setEmpleados([]); setSaldos({}); return }
    setLoading(true)

    Promise.all([
      supabase.from('empleados_nomina').select('id, nombre, fecha_ingreso').eq('empresa_id', empresaSeleccionada).eq('estado', 'activo').order('nombre'),
      supabase.from('vacaciones_empleado').select('*'),
    ]).then(async ([{ data: emps }, { data: existentes }]) => {
      const listaEmpleados = emps ?? []
      setEmpleados(listaEmpleados)

      const hoy = new Date()
      const mapaExistentes = new Map((existentes ?? []).map(v => [v.empleado_id, v]))
      const nuevosSaldos: Record<string, SaldoVacaciones> = {}
      const upserts: {
        empleado_id: string
        dias_acumulados: number
        dias_tomados: number
        dias_pendientes: number
        ultimo_calculo: string
      }[] = []

      for (const emp of listaEmpleados) {
        const previo = mapaExistentes.get(emp.id)
        const diasTomados = previo?.dias_tomados ?? 0
        const diasAcumulados = emp.fecha_ingreso ? diasVacacionesAcumulados(new Date(emp.fecha_ingreso), hoy) : 0
        const diasPendientes = Math.max(0, diasAcumulados - diasTomados)

        nuevosSaldos[emp.id] = { empleadoId: emp.id, diasAcumulados, diasTomados, diasPendientes }
        upserts.push({
          empleado_id: emp.id,
          dias_acumulados: diasAcumulados,
          dias_tomados: diasTomados,
          dias_pendientes: diasPendientes,
          ultimo_calculo: hoy.toISOString().slice(0, 10),
        })
      }

      setSaldos(nuevosSaldos)
      if (upserts.length > 0) {
        await supabase.from('vacaciones_empleado').upsert(upserts, { onConflict: 'empleado_id' })
      }
      setLoading(false)
    })
  }, [empresaSeleccionada])

  async function registrarDiasTomados(empleadoId: string) {
    const dias = Number(diasARegistrar[empleadoId])
    if (!dias || dias <= 0) return
    setRegistrando(empleadoId)

    const saldo = saldos[empleadoId]
    const nuevoTomados = saldo.diasTomados + dias
    const nuevoPendientes = Math.max(0, saldo.diasAcumulados - nuevoTomados)

    const { error } = await supabase.from('vacaciones_empleado').upsert({
      empleado_id: empleadoId,
      dias_acumulados: saldo.diasAcumulados,
      dias_tomados: nuevoTomados,
      dias_pendientes: nuevoPendientes,
      ultimo_calculo: new Date().toISOString().slice(0, 10),
    }, { onConflict: 'empleado_id' })

    setRegistrando(null)
    if (!error) {
      setSaldos(prev => ({ ...prev, [empleadoId]: { ...saldo, diasTomados: nuevoTomados, diasPendientes: nuevoPendientes } }))
      setDiasARegistrar(prev => ({ ...prev, [empleadoId]: '' }))
    }
  }

  if (verificando) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <div style={{ background: '#1a2035', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/nomina')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
          ← Nómina
        </button>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Vacaciones</span>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)', borderRadius: 8, padding: '.9rem 1.1rem', color: '#7a6020', fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>
          15 días anuales desde el primer año de servicio, acumulados a razón de 1.25 días por mes completo trabajado. El acumulado se recalcula automáticamente cada vez que abres esta pantalla; los días tomados se registran manualmente.
        </div>

        <div style={{ marginBottom: 20 }}>
          <select value={empresaSeleccionada} onChange={e => setEmpresaSeleccionada(e.target.value)} style={inputStyle}>
            <option value=''>Selecciona una empresa…</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>

        {!empresaSeleccionada && (
          <div style={{ background: 'white', borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            Selecciona una empresa para ver los saldos de vacaciones.
          </div>
        )}

        {empresaSeleccionada && loading && <div style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</div>}

        {empresaSeleccionada && !loading && empleados.length === 0 && (
          <div style={{ background: 'white', borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            Esta empresa no tiene empleados activos.
          </div>
        )}

        {empresaSeleccionada && !loading && empleados.length > 0 && (
          <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1a2035', color: 'white' }}>
                  {['Empleado', 'Fecha ingreso', 'Días acumulados', 'Días tomados', 'Días pendientes', 'Registrar días tomados'].map(h => (
                    <th key={h} style={{ padding: '.5rem .75rem', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empleados.map((e, i) => {
                  const saldo = saldos[e.id]
                  return (
                    <tr key={e.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '.4rem .75rem', fontSize: 13, fontWeight: 600, color: '#1a2035' }}>{e.nombre}</td>
                      <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{e.fecha_ingreso || '[ Por completar ]'}</td>
                      <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{saldo ? saldo.diasAcumulados.toFixed(2) : '—'}</td>
                      <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{saldo ? saldo.diasTomados.toFixed(2) : '—'}</td>
                      <td style={{ padding: '.4rem .75rem', fontSize: 12, fontWeight: 700, color: saldo && saldo.diasPendientes > 15 ? '#b91c1c' : '#2d6a4f' }}>
                        {saldo ? saldo.diasPendientes.toFixed(2) : '—'}
                      </td>
                      <td style={{ padding: '.4rem .75rem', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="number"
                          value={diasARegistrar[e.id] ?? ''}
                          onChange={ev => setDiasARegistrar(prev => ({ ...prev, [e.id]: ev.target.value }))}
                          placeholder="días"
                          style={{ ...inputStyle, width: 70 }}
                        />
                        <button
                          onClick={() => registrarDiasTomados(e.id)}
                          disabled={registrando === e.id || !diasARegistrar[e.id]}
                          style={{ background: '#c9a84c', color: '#1a2035', padding: '.3rem .7rem', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, opacity: !diasARegistrar[e.id] ? 0.5 : 1 }}>
                          {registrando === e.id ? '…' : 'Registrar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

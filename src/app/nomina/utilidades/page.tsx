'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthGuard } from '@/lib/useAuthGuard'
import { calcularUtilidades, type ResultadoUtilidades } from '@/lib/nomina-scoring'

type Empresa = { id: string; nombre: string }

type EmpleadoNomina = {
  id: string
  nombre: string
  cargas_familiares: number
}

const inputStyle = { padding: '.4rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }
const money = (n: number) => `$${n.toFixed(2)}`

export default function Utilidades() {
  const router = useRouter()
  const { verificando } = useAuthGuard()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const [anio, setAnio] = useState(new Date().getFullYear() - 1)
  const [empleados, setEmpleados] = useState<EmpleadoNomina[]>([])
  const [utilidadLiquida, setUtilidadLiquida] = useState('')
  const [loading, setLoading] = useState(false)
  const [guardandoCargaId, setGuardandoCargaId] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('empresas_mdt').select('id, nombre').order('nombre').then(({ data }) => setEmpresas(data ?? []))
  }, [])

  useEffect(() => {
    if (!empresaSeleccionada) { setEmpleados([]); return }
    setLoading(true)
    supabase.from('empleados_nomina').select('id, nombre, cargas_familiares').eq('empresa_id', empresaSeleccionada).eq('estado', 'activo').order('nombre')
      .then(({ data }) => { setEmpleados(data ?? []); setLoading(false) })
  }, [empresaSeleccionada])

  async function actualizarCargas(id: string, valor: number) {
    setGuardandoCargaId(id)
    const { error } = await supabase.from('empleados_nomina').update({ cargas_familiares: valor }).eq('id', id)
    setGuardandoCargaId(null)
    if (!error) setEmpleados(prev => prev.map(e => e.id === id ? { ...e, cargas_familiares: valor } : e))
  }

  let resultado: ResultadoUtilidades | null = null
  if (empleados.length > 0 && Number(utilidadLiquida) > 0) {
    resultado = calcularUtilidades(
      empleados.map(e => ({ id: e.id, nombre: e.nombre, cargasFamiliares: e.cargas_familiares })),
      Number(utilidadLiquida)
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
        <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Utilidades</span>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)', borderRadius: 8, padding: '.9rem 1.1rem', color: '#7a6020', fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>
          15% de la utilidad líquida de la empresa: 10% repartido en partes iguales entre todos los trabajadores, 5% en proporción a cargas familiares. La utilidad líquida se obtiene de la declaración de impuesto a la renta de la empresa — ingrésala manualmente, este sistema no la calcula.
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={empresaSeleccionada} onChange={e => setEmpresaSeleccionada(e.target.value)} style={inputStyle}>
            <option value=''>Selecciona una empresa…</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={inputStyle}>
            {[0, 1, 2, 3].map(offset => {
              const a = new Date().getFullYear() - 1 - offset
              return <option key={a} value={a}>Ejercicio {a}</option>
            })}
          </select>
          <input
            type="number"
            value={utilidadLiquida}
            onChange={e => setUtilidadLiquida(e.target.value)}
            placeholder="Utilidad líquida de la empresa"
            style={{ ...inputStyle, width: 220 }}
          />
        </div>

        {!empresaSeleccionada && (
          <div style={{ background: 'white', borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            Selecciona una empresa para calcular el reparto de utilidades {anio}.
          </div>
        )}

        {empresaSeleccionada && loading && <div style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</div>}

        {empresaSeleccionada && !loading && empleados.length === 0 && (
          <div style={{ background: 'white', borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            Esta empresa no tiene empleados activos.
          </div>
        )}

        {empresaSeleccionada && !loading && empleados.length > 0 && (
          <>
            {resultado && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Total utilidades (15%)', valor: resultado.totalUtilidades, color: '#1a2035' },
                  { label: '10% partes iguales', valor: resultado.pool10Porciento, color: '#243447' },
                  { label: '5% por cargas familiares', valor: resultado.pool5Porciento, color: '#c9a84c' },
                ].map(k => (
                  <div key={k.label} style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.08)', borderLeft: `4px solid ${k.color}` }}>
                    <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{money(k.valor)}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1a2035', color: 'white' }}>
                    {['Empleado', 'Cargas familiares', '10% partes iguales', '5% por cargas', 'Total a recibir'].map(h => (
                      <th key={h} style={{ padding: '.5rem .75rem', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((e, i) => {
                    const rep = resultado?.reparticiones.find(r => r.empleadoId === e.id)
                    return (
                      <tr key={e.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '.4rem .75rem', fontSize: 13, fontWeight: 600, color: '#1a2035' }}>{e.nombre}</td>
                        <td style={{ padding: '.4rem .75rem' }}>
                          <input
                            type="number"
                            defaultValue={e.cargas_familiares}
                            onBlur={ev => actualizarCargas(e.id, Number(ev.target.value) || 0)}
                            disabled={guardandoCargaId === e.id}
                            style={{ ...inputStyle, width: 70 }}
                          />
                        </td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{rep ? money(rep.montoIgual) : '—'}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{rep ? money(rep.montoCargas) : '—'}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, fontWeight: 700, color: '#2d6a4f' }}>{rep ? money(rep.total) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {!resultado && (
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
                Ingresa la utilidad líquida de la empresa para ver el reparto calculado.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

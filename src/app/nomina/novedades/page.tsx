'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthGuard } from '@/lib/useAuthGuard'

type Empresa = { id: string; nombre: string }
type EmpleadoNomina = { id: string; nombre: string }

type TipoNovedad = 'ausencia' | 'atraso' | 'permiso_cg' | 'permiso_sg' | 'anticipo' | 'extra' | 'suplementaria'

type Novedad = {
  id: string
  empleado_id: string
  periodo: string
  tipo_novedad: TipoNovedad
  descripcion: string | null
  valor: number
  aplicado: boolean
}

const TIPOS: { value: TipoNovedad; label: string }[] = [
  { value: 'ausencia', label: 'Ausencia' },
  { value: 'atraso', label: 'Atraso' },
  { value: 'permiso_cg', label: 'Permiso con goce de sueldo' },
  { value: 'permiso_sg', label: 'Permiso sin goce de sueldo' },
  { value: 'anticipo', label: 'Anticipo' },
  { value: 'extra', label: 'Horas extraordinarias' },
  { value: 'suplementaria', label: 'Horas suplementarias' },
]

const inputStyle = { padding: '.4rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }

function periodoActual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function NovedadesNomina() {
  const router = useRouter()
  const { verificando } = useAuthGuard()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const [periodo, setPeriodo] = useState(periodoActual())
  const [empleados, setEmpleados] = useState<EmpleadoNomina[]>([])
  const [novedades, setNovedades] = useState<Novedad[]>([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({ empleadoId: '', tipo: 'ausencia' as TipoNovedad, descripcion: '', valor: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('empresas_mdt').select('id, nombre').order('nombre').then(({ data }) => setEmpresas(data ?? []))
  }, [])

  useEffect(() => {
    if (!empresaSeleccionada) { setEmpleados([]); setNovedades([]); setLoading(false); return }
    setLoading(true)
    supabase.from('empleados_nomina').select('id, nombre').eq('empresa_id', empresaSeleccionada).eq('estado', 'activo').order('nombre')
      .then(({ data }) => setEmpleados(data ?? []))
  }, [empresaSeleccionada])

  useEffect(() => {
    if (!empresaSeleccionada || empleados.length === 0) { setNovedades([]); setLoading(false); return }
    const ids = empleados.map(e => e.id)
    supabase.from('novedades_nomina').select('*').eq('periodo', periodo).in('empleado_id', ids).order('id')
      .then(({ data }) => { setNovedades(data ?? []); setLoading(false) })
  }, [empresaSeleccionada, periodo, empleados])

  async function agregarNovedad() {
    if (!form.empleadoId || !form.valor) return
    setGuardando(true)
    const { data, error } = await supabase.from('novedades_nomina').insert({
      empleado_id: form.empleadoId,
      periodo,
      tipo_novedad: form.tipo,
      descripcion: form.descripcion || null,
      valor: Number(form.valor) || 0,
      aplicado: false,
    }).select().single()
    setGuardando(false)
    if (!error && data) {
      setNovedades(prev => [...prev, data])
      setForm({ empleadoId: '', tipo: 'ausencia', descripcion: '', valor: '' })
    }
  }

  async function toggleAplicado(n: Novedad) {
    const { error } = await supabase.from('novedades_nomina').update({ aplicado: !n.aplicado }).eq('id', n.id)
    if (!error) setNovedades(prev => prev.map(x => x.id === n.id ? { ...x, aplicado: !x.aplicado } : x))
  }

  async function eliminarNovedad(id: string) {
    if (!confirm('¿Eliminar esta novedad?')) return
    await supabase.from('novedades_nomina').delete().eq('id', id)
    setNovedades(prev => prev.filter(n => n.id !== id))
  }

  const nombreEmpleado = (id: string) => empleados.find(e => e.id === id)?.nombre ?? '—'

  if (verificando) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <div style={{ background: '#1a2035', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/nomina')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
            ← Nómina
          </button>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Novedades del periodo</span>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <select value={empresaSeleccionada} onChange={e => setEmpresaSeleccionada(e.target.value)} style={inputStyle}>
            <option value=''>Selecciona una empresa…</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} style={inputStyle} />
        </div>

        {!empresaSeleccionada && (
          <div style={{ background: 'white', borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            Selecciona una empresa para registrar novedades.
          </div>
        )}

        {empresaSeleccionada && (
          <>
            <div style={{ background: 'white', borderRadius: 8, padding: '1.25rem', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2035', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Registrar novedad — {periodo}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={form.empleadoId} onChange={e => setForm({ ...form, empleadoId: e.target.value })} style={{ ...inputStyle, width: 180 }}>
                  <option value=''>Empleado…</option>
                  {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as TipoNovedad })} style={{ ...inputStyle, width: 200 }}>
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción (opcional)" style={{ ...inputStyle, width: 200 }} />
                <input value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="Valor / horas / días" type="number" style={{ ...inputStyle, width: 130 }} />
                <button disabled={!form.empleadoId || !form.valor || guardando} onClick={agregarNovedad}
                  style={{ background: '#c9a84c', color: '#1a2035', padding: '.4rem 1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: (!form.empleadoId || !form.valor) ? 0.5 : 1 }}>
                  Agregar
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                Estas novedades son un registro de referencia para el consultor durante el mes. Los valores que efectivamente se aplican al cálculo se capturan en el Rol de Nómina del periodo.
              </div>
            </div>

            {loading ? (
              <div style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</div>
            ) : (
              <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#1a2035', color: 'white' }}>
                      {['Empleado', 'Tipo', 'Descripción', 'Valor', 'Aplicado', 'Acciones'].map(h => (
                        <th key={h} style={{ padding: '.5rem .75rem', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {novedades.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Sin novedades registradas para {periodo}.</td></tr>
                    )}
                    {novedades.map((n, i) => (
                      <tr key={n.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '.4rem .75rem', fontSize: 13, fontWeight: 600, color: '#1a2035' }}>{nombreEmpleado(n.empleado_id)}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{TIPOS.find(t => t.value === n.tipo_novedad)?.label ?? n.tipo_novedad}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{n.descripcion || '—'}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{n.valor}</td>
                        <td style={{ padding: '.4rem .75rem' }}>
                          <button onClick={() => toggleAplicado(n)}
                            style={{ padding: '.15rem .6rem', borderRadius: 12, fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer', background: n.aplicado ? 'rgba(45,106,79,0.12)' : 'rgba(201,168,76,0.15)', color: n.aplicado ? '#2d6a4f' : '#7a6020' }}>
                            {n.aplicado ? '✓ Aplicado' : 'Pendiente'}
                          </button>
                        </td>
                        <td style={{ padding: '.4rem .75rem' }}>
                          <button onClick={() => eliminarNovedad(n.id)}
                            style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c', padding: '.3rem .75rem', borderRadius: 5, border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthGuard } from '@/lib/useAuthGuard'

type Puesto = {
  id: string
  nombre_puesto: string
  area: string
  supervisado_por?: string
  fecha?: string
  mision?: string
  empresa_id: string
  token?: string
  estado_ocupante?: string
  empresas_mdt?: { nombre: string }
}

type Empresa = {
  id: string
  nombre: string
  sector?: string
  token?: string
}

export default function PanelManualPuestos() {
  const router = useRouter()
  const { verificando } = useAuthGuard()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [puestos, setPuestos] = useState<Puesto[]>([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [enlaceCopiad, setEnlaceCopiad] = useState<string | null>(null)
  const [enlaceEmpresaCopiad, setEnlaceEmpresaCopiad] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('empresas_mdt').select('*').order('nombre'),
      supabase.from('puestos').select('*, empresas_mdt(nombre)').order('nombre_puesto'),
    ]).then(([{ data: emp }, { data: pue }]) => {
      setEmpresas(emp ?? [])
      setPuestos(pue ?? [])
      setLoading(false)
    })
  }, [])

  const handleBorrar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el puesto "${nombre}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('puestos').delete().eq('id', id)
    setPuestos(prev => prev.filter(p => p.id !== id))
  }

  const handleEliminarEmpresa = async (emp: Empresa) => {
    const puestosDeEmpresa = puestos.filter(p => p.empresa_id === emp.id)
    const msg = puestosDeEmpresa.length > 0
      ? `¿Eliminar "${emp.nombre}"? Tiene ${puestosDeEmpresa.length} puesto(s) registrado(s) que también se eliminarán. Esta acción no se puede deshacer.`
      : `¿Eliminar "${emp.nombre}"? Esta acción no se puede deshacer.`
    if (!confirm(msg)) return
    await supabase.from('puestos').delete().eq('empresa_id', emp.id)
    await supabase.from('empresas_mdt').delete().eq('id', emp.id)
    setEmpresas(prev => prev.filter(e => e.id !== emp.id))
    setPuestos(prev => prev.filter(p => p.empresa_id !== emp.id))
  }

  const handleEnlaceEmpresa = async (emp: Empresa) => {
    let token = emp.token
    if (!token) {
      token = crypto.randomUUID()
      await supabase.from('empresas_mdt').update({ token }).eq('id', emp.id)
      setEmpresas(prev => prev.map(e => e.id === emp.id ? { ...e, token } : e))
    }
    const enlace = `${window.location.origin}/ocupante/empresa/${token}`
    await navigator.clipboard.writeText(enlace)
    setEnlaceEmpresaCopiad(emp.id)
    setTimeout(() => setEnlaceEmpresaCopiad(null), 3000)
  }

  const handleEnviarEnlace = async (p: Puesto) => {
    let token = p.token
    if (!token) {
      token = crypto.randomUUID()
      await supabase.from('puestos').update({ token }).eq('id', p.id)
      setPuestos(prev => prev.map(x => x.id === p.id ? { ...x, token } : x))
    }
    const enlace = `${window.location.origin}/ocupante/${token}`
    await navigator.clipboard.writeText(enlace)
    setEnlaceCopiad(p.id)
    setTimeout(() => setEnlaceCopiad(null), 3000)
  }

  const puestosFiltrados = puestos
    .filter(p => !empresaSeleccionada || p.empresa_id === empresaSeleccionada)
    .filter(p => !busqueda || p.nombre_puesto.toLowerCase().includes(busqueda.toLowerCase()) || p.area.toLowerCase().includes(busqueda.toLowerCase()))

  if (verificando) return null

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0A1A32', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#10b981', fontSize: 16 }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Header */}
      <div style={{ background: '#0A1A32', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
              ← Ecosistema
            </button>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'white', letterSpacing: 1 }}>
              MIND<span style={{ color: '#10b981' }}>TALENT</span>
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            Manual de Puestos por Competencias — Metodología MDT
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/manual-puestos/importar')}
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '.45rem 1rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 12 }}>
            Importar Word / PDF
          </button>
          <button onClick={() => router.push('/manual-puestos/nuevo')}
            style={{ background: '#10b981', color: '#0A1A32', padding: '.45rem 1.25rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            + Nuevo puesto
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Empresas', valor: empresas.length, color: '#0A1A32' },
            { label: 'Puestos registrados', valor: puestos.length, color: '#1E2D5A' },
            { label: 'Fichas completas', valor: puestos.filter(p => p.mision && p.supervisado_por).length, color: '#2d6a4f' },
            { label: 'Borradores', valor: puestos.filter(p => !p.mision || !p.supervisado_por).length, color: '#10b981' },
          ].map(k => (
            <div key={k.label} style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.08)', borderLeft: `4px solid ${k.color}` }}>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: k.color }}>{k.valor}</div>
            </div>
          ))}
        </div>

        {/* Enlaces por empresa */}
        <div style={{ background: 'white', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0A1A32', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Enlace de diagnóstico por empresa
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
            Genera un enlace único para cada empresa y envíaselo a los trabajadores. Ellos llenan su cargo y actividades directamente.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {empresas.map(emp => (
              <div key={emp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0A1A32' }}>{emp.nombre}</span>
                  {emp.token && (
                    <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 8 }}>
                      /ocupante/empresa/{emp.token.slice(0, 8)}...
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleEnlaceEmpresa(emp)}
                    style={{
                      background: enlaceEmpresaCopiad === emp.id ? 'rgba(45,106,79,0.15)' : 'rgba(16,185,129,0.15)',
                      color: enlaceEmpresaCopiad === emp.id ? '#2d6a4f' : '#7a6020',
                      padding: '.3rem .9rem', borderRadius: 5,
                      border: `1px solid ${enlaceEmpresaCopiad === emp.id ? 'rgba(45,106,79,0.3)' : 'rgba(16,185,129,0.4)'}`,
                      cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                    {enlaceEmpresaCopiad === emp.id ? '✓ Enlace copiado' : 'Copiar enlace'}
                  </button>
                  <button onClick={() => handleEliminarEmpresa(emp)}
                    style={{
                      background: 'rgba(220,38,38,0.08)', color: '#b91c1c',
                      padding: '.3rem .75rem', borderRadius: 5,
                      border: '1px solid rgba(220,38,38,0.3)',
                      cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar puesto o área..."
            style={{ padding: '.4rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, width: 220, outline: 'none', color: '#111' }}
          />
          <select value={empresaSeleccionada} onChange={e => setEmpresaSeleccionada(e.target.value)}
            style={{ padding: '.4rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }}>
            <option value=''>Todas las empresas</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>

        {/* Tabla */}
        <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1E2D5A', color: 'white' }}>
                {['Puesto', 'Empresa', 'Área', 'Supervisado por', 'Fecha', 'Estado', 'Ocupante', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '.5rem .75rem', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {puestosFiltrados.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '.4rem .75rem', fontSize: 13, fontWeight: 600, color: '#0A1A32' }}>{p.nombre_puesto}</td>
                  <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{p.empresas_mdt?.nombre ?? '—'}</td>
                  <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{p.area}</td>
                  <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{p.supervisado_por || '—'}</td>
                  <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>
                    {p.fecha ? new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-EC') : '—'}
                  </td>
                  <td style={{ padding: '.4rem .75rem' }}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 99,
                      background: p.mision && p.supervisado_por ? 'rgba(45,106,79,0.1)' : 'rgba(16,185,129,0.15)',
                      color: p.mision && p.supervisado_por ? '#2d6a4f' : '#b8860b',
                      fontWeight: 600,
                    }}>
                      {p.mision && p.supervisado_por ? 'Completa' : 'Borrador'}
                    </span>
                  </td>
                  <td style={{ padding: '.4rem .75rem' }}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                      background: p.estado_ocupante === 'completado' ? 'rgba(45,106,79,0.1)' : 'rgba(100,116,139,0.1)',
                      color: p.estado_ocupante === 'completado' ? '#2d6a4f' : '#64748b',
                    }}>
                      {p.estado_ocupante === 'completado' ? 'Respondido' : 'Pendiente'}
                    </span>
                  </td>
                  <td style={{ padding: '.4rem .75rem' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button onClick={() => router.push(`/manual-puestos/${p.id}`)}
                        style={{ background: '#0A1A32', color: 'white', padding: '.25rem .6rem', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11 }}>
                        Ver ficha
                      </button>
                      <button onClick={() => router.push(`/manual-puestos/${p.id}/editar`)}
                        style={{ background: 'rgba(16,185,129,0.15)', color: '#7a6020', padding: '.25rem .6rem', borderRadius: 4, border: '1px solid rgba(16,185,129,0.4)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                        Editar
                      </button>
                      <button onClick={() => handleEnviarEnlace(p)}
                        style={{
                          background: enlaceCopiad === p.id ? 'rgba(45,106,79,0.15)' : 'rgba(59,130,246,0.1)',
                          color: enlaceCopiad === p.id ? '#2d6a4f' : '#1d4ed8',
                          padding: '.25rem .6rem', borderRadius: 4,
                          border: `1px solid ${enlaceCopiad === p.id ? 'rgba(45,106,79,0.3)' : 'rgba(59,130,246,0.3)'}`,
                          cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                        }}>
                        {enlaceCopiad === p.id ? '✓ Copiado' : 'Copiar enlace'}
                      </button>
                      <button onClick={() => handleBorrar(p.id, p.nombre_puesto)}
                        style={{ background: 'rgba(220,38,38,0.1)', color: '#b91c1c', padding: '.25rem .6rem', borderRadius: 4, border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {puestosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                    {puestos.length === 0
                      ? <>No hay puestos registrados. <button onClick={() => router.push('/manual-puestos/nuevo')} style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Crear el primero</button></>
                      : 'No hay puestos que coincidan con la búsqueda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>
          {puestosFiltrados.length} puesto{puestosFiltrados.length !== 1 ? 's' : ''} mostrado{puestosFiltrados.length !== 1 ? 's' : ''}
        </div>

        {/* Respuestas de ocupantes */}
        <RespuestasOcupantes empresaId={empresaSeleccionada} />
      </div>
    </div>
  )
}

type Respuesta = {
  id: string
  nombre?: string
  cargo_actual?: string
  actividades?: { descripcion: string; frecuencia: string; dificultad: string; consecuencia: string }[]
  herramientas?: string[]
  conocimientos?: string[]
  nivel_educativo?: string
  carrera?: string
  experiencia_anios?: number
  submitted_at?: string
  empresa_id?: string
  puesto_id?: string | null
}

function RespuestasOcupantes({ empresaId }: { empresaId: string }) {
  const router = useRouter()
  const [respuestas, setRespuestas] = useState<Respuesta[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let query = supabase.from('respuestas_ocupante').select('*').order('submitted_at', { ascending: false })
    if (empresaId) query = query.eq('empresa_id', empresaId)
    query.then(({ data }) => {
      setRespuestas(data ?? [])
      setCargando(false)
    })
  }, [empresaId])

  const handleEliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar la respuesta de ${nombre}? Esta acción no se puede deshacer.`)) return
    await supabase.from('respuestas_ocupante').delete().eq('id', id)
    setRespuestas(prev => prev.filter(r => r.id !== id))
  }

  if (cargando || respuestas.length === 0) return null

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0A1A32', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Respuestas de ocupantes ({respuestas.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {respuestas.map(r => (
          <div key={r.id} style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.07)', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', cursor: 'pointer' }}
              onClick={() => setExpandido(expandido === r.id ? null : r.id)}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0A1A32' }}>{r.nombre}</span>
                <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{r.cargo_actual}</span>
                <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 8 }}>
                  {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('es-EC') : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, background: 'rgba(45,106,79,0.1)', color: '#2d6a4f', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                  {r.actividades?.length ?? 0} actividades
                </span>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    router.push(r.puesto_id ? `/manual-puestos/${r.puesto_id}/editar` : `/manual-puestos/nuevo?desde=${r.id}`)
                  }}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid #10b981', background: 'rgba(16,185,129,0.08)', color: '#7a6020', cursor: 'pointer', fontWeight: 600 }}>
                  {r.puesto_id ? 'Ver → Ficha MDT' : 'Crear → Ficha MDT'}
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    router.push(r.puesto_id ? `/manual-puestos/${r.puesto_id}/editar` : `/manual-puestos/nuevo?desde=${r.id}`)
                  }}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.15)', color: '#7a6020', cursor: 'pointer', fontWeight: 600 }}>
                  Editar
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleEliminar(r.id, r.nombre ?? '') }}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.07)', color: '#b91c1c', cursor: 'pointer', fontWeight: 600 }}>
                  Eliminar
                </button>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{expandido === r.id ? '▲' : '▼'}</span>
              </div>
            </div>
            {expandido === r.id && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f0f0f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0A1A32', margin: '12px 0 6px' }}>Actividades</div>
                  {r.actividades?.map((a, i) => (
                    <div key={i} style={{ marginBottom: 8, paddingLeft: 8, borderLeft: '2px solid #e5e7eb' }}>
                      <div style={{ fontWeight: 600, color: '#111' }}>{a.descripcion}</div>
                      <div style={{ color: '#6b7280', fontSize: 11 }}>{a.frecuencia} · {a.dificultad} · {a.consecuencia}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0A1A32', margin: '12px 0 6px' }}>Herramientas</div>
                  {r.herramientas?.map((h, i) => <div key={i} style={{ color: '#374151' }}>· {h}</div>)}
                  <div style={{ fontWeight: 700, color: '#0A1A32', margin: '12px 0 6px' }}>Conocimientos</div>
                  {r.conocimientos?.map((c, i) => <div key={i} style={{ color: '#374151' }}>· {c}</div>)}
                  <div style={{ fontWeight: 700, color: '#0A1A32', margin: '12px 0 6px' }}>Formación</div>
                  <div style={{ color: '#374151' }}>{r.nivel_educativo}{r.carrera ? ` — ${r.carrera}` : ''}</div>
                  {r.experiencia_anios ? <div style={{ color: '#374151' }}>{r.experiencia_anios} años de experiencia</div> : null}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

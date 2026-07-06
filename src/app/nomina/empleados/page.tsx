'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthGuard } from '@/lib/useAuthGuard'

type Empresa = { id: string; nombre: string }

type Puesto = {
  id: string
  nombre_puesto: string
  area: string
  empresa_id: string
}

type EmpleadoNomina = {
  id: string
  empresa_id: string
  puesto_id: string | null
  nombre: string
  cedula: string | null
  fecha_ingreso: string | null
  cargo: string | null
  area: string | null
  sueldo_nominal: number
  tipo_contrato: string | null
  estado: string
  fondos_reserva_activo: boolean
}

const inputStyle = { padding: '.4rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }

export default function EmpleadosNomina() {
  const router = useRouter()
  const { verificando } = useAuthGuard()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const [puestos, setPuestos] = useState<Puesto[]>([])
  const [empleados, setEmpleados] = useState<EmpleadoNomina[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const [puestoAImportar, setPuestoAImportar] = useState<Puesto | null>(null)
  const [nombreImportar, setNombreImportar] = useState('')
  const [sueldoImportar, setSueldoImportar] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [nuevoManual, setNuevoManual] = useState(false)
  const [formNuevo, setFormNuevo] = useState({ nombre: '', cargo: '', area: '', sueldo: '', fechaIngreso: '' })

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [formEdicion, setFormEdicion] = useState({ nombre: '', sueldo: '', fechaIngreso: '', tipoContrato: '', estado: 'activo', fondosReserva: false })

  useEffect(() => {
    supabase.from('empresas_mdt').select('id, nombre').order('nombre').then(({ data }) => setEmpresas(data ?? []))
  }, [])

  useEffect(() => {
    if (!empresaSeleccionada) { setPuestos([]); setEmpleados([]); setLoading(false); return }
    setLoading(true)
    Promise.all([
      supabase.from('puestos').select('id, nombre_puesto, area, empresa_id').eq('empresa_id', empresaSeleccionada).order('nombre_puesto'),
      supabase.from('empleados_nomina').select('*').eq('empresa_id', empresaSeleccionada).order('nombre'),
    ]).then(([{ data: pue }, { data: emp }]) => {
      setPuestos(pue ?? [])
      setEmpleados(emp ?? [])
      setLoading(false)
    })
  }, [empresaSeleccionada])

  const puestosImportados = new Set(empleados.map(e => e.puesto_id).filter(Boolean))
  const puestosDisponibles = puestos.filter(p => !puestosImportados.has(p.id))

  async function confirmarImportacion() {
    if (!puestoAImportar || !nombreImportar.trim()) return
    setGuardando(true)
    const { data, error } = await supabase.from('empleados_nomina').insert({
      empresa_id: puestoAImportar.empresa_id,
      puesto_id: puestoAImportar.id,
      nombre: nombreImportar.trim(),
      cargo: puestoAImportar.nombre_puesto,
      area: puestoAImportar.area,
      sueldo_nominal: Number(sueldoImportar) || 0,
      estado: 'activo',
    }).select().single()
    setGuardando(false)
    if (!error && data) {
      setEmpleados(prev => [...prev, data])
      setPuestoAImportar(null)
      setNombreImportar('')
      setSueldoImportar('')
    }
  }

  async function confirmarNuevoManual() {
    if (!formNuevo.nombre.trim() || !empresaSeleccionada) return
    setGuardando(true)
    const { data, error } = await supabase.from('empleados_nomina').insert({
      empresa_id: empresaSeleccionada,
      nombre: formNuevo.nombre.trim(),
      cargo: formNuevo.cargo || null,
      area: formNuevo.area || null,
      sueldo_nominal: Number(formNuevo.sueldo) || 0,
      fecha_ingreso: formNuevo.fechaIngreso || null,
      estado: 'activo',
    }).select().single()
    setGuardando(false)
    if (!error && data) {
      setEmpleados(prev => [...prev, data])
      setNuevoManual(false)
      setFormNuevo({ nombre: '', cargo: '', area: '', sueldo: '', fechaIngreso: '' })
    }
  }

  function empezarEdicion(e: EmpleadoNomina) {
    setEditandoId(e.id)
    setFormEdicion({
      nombre: e.nombre,
      sueldo: String(e.sueldo_nominal),
      fechaIngreso: e.fecha_ingreso ?? '',
      tipoContrato: e.tipo_contrato ?? '',
      estado: e.estado,
      fondosReserva: e.fondos_reserva_activo,
    })
  }

  async function guardarEdicion(id: string) {
    setGuardando(true)
    const cambios = {
      nombre: formEdicion.nombre.trim(),
      sueldo_nominal: Number(formEdicion.sueldo) || 0,
      fecha_ingreso: formEdicion.fechaIngreso || null,
      tipo_contrato: formEdicion.tipoContrato || null,
      estado: formEdicion.estado,
      fondos_reserva_activo: formEdicion.fondosReserva,
    }
    const { error } = await supabase.from('empleados_nomina').update(cambios).eq('id', id)
    setGuardando(false)
    if (!error) {
      setEmpleados(prev => prev.map(e => e.id === id ? { ...e, ...cambios } : e))
      setEditandoId(null)
    }
  }

  async function handleBorrar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar a "${nombre}" de Nómina? Esta acción no se puede deshacer.`)) return
    await supabase.from('empleados_nomina').delete().eq('id', id)
    setEmpleados(prev => prev.filter(e => e.id !== id))
  }

  const empleadosFiltrados = empleados.filter(e =>
    !busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (e.cargo ?? '').toLowerCase().includes(busqueda.toLowerCase())
  )

  if (verificando) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <div style={{ background: '#1a2035', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/nomina')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
            ← Nómina
          </button>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Empleados</span>
        </div>
        {empresaSeleccionada && (
          <button onClick={() => setNuevoManual(true)}
            style={{ background: '#c9a84c', color: '#1a2035', padding: '.45rem 1.1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            + Nuevo empleado manual
          </button>
        )}
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <select value={empresaSeleccionada} onChange={e => setEmpresaSeleccionada(e.target.value)} style={inputStyle}>
            <option value=''>Selecciona una empresa…</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          {empresaSeleccionada && (
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar nombre o cargo…" style={{ ...inputStyle, width: 220 }} />
          )}
        </div>

        {!empresaSeleccionada && (
          <div style={{ background: 'white', borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            Selecciona una empresa para ver o importar empleados.
          </div>
        )}

        {empresaSeleccionada && loading && (
          <div style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</div>
        )}

        {empresaSeleccionada && !loading && (
          <>
            {puestosDisponibles.length > 0 && (
              <div style={{ background: 'white', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2035', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Puestos disponibles para importar desde Manual de Puestos
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {puestosDisponibles.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2035' }}>{p.nombre_puesto}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{p.area}</span>
                      </div>
                      <button onClick={() => { setPuestoAImportar(p); setNombreImportar(''); setSueldoImportar('') }}
                        style={{ background: 'rgba(201,168,76,0.15)', color: '#7a6020', padding: '.3rem .9rem', borderRadius: 5, border: '1px solid rgba(201,168,76,0.4)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                        Importar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {puestoAImportar && (
              <div style={{ background: 'white', borderRadius: 8, padding: '1.25rem', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)', border: '1px solid #c9a84c' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2035', marginBottom: 12 }}>
                  Importar: {puestoAImportar.nombre_puesto}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={nombreImportar} onChange={e => setNombreImportar(e.target.value)} placeholder="Nombre completo del empleado *" style={{ ...inputStyle, width: 240 }} />
                  <input value={sueldoImportar} onChange={e => setSueldoImportar(e.target.value)} placeholder="Sueldo nominal" type="number" style={{ ...inputStyle, width: 140 }} />
                  <button disabled={!nombreImportar.trim() || guardando} onClick={confirmarImportacion}
                    style={{ background: '#c9a84c', color: '#1a2035', padding: '.4rem 1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: !nombreImportar.trim() ? 0.5 : 1 }}>
                    Confirmar
                  </button>
                  <button onClick={() => setPuestoAImportar(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {nuevoManual && (
              <div style={{ background: 'white', borderRadius: 8, padding: '1.25rem', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)', border: '1px solid #c9a84c' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2035', marginBottom: 12 }}>Nuevo empleado (sin vincular a un puesto)</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={formNuevo.nombre} onChange={e => setFormNuevo({ ...formNuevo, nombre: e.target.value })} placeholder="Nombre completo *" style={{ ...inputStyle, width: 200 }} />
                  <input value={formNuevo.cargo} onChange={e => setFormNuevo({ ...formNuevo, cargo: e.target.value })} placeholder="Cargo" style={{ ...inputStyle, width: 160 }} />
                  <input value={formNuevo.area} onChange={e => setFormNuevo({ ...formNuevo, area: e.target.value })} placeholder="Área" style={{ ...inputStyle, width: 140 }} />
                  <input value={formNuevo.sueldo} onChange={e => setFormNuevo({ ...formNuevo, sueldo: e.target.value })} placeholder="Sueldo nominal" type="number" style={{ ...inputStyle, width: 130 }} />
                  <input value={formNuevo.fechaIngreso} onChange={e => setFormNuevo({ ...formNuevo, fechaIngreso: e.target.value })} type="date" style={inputStyle} />
                  <button disabled={!formNuevo.nombre.trim() || guardando} onClick={confirmarNuevoManual}
                    style={{ background: '#c9a84c', color: '#1a2035', padding: '.4rem 1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: !formNuevo.nombre.trim() ? 0.5 : 1 }}>
                    Guardar
                  </button>
                  <button onClick={() => setNuevoManual(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1a2035', color: 'white' }}>
                    {['Nombre', 'Cargo', 'Área', 'Sueldo nominal', 'Fecha ingreso', 'F. Reserva', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '.5rem .75rem', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empleadosFiltrados.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Sin empleados registrados todavía.</td></tr>
                  )}
                  {empleadosFiltrados.map((e, i) => (
                    editandoId === e.id ? (
                      <tr key={e.id} style={{ background: 'rgba(201,168,76,0.08)' }}>
                        <td style={{ padding: '.4rem .75rem' }}><input value={formEdicion.nombre} onChange={ev => setFormEdicion({ ...formEdicion, nombre: ev.target.value })} style={{ ...inputStyle, width: 140 }} /></td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{e.cargo || '[ Por completar ]'}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{e.area || '[ Por completar ]'}</td>
                        <td style={{ padding: '.4rem .75rem' }}><input value={formEdicion.sueldo} onChange={ev => setFormEdicion({ ...formEdicion, sueldo: ev.target.value })} type="number" style={{ ...inputStyle, width: 100 }} /></td>
                        <td style={{ padding: '.4rem .75rem' }}><input value={formEdicion.fechaIngreso} onChange={ev => setFormEdicion({ ...formEdicion, fechaIngreso: ev.target.value })} type="date" style={inputStyle} /></td>
                        <td style={{ padding: '.4rem .75rem' }}>
                          <input type="checkbox" checked={formEdicion.fondosReserva} onChange={ev => setFormEdicion({ ...formEdicion, fondosReserva: ev.target.checked })} />
                        </td>
                        <td style={{ padding: '.4rem .75rem' }}>
                          <select value={formEdicion.estado} onChange={ev => setFormEdicion({ ...formEdicion, estado: ev.target.value })} style={{ ...inputStyle, width: 100 }}>
                            <option value="activo">activo</option>
                            <option value="inactivo">inactivo</option>
                          </select>
                        </td>
                        <td style={{ padding: '.4rem .75rem', display: 'flex', gap: 6 }}>
                          <button onClick={() => guardarEdicion(e.id)} disabled={guardando} style={{ background: '#c9a84c', color: '#1a2035', padding: '.3rem .75rem', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Guardar</button>
                          <button onClick={() => setEditandoId(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 11 }}>Cancelar</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={e.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '.4rem .75rem', fontSize: 13, fontWeight: 600, color: '#1a2035' }}>{e.nombre || '[ Por completar ]'}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{e.cargo || '[ Por completar ]'}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{e.area || '[ Por completar ]'}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>${e.sueldo_nominal.toFixed(2)}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{e.fecha_ingreso || '[ Por completar ]'}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{e.fondos_reserva_activo ? '✓' : '—'}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12 }}>
                          <span style={{ padding: '.15rem .6rem', borderRadius: 12, fontSize: 10, fontWeight: 700, background: e.estado === 'activo' ? 'rgba(45,106,79,0.12)' : 'rgba(107,114,128,0.12)', color: e.estado === 'activo' ? '#2d6a4f' : '#6b7280' }}>
                            {e.estado}
                          </span>
                        </td>
                        <td style={{ padding: '.4rem .75rem', display: 'flex', gap: 6 }}>
                          <button onClick={() => empezarEdicion(e)} style={{ background: 'rgba(26,32,53,0.06)', color: '#1a2035', padding: '.3rem .75rem', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Editar</button>
                          <button onClick={() => handleBorrar(e.id, e.nombre)} style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c', padding: '.3rem .75rem', borderRadius: 5, border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Eliminar</button>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

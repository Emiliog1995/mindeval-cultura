'use client'
import { useEffect, useState, use as usePromise } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthGuard } from '@/lib/useAuthGuard'
import {
  obtenerEmpresa, actualizarEmpresa, listarModulosActivosPorEmpresa,
  listarPersonasPorEmpresa, activarModulo, cambiarEstadoModulo,
  MODULOS_ECOSISTEMA, type Empresa, type ModuloActivo, type ModuloKey,
} from '@/lib/supabase'

const ESTADO_LABEL: Record<string, string> = { activo: 'Activo', inactivo: 'Inactivo', pausado: 'Pausado' }
const ESTADO_COLOR: Record<string, string> = { activo: '#2d6a4f', inactivo: '#9ca3af', pausado: '#b45309' }

export default function FichaEmpresa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const router = useRouter()
  const { verificando } = useAuthGuard()

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [modulos, setModulos] = useState<ModuloActivo[]>([])
  const [personasCount, setPersonasCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ nombre: '', sector: '', ruc: '', contacto: '' })
  const [guardando, setGuardando] = useState(false)

  const [confirmando, setConfirmando] = useState<ModuloKey | null>(null)
  const [activando, setActivando] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const [emp, mods, personas] = await Promise.all([
      obtenerEmpresa(id),
      listarModulosActivosPorEmpresa(id),
      listarPersonasPorEmpresa(id),
    ])
    setEmpresa(emp)
    setModulos(mods)
    setPersonasCount(personas.length)
    setForm({ nombre: emp.nombre, sector: emp.sector ?? '', ruc: emp.ruc ?? '', contacto: emp.contacto ?? '' })
    setLoading(false)
  }

  async function guardarDatos() {
    setGuardando(true)
    try {
      await actualizarEmpresa(id, form)
      await cargar()
      setEditando(false)
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarActivacion(modulo: ModuloKey) {
    setActivando(true)
    try {
      await activarModulo(id, modulo)
      await cargar()
      setConfirmando(null)
    } finally {
      setActivando(false)
    }
  }

  function irAlModulo(mod: typeof MODULOS_ECOSISTEMA[number]) {
    if (mod.preseleccionaEmpresa) {
      router.push(`${mod.href}?empresa=${id}`)
    } else {
      router.push(mod.href)
    }
  }

  if (verificando || loading || !empresa) return null

  const modByKey = new Map(modulos.map(m => [m.modulo, m]))
  const moduloConfirmando = MODULOS_ECOSISTEMA.find(m => m.key === confirmando)

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Header */}
      <div style={{ background: '#1a2035', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/admin/clientes')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
              ← Clientes
            </button>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'white', letterSpacing: 1 }}>
              MIND<span style={{ color: '#c9a84c' }}>TALENT</span>
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginTop: 4 }}>{empresa.nombre}</div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Datos de la empresa */}
        <div style={{ background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2035' }}>Datos de la empresa</div>
            {!editando && (
              <button onClick={() => setEditando(true)} style={{ background: 'none', border: 'none', color: '#c9a84c', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                Editar
              </button>
            )}
          </div>

          {editando ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre"
                  style={{ padding: '.5rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }} />
                <input value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))} placeholder="Sector"
                  style={{ padding: '.5rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }} />
                <input value={form.ruc} onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))} placeholder="RUC"
                  style={{ padding: '.5rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }} />
                <input value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} placeholder="Contacto"
                  style={{ padding: '.5rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={guardarDatos} disabled={guardando}
                  style={{ background: '#c9a84c', color: '#1a2035', padding: '.5rem 1.1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
                <button onClick={() => setEditando(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}>
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 13 }}>
              <div><span style={{ color: '#9ca3af' }}>Sector: </span><span style={{ color: '#111' }}>{empresa.sector || '—'}</span></div>
              <div><span style={{ color: '#9ca3af' }}>RUC: </span><span style={{ color: '#111' }}>{empresa.ruc || '—'}</span></div>
              <div><span style={{ color: '#9ca3af' }}>Contacto: </span><span style={{ color: '#111' }}>{empresa.contacto || '—'}</span></div>
              <div><span style={{ color: '#9ca3af' }}>Personas registradas: </span><span style={{ color: '#111' }}>{personasCount}</span></div>
            </div>
          )}
        </div>

        {/* Grid de módulos */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2035', marginBottom: 10 }}>Módulos del ecosistema</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {MODULOS_ECOSISTEMA.map(mod => {
            const activo = modByKey.get(mod.key)
            const estado = activo?.estado ?? 'inactivo'
            return (
              <div key={mod.key} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem 1.1rem', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2035' }}>{mod.label}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '.2rem .55rem', borderRadius: 999, background: `${ESTADO_COLOR[estado]}20`, color: ESTADO_COLOR[estado] }}>
                    {ESTADO_LABEL[estado]}
                  </span>
                </div>

                {estado === 'activo' && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
                    <button onClick={() => irAlModulo(mod)}
                      style={{ background: '#1a2035', color: 'white', padding: '.4rem .8rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      Ir al módulo →
                    </button>
                    <button onClick={() => activo && cambiarEstadoModulo(activo.id, 'pausado').then(cargar)}
                      style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 11 }}>
                      Pausar
                    </button>
                  </div>
                )}

                {estado === 'pausado' && (
                  <button onClick={() => activo && cambiarEstadoModulo(activo.id, 'activo').then(cargar)}
                    style={{ marginTop: 10, background: '#c9a84c', color: '#1a2035', padding: '.4rem .8rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    Reactivar
                  </button>
                )}

                {estado === 'inactivo' && (
                  <button onClick={() => setConfirmando(mod.key)}
                    style={{ marginTop: 10, background: '#c9a84c', color: '#1a2035', padding: '.4rem .8rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    Activar
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Confirmación de activación */}
      {moduloConfirmando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,26,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: 10, padding: '1.5rem', maxWidth: 440, width: '100%' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2035', marginBottom: 4 }}>
              Activar {moduloConfirmando.label} para {empresa.nombre}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
              Esto crea el registro de activación — no borra ni mueve nada existente.
            </div>

            <div style={{ background: 'rgba(45,106,79,0.08)', borderRadius: 8, padding: '.75rem .9rem', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Se hereda automático</div>
              <div style={{ fontSize: 12, color: '#1a2035', lineHeight: 1.6 }}>
                Empresa ({empresa.nombre}){personasCount > 0 ? ` y ${personasCount} persona(s) ya registrada(s)` : ''}.
              </div>
            </div>

            <div style={{ background: 'rgba(201,168,76,0.12)', borderRadius: 8, padding: '.75rem .9rem', marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7a6020', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Hay que capturar aparte</div>
              <div style={{ fontSize: 12, color: '#1a2035', lineHeight: 1.6 }}>{moduloConfirmando.captura}</div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmando(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}>
                Cancelar
              </button>
              <button onClick={() => confirmarActivacion(moduloConfirmando.key)} disabled={activando}
                style={{ background: '#c9a84c', color: '#1a2035', padding: '.5rem 1.1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                {activando ? 'Activando…' : 'Confirmar activación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

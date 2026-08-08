'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthGuard } from '@/lib/useAuthGuard'
import {
  listarEmpresas, crearEmpresa, listarModulosActivos,
  MODULOS_ECOSISTEMA, type Empresa, type ModuloActivo,
} from '@/lib/supabase'

export default function PanelClientes() {
  const router = useRouter()
  const { verificando } = useAuthGuard()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [modulos, setModulos] = useState<ModuloActivo[]>([])
  const [loading, setLoading] = useState(true)

  const [nuevaEmpresa, setNuevaEmpresa] = useState(false)
  const [form, setForm] = useState({ nombre: '', sector: '', ruc: '', contacto: '', tamanoEstimado: '' })
  const [creando, setCreando] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [emp, mod] = await Promise.all([listarEmpresas(), listarModulosActivos()])
    setEmpresas(emp)
    setModulos(mod)
    setLoading(false)
  }

  async function handleCrear() {
    if (!form.nombre.trim()) return
    setCreando(true)
    setErrorForm('')
    try {
      const empresa = await crearEmpresa({
        ...form,
        tamano_estimado: form.tamanoEstimado.trim() ? Number(form.tamanoEstimado) : null,
      })
      setNuevaEmpresa(false)
      setForm({ nombre: '', sector: '', ruc: '', contacto: '', tamanoEstimado: '' })
      router.push(`/admin/clientes/${empresa.id}`)
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : 'No se pudo crear la empresa')
    } finally {
      setCreando(false)
    }
  }

  if (verificando) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Header */}
      <div style={{ background: '#1a2035', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/portal')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
              ← Ecosistema
            </button>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'white', letterSpacing: 1 }}>
              MIND<span style={{ color: '#c9a84c' }}>TALENT</span>
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            Panel de clientes — empresas y módulos contratados
          </div>
        </div>
        <button onClick={() => setNuevaEmpresa(true)}
          style={{ background: '#c9a84c', color: '#1a2035', padding: '.5rem 1.1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
          + Nueva empresa
        </button>
      </div>

      {nuevaEmpresa && (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem 1.5rem 0' }}>
          <div style={{ background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)', border: '1px solid #c9a84c' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2035', marginBottom: 10 }}>Nueva empresa</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre de la empresa *"
                style={{ padding: '.5rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }} />
              <input value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
                placeholder="Sector"
                style={{ padding: '.5rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }} />
              <input value={form.ruc} onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))}
                placeholder="RUC"
                style={{ padding: '.5rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }} />
              <input value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))}
                placeholder="Contacto (nombre, tel o email)"
                style={{ padding: '.5rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }} />
              <input value={form.tamanoEstimado} onChange={e => setForm(f => ({ ...f, tamanoEstimado: e.target.value.replace(/\D/g, '') }))}
                placeholder="Empleados estimados (opcional)" inputMode="numeric"
                style={{ padding: '.5rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }} />
            </div>
            {errorForm && <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 8 }}>{errorForm}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={handleCrear} disabled={!form.nombre.trim() || creando}
                style={{ background: '#c9a84c', color: '#1a2035', padding: '.5rem 1.1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: !form.nombre.trim() ? 0.5 : 1 }}>
                {creando ? 'Creando…' : 'Crear y abrir ficha'}
              </button>
              <button onClick={() => { setNuevaEmpresa(false); setErrorForm('') }}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {loading ? (
          <div style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</div>
        ) : empresas.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            No hay empresas registradas todavía. Usa &quot;+ Nueva empresa&quot; para crear la primera.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {empresas.map(emp => {
              const modsEmpresa = modulos.filter(m => m.empresa_id === emp.id)
              const activos = modsEmpresa.filter(m => m.estado === 'activo').length
              const esCliente = activos > 0
              return (
                <button key={emp.id} onClick={() => router.push(`/admin/clientes/${emp.id}`)}
                  style={{
                    textAlign: 'left', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
                    padding: '1rem 1.25rem', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
                  }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2035' }}>{emp.nombre}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {emp.sector || 'Sector no especificado'}
                      {emp.tamano_estimado ? ` · ~${emp.tamano_estimado} empleados` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '.3rem .7rem', borderRadius: 999,
                      background: esCliente ? 'rgba(45,106,79,0.12)' : 'rgba(107,114,128,0.12)',
                      color: esCliente ? '#2d6a4f' : '#6b7280',
                    }}>
                      {esCliente ? 'Cliente activo' : 'Sin módulos activos'}
                    </span>
                    <span style={{ fontSize: 12, color: '#6b7280', minWidth: 90, textAlign: 'right' }}>
                      {activos} / {MODULOS_ECOSISTEMA.length} módulos
                    </span>
                    <span style={{ color: '#c9a84c', fontSize: 18 }}>→</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

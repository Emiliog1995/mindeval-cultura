'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const DARK = '#1a2035'
const GOLD = '#c9a84c'

type Actividad = {
  descripcion: string
  frecuencia: string
  dificultad: string
  consecuencia: string
}

const OPCIONES_FRECUENCIA = [
  { valor: 'diaria', label: 'Diaria' },
  { valor: 'semanal', label: 'Semanal' },
  { valor: 'mensual', label: 'Mensual' },
  { valor: 'eventual', label: 'Eventual' },
]

const OPCIONES_DIFICULTAD = [
  { valor: 'simple', label: 'Simple' },
  { valor: 'analisis', label: 'Requiere análisis' },
  { valor: 'compleja', label: 'Compleja' },
]

const OPCIONES_CONSECUENCIA = [
  { valor: 'minima', label: 'Mínima' },
  { valor: 'moderada', label: 'Moderada' },
  { valor: 'alta', label: 'Alta' },
]

const NIVELES_EDUCATIVOS = [
  'Bachillerato', 'Técnico / Tecnológico', 'Tercer nivel (Ingeniería / Licenciatura)',
  'Cuarto nivel (Maestría)', 'Doctorado',
]

const ACTIVIDAD_VACIA: Actividad = { descripcion: '', frecuencia: '', dificultad: '', consecuencia: '' }

export default function EditarRespuesta() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

  const [nombre, setNombre] = useState('')
  const [cargoActual, setCargoActual] = useState('')
  const [area, setArea] = useState('')
  const [actividades, setActividades] = useState<Actividad[]>(Array(8).fill(null).map(() => ({ ...ACTIVIDAD_VACIA })))
  const [herramientas, setHerramientas] = useState('')
  const [conocimientos, setConocimientos] = useState('')
  const [nivelEducativo, setNivelEducativo] = useState('')
  const [carrera, setCarrera] = useState('')
  const [experienciaAnios, setExperienciaAnios] = useState('')
  const [paso, setPaso] = useState(1)

  useEffect(() => {
    supabase
      .from('respuestas_ocupante')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setError('No se encontró la respuesta.'); setCargando(false); return }
        setNombre(data.nombre ?? '')
        setCargoActual(data.cargo_actual ?? '')
        setArea(data.area ?? '')
        const acts: Actividad[] = data.actividades ?? []
        const filled = [...acts, ...Array(Math.max(0, 8 - acts.length)).fill(null).map(() => ({ ...ACTIVIDAD_VACIA }))]
        setActividades(filled.slice(0, Math.max(8, filled.length)))
        setHerramientas((data.herramientas ?? []).join('\n'))
        setConocimientos((data.conocimientos ?? []).join('\n'))
        setNivelEducativo(data.nivel_educativo ?? '')
        setCarrera(data.carrera ?? '')
        setExperienciaAnios(data.experiencia_anios != null ? String(data.experiencia_anios) : '')
        setCargando(false)
      })
  }, [id])

  const actividadesValidas = actividades.filter(
    a => a.descripcion.trim() && a.frecuencia && a.dificultad && a.consecuencia
  )

  const handleGuardar = async () => {
    if (actividadesValidas.length < 3) return
    setGuardando(true)
    const { error: err } = await supabase
      .from('respuestas_ocupante')
      .update({
        nombre,
        cargo_actual: cargoActual,
        actividades: actividadesValidas,
        herramientas: herramientas.split('\n').map(h => h.trim()).filter(Boolean),
        conocimientos: conocimientos.split('\n').map(c => c.trim()).filter(Boolean),
        nivel_educativo: nivelEducativo,
        carrera,
        experiencia_anios: parseInt(experienciaAnios) || 0,
      })
      .eq('id', id)
    setGuardando(false)
    if (err) { setError('Error al guardar: ' + err.message); return }
    setGuardado(true)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db',
    borderRadius: 6, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box',
  }

  if (cargando) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: GOLD, fontSize: 16 }}>Cargando...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>{error}</div>
      <button onClick={() => router.push('/manual-puestos')} style={{ color: GOLD, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>← Volver al panel</button>
    </div>
  )

  if (guardado) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, padding: '2rem' }}>
      <div style={{ fontSize: 52, color: GOLD }}>✓</div>
      <div style={{ color: GOLD, fontSize: 20, fontWeight: 700 }}>Respuesta actualizada</div>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', maxWidth: 400 }}>
        La información del ocupante quedó guardada. Ahora puedes generar la ficha de puesto completa con metodología MDT.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8, width: '100%', maxWidth: 360 }}>
        <button
          onClick={() => router.push(`/manual-puestos/nuevo?desde=${id}`)}
          style={{
            background: GOLD, color: DARK, border: 'none', borderRadius: 8, padding: '14px 24px',
            fontWeight: 700, fontSize: 15, cursor: 'pointer', letterSpacing: 0.3,
          }}>
          Generar ficha de puesto →
        </button>
        <button
          onClick={() => router.push('/manual-puestos')}
          style={{
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8, padding: '10px 24px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
          Volver al panel
        </button>
      </div>
    </div>
  )

  const totalPasos = 4

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Header */}
      <div style={{ background: DARK, padding: '1rem 1.5rem' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white', letterSpacing: 1 }}>
              MIND<span style={{ color: GOLD }}>TALENT</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Editar respuesta de ocupante</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Paso {paso} de {totalPasos}</span>
            <button onClick={() => router.push('/manual-puestos')}
              style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}>
              ← Volver
            </button>
          </div>
        </div>
        <div style={{ maxWidth: 680, margin: '10px auto 0', height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 99 }}>
          <div style={{ height: '100%', background: GOLD, borderRadius: 99, width: `${(paso / totalPasos) * 100}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* PASO 1 — Identificación */}
        {paso === 1 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '1.75rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 18 }}>Datos de identificación</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>Edita el nombre, cargo y área del ocupante.</p>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Nombre completo *</div>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: María González" style={inputStyle} />
            </label>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Cargo o título del puesto *</div>
              <input value={cargoActual} onChange={e => setCargoActual(e.target.value)} placeholder="Ej: Analista de Talento Humano" style={inputStyle} />
            </label>

            <label style={{ display: 'block', marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Área o departamento *</div>
              <input value={area} onChange={e => setArea(e.target.value)} placeholder="Ej: Talento Humano, Finanzas..." style={inputStyle} />
            </label>

            <button onClick={() => setPaso(2)} disabled={!nombre.trim() || !cargoActual.trim()}
              style={{
                width: '100%', padding: '.7rem', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 14,
                background: nombre && cargoActual ? GOLD : '#e5e7eb',
                color: nombre && cargoActual ? DARK : '#9ca3af',
                cursor: nombre && cargoActual ? 'pointer' : 'not-allowed',
              }}>
              Continuar →
            </button>
          </div>
        )}

        {/* PASO 2 — Actividades */}
        {paso === 2 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '1.75rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 18 }}>Actividades del puesto</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
              Edita las actividades. <strong style={{ color: DARK }}>Necesitas al menos 3 completas.</strong>
            </p>

            {actividades.map((act, i) => (
              <div key={i} style={{ marginBottom: 16, padding: '1rem', background: '#f9fafb', borderRadius: 8, border: `1px solid ${act.descripcion && act.frecuencia && act.dificultad && act.consecuencia ? 'rgba(45,106,79,0.3)' : '#e5e7eb'}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>ACTIVIDAD {i + 1}</div>
                <textarea
                  value={act.descripcion}
                  onChange={e => setActividades(prev => prev.map((a, j) => j === i ? { ...a, descripcion: e.target.value } : a))}
                  placeholder="¿Qué hace exactamente en esta actividad?"
                  rows={2}
                  style={{ width: '100%', padding: '.5rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#111', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: act.descripcion.trim() ? 12 : 0 }}
                />
                {act.descripcion.trim() && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Frecuencia</div>
                      {OPCIONES_FRECUENCIA.map(op => (
                        <label key={op.valor} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer', fontSize: 12, color: '#374151', marginBottom: 4 }}>
                          <input type="radio" name={`freq-${i}`} value={op.valor} checked={act.frecuencia === op.valor}
                            onChange={() => setActividades(prev => prev.map((a, j) => j === i ? { ...a, frecuencia: op.valor } : a))}
                            style={{ marginTop: 2 }} />
                          {op.label}
                        </label>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Dificultad</div>
                      {OPCIONES_DIFICULTAD.map(op => (
                        <label key={op.valor} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer', fontSize: 12, color: '#374151', marginBottom: 4 }}>
                          <input type="radio" name={`dif-${i}`} value={op.valor} checked={act.dificultad === op.valor}
                            onChange={() => setActividades(prev => prev.map((a, j) => j === i ? { ...a, dificultad: op.valor } : a))}
                            style={{ marginTop: 2 }} />
                          {op.label}
                        </label>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Si falla...</div>
                      {OPCIONES_CONSECUENCIA.map(op => (
                        <label key={op.valor} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer', fontSize: 12, color: '#374151', marginBottom: 4 }}>
                          <input type="radio" name={`cons-${i}`} value={op.valor} checked={act.consecuencia === op.valor}
                            onChange={() => setActividades(prev => prev.map((a, j) => j === i ? { ...a, consecuencia: op.valor } : a))}
                            style={{ marginTop: 2 }} />
                          {op.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div style={{ fontSize: 12, color: actividadesValidas.length >= 3 ? '#2d6a4f' : '#9ca3af', marginBottom: 12, textAlign: 'right', fontWeight: 600 }}>
              {actividadesValidas.length} actividad{actividadesValidas.length !== 1 ? 'es' : ''} completa{actividadesValidas.length !== 1 ? 's' : ''}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPaso(1)}
                style={{ background: '#f3f4f6', color: '#374151', padding: '.6rem 1.25rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                ← Atrás
              </button>
              <button onClick={() => setPaso(3)} disabled={actividadesValidas.length < 3}
                style={{ flex: 1, background: actividadesValidas.length >= 3 ? GOLD : '#e5e7eb', color: actividadesValidas.length >= 3 ? DARK : '#9ca3af', padding: '.6rem', borderRadius: 6, border: 'none', cursor: actividadesValidas.length >= 3 ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 14 }}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* PASO 3 — Herramientas */}
        {paso === 3 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '1.75rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 18 }}>Herramientas y conocimientos</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Uno por línea.</p>

            <label style={{ display: 'block', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 4 }}>Programas o herramientas</div>
              <textarea value={herramientas} onChange={e => setHerramientas(e.target.value)} rows={4}
                placeholder={"Excel\nSAP\nTeléfono IP"}
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#111', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </label>

            <label style={{ display: 'block', marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 4 }}>Conocimientos requeridos</div>
              <textarea value={conocimientos} onChange={e => setConocimientos(e.target.value)} rows={4}
                placeholder={"Legislación laboral\nGestión documental"}
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#111', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPaso(2)}
                style={{ background: '#f3f4f6', color: '#374151', padding: '.6rem 1.25rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                ← Atrás
              </button>
              <button onClick={() => setPaso(4)}
                style={{ flex: 1, background: GOLD, color: DARK, padding: '.6rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* PASO 4 — Perfil + guardar */}
        {paso === 4 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '1.75rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 18 }}>Formación y experiencia</h2>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Nivel de educación *</div>
              <select value={nivelEducativo} onChange={e => setNivelEducativo(e.target.value)}
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: nivelEducativo ? '#111' : '#9ca3af', outline: 'none', boxSizing: 'border-box' }}>
                <option value=''>Selecciona...</option>
                {NIVELES_EDUCATIVOS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Carrera o área de estudio</div>
              <input value={carrera} onChange={e => setCarrera(e.target.value)}
                placeholder="Ej: Psicología, Administración..."
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
            </label>

            <label style={{ display: 'block', marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Años de experiencia</div>
              <input type="number" min="0" max="50" value={experienciaAnios} onChange={e => setExperienciaAnios(e.target.value)}
                placeholder="Ej: 5"
                style={{ width: 140, padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111', outline: 'none' }} />
            </label>

            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPaso(3)}
                style={{ background: '#f3f4f6', color: '#374151', padding: '.6rem 1.25rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                ← Atrás
              </button>
              <button onClick={handleGuardar} disabled={!nivelEducativo || guardando}
                style={{
                  flex: 1, padding: '.6rem', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 14,
                  background: nivelEducativo && !guardando ? DARK : '#e5e7eb',
                  color: nivelEducativo && !guardando ? 'white' : '#9ca3af',
                  cursor: nivelEducativo && !guardando ? 'pointer' : 'not-allowed',
                }}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

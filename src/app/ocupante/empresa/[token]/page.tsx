'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
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
  { valor: 'diaria', label: 'Diaria — La hago todos los días' },
  { valor: 'semanal', label: 'Semanal — Varias veces por semana' },
  { valor: 'mensual', label: 'Mensual — Algunas veces al mes' },
  { valor: 'eventual', label: 'Eventual — De vez en cuando' },
]

const OPCIONES_DIFICULTAD = [
  { valor: 'simple', label: 'Simple — Sigo pasos establecidos' },
  { valor: 'analisis', label: 'Requiere análisis — Evalúo opciones antes de actuar' },
  { valor: 'compleja', label: 'Compleja — Tomo decisiones importantes con poca guía' },
]

const OPCIONES_CONSECUENCIA = [
  { valor: 'minima', label: 'Mínima — El impacto es pequeño y se corrige fácil' },
  { valor: 'moderada', label: 'Moderada — Afecta a mi área o equipo' },
  { valor: 'alta', label: 'Alta — Afecta a toda la empresa o clientes' },
]

const NIVELES_EDUCATIVOS = [
  'Bachillerato', 'Técnico / Tecnológico', 'Tercer nivel (Ingeniería / Licenciatura)',
  'Cuarto nivel (Maestría)', 'Doctorado',
]

export default function FormularioEmpresa() {
  const { token } = useParams<{ token: string }>()
  const [empresa, setEmpresa] = useState<{ id: string; nombre: string; logo_url?: string } | null>(null)
  const [cargando, setCargando] = useState(true)
  const [enviado, setEnviado] = useState(false)
  const [paso, setPaso] = useState(1)
  const [guardando, setGuardando] = useState(false)

  const [nombre, setNombre] = useState('')
  const [cargoActual, setCargoActual] = useState('')
  const [area, setArea] = useState('')
  const [supervisadoPor, setSupervisadoPor] = useState('')
  const [supervisaA, setSupervisaA] = useState('')

  const [actividades, setActividades] = useState<Actividad[]>(
    Array(8).fill(null).map(() => ({ descripcion: '', frecuencia: '', dificultad: '', consecuencia: '' }))
  )

  const [herramientas, setHerramientas] = useState('')
  const [conocimientos, setConocimientos] = useState('')
  const [nivelEducativo, setNivelEducativo] = useState('')
  const [carrera, setCarrera] = useState('')
  const [experienciaAnios, setExperienciaAnios] = useState('')

  useEffect(() => {
    supabase
      .from('empresas_mdt')
      .select('id, nombre, logo_url')
      .eq('token', token)
      .single()
      .then(({ data }) => {
        setEmpresa(data)
        setCargando(false)
      })
  }, [token])

  const actividadesValidas = actividades.filter(
    a => a.descripcion.trim() && a.frecuencia && a.dificultad && a.consecuencia
  )

  const handleEnviar = async () => {
    if (!empresa || actividadesValidas.length < 3) return
    setGuardando(true)

    const { error } = await supabase.from('respuestas_ocupante').insert({
      empresa_id: empresa.id,
      puesto_id: null,
      nombre,
      cargo_actual: cargoActual,
      area,
      supervisado_por: supervisadoPor || null,
      supervisa_a: supervisaA || null,
      actividades: actividadesValidas,
      herramientas: herramientas.split('\n').map(h => h.trim()).filter(Boolean),
      conocimientos: conocimientos.split('\n').map(c => c.trim()).filter(Boolean),
      nivel_educativo: nivelEducativo,
      carrera,
      experiencia_anios: parseInt(experienciaAnios) || 0,
    })

    setGuardando(false)
    if (error) {
      console.error('Error al guardar respuesta:', error)
      alert('Hubo un error al guardar tu respuesta. Por favor intenta de nuevo.')
      return
    }
    setEnviado(true)
  }

  if (cargando) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: GOLD, fontSize: 16 }}>Cargando...</div>
    </div>
  )

  if (!empresa) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Enlace no válido</div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Este enlace no existe o ya no está disponible.</div>
    </div>
  )

  if (enviado) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '2rem' }}>
      <div style={{ fontSize: 52, color: GOLD }}>✓</div>
      <div style={{ color: GOLD, fontSize: 22, fontWeight: 700, textAlign: 'center' }}>¡Gracias, {nombre}!</div>
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', maxWidth: 420, lineHeight: 1.7 }}>
        Tu información fue registrada. El equipo de MINDTALENT la analizará y construirá el descriptor de tu puesto con base en lo que nos contaste.
      </div>
      <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
        {empresa.nombre} · {cargoActual}
      </div>
    </div>
  )

  const totalPasos = 4

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db',
    borderRadius: 6, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Header */}
      <div style={{ background: DARK, padding: '1rem 1.5rem' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {empresa.logo_url
              ? <img src={empresa.logo_url} alt={empresa.nombre} style={{ height: 36, objectFit: 'contain' }} />
              : <><div style={{ fontSize: 16, fontWeight: 700, color: 'white', letterSpacing: 1 }}>MIND<span style={{ color: GOLD }}>TALENT</span></div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{empresa.nombre}</div></>
            }
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Paso {paso} de {totalPasos}</div>
        </div>
        <div style={{ maxWidth: 680, margin: '10px auto 0', height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 99 }}>
          <div style={{ height: '100%', background: GOLD, borderRadius: 99, width: `${(paso / totalPasos) * 100}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* PASO 1 — Identificación */}
        {paso === 1 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '1.75rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 18 }}>Hola, ¿quién eres?</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>
              Vamos a levantar información sobre tu puesto de trabajo en <strong>{empresa.nombre}</strong>. Solo toma 15 minutos.
            </p>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Tu nombre completo *</div>
              <input value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Ej: María González" style={inputStyle} />
            </label>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Tu cargo o título del puesto *</div>
              <input value={cargoActual} onChange={e => setCargoActual(e.target.value)}
                placeholder="Ej: Analista de Talento Humano" style={inputStyle} />
            </label>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Área o departamento *</div>
              <input value={area} onChange={e => setArea(e.target.value)}
                placeholder="Ej: Talento Humano, Finanzas, Operaciones..." style={inputStyle} />
            </label>

            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '14px 16px', marginBottom: 28, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Jerarquía (opcional)</div>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>⬆️ Supervisado por</div>
                <input value={supervisadoPor} onChange={e => setSupervisadoPor(e.target.value)}
                  placeholder="Cargo de tu jefe directo" style={inputStyle} />
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>⬇️ Supervisa a</div>
                <input value={supervisaA} onChange={e => setSupervisaA(e.target.value)}
                  placeholder="Cargos que supervisa (si aplica)" style={inputStyle} />
              </label>
            </div>

            <button onClick={() => setPaso(2)} disabled={!nombre.trim() || !cargoActual.trim() || !area.trim()}
              style={{
                width: '100%', padding: '.7rem', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 14,
                background: nombre && cargoActual && area ? GOLD : '#e5e7eb',
                color: nombre && cargoActual && area ? DARK : '#9ca3af',
                cursor: nombre && cargoActual && area ? 'pointer' : 'not-allowed',
              }}>
              Continuar →
            </button>
          </div>
        )}

        {/* PASO 2 — Actividades */}
        {paso === 2 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '1.75rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 18 }}>¿Qué haces en tu trabajo?</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
              Describe tus actividades del día a día. Sé específico — en vez de &quot;atender clientes&quot;, escribe &quot;responder consultas por teléfono y correo&quot;.
              <br /><strong style={{ color: DARK }}>Necesitas al menos 3 completas para continuar.</strong>
            </p>

            {actividades.map((act, i) => (
              <div key={i} style={{ marginBottom: 16, padding: '1rem', background: '#f9fafb', borderRadius: 8, border: `1px solid ${act.descripcion && act.frecuencia && act.dificultad && act.consecuencia ? 'rgba(45,106,79,0.3)' : '#e5e7eb'}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>ACTIVIDAD {i + 1}</div>
                <textarea
                  value={act.descripcion}
                  onChange={e => setActividades(prev => prev.map((a, j) => j === i ? { ...a, descripcion: e.target.value } : a))}
                  placeholder="¿Qué haces exactamente en esta actividad?"
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
                          {op.label.split(' — ')[0]}
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
                          {op.label.split(' — ')[0]}
                        </label>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Si fallo, las consecuencias serían...</div>
                      {OPCIONES_CONSECUENCIA.map(op => (
                        <label key={op.valor} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer', fontSize: 12, color: '#374151', marginBottom: 4 }}>
                          <input type="radio" name={`cons-${i}`} value={op.valor} checked={act.consecuencia === op.valor}
                            onChange={() => setActividades(prev => prev.map((a, j) => j === i ? { ...a, consecuencia: op.valor } : a))}
                            style={{ marginTop: 2 }} />
                          {op.label.split(' — ')[0]}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <button
                onClick={() => setActividades(prev => [...prev, { descripcion: '', frecuencia: '', dificultad: '', consecuencia: '' }])}
                disabled={actividades.length >= 20}
                style={{ background: 'none', border: `1px dashed ${GOLD}`, color: GOLD, padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                + Agregar actividad
              </button>
              <div style={{ fontSize: 12, color: actividadesValidas.length >= 3 ? '#2d6a4f' : '#9ca3af', fontWeight: 600 }}>
                {actividadesValidas.length} actividad{actividadesValidas.length !== 1 ? 'es' : ''} completa{actividadesValidas.length !== 1 ? 's' : ''}
              </div>
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
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Escribe uno por línea.</p>

            <label style={{ display: 'block', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 4 }}>¿Qué programas o herramientas usas?</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>Ej: Excel, SAP, Teams, cámara, vehículo...</div>
              <textarea value={herramientas} onChange={e => setHerramientas(e.target.value)} rows={4}
                placeholder={"Excel\nSistema de nómina\nTeléfono IP"}
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#111', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </label>

            <label style={{ display: 'block', marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 4 }}>¿Qué conocimientos necesitas para hacer tu trabajo?</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>Ej: Manual de correspondencia, Manual de la fundación, normas internas...</div>
              <textarea value={conocimientos} onChange={e => setConocimientos(e.target.value)} rows={4}
                placeholder={"Legislación laboral\nGestión documental\nAtención al cliente"}
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

        {/* PASO 4 — Perfil */}
        {paso === 4 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '1.75rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 18 }}>Tu formación y experiencia</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Último paso — ya casi terminas.</p>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Nivel de educación más alto alcanzado *</div>
              <select value={nivelEducativo} onChange={e => setNivelEducativo(e.target.value)}
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: nivelEducativo ? '#111' : '#9ca3af', outline: 'none', boxSizing: 'border-box' }}>
                <option value=''>Selecciona...</option>
                {NIVELES_EDUCATIVOS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Carrera o área de estudio</div>
              <input value={carrera} onChange={e => setCarrera(e.target.value)}
                placeholder="Ej: Psicología, Administración, Ingeniería Industrial..."
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
            </label>

            <label style={{ display: 'block', marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Años de experiencia en este tipo de trabajo</div>
              <input type="number" min="0" max="50" value={experienciaAnios} onChange={e => setExperienciaAnios(e.target.value)}
                placeholder="Ej: 5"
                style={{ width: 140, padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111', outline: 'none' }} />
            </label>

            {/* Resumen */}
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: 24, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: DARK, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tu respuesta incluye</div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 2 }}>
                <div>· Nombre: <strong>{nombre}</strong> — {cargoActual} ({area})</div>
                <div>· {actividadesValidas.length} actividades registradas</div>
                <div>· {herramientas.split('\n').filter(Boolean).length} herramientas / {conocimientos.split('\n').filter(Boolean).length} conocimientos</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPaso(3)}
                style={{ background: '#f3f4f6', color: '#374151', padding: '.6rem 1.25rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                ← Atrás
              </button>
              <button onClick={handleEnviar} disabled={!nivelEducativo || guardando}
                style={{
                  flex: 1, padding: '.6rem', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 14,
                  background: nivelEducativo && !guardando ? DARK : '#e5e7eb',
                  color: nivelEducativo && !guardando ? 'white' : '#9ca3af',
                  cursor: nivelEducativo && !guardando ? 'pointer' : 'not-allowed',
                }}>
                {guardando ? 'Enviando...' : 'Enviar mi información'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

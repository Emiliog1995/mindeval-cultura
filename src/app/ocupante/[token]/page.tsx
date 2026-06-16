'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const DARK = '#0A1A32'
const GOLD = '#10b981'

type Actividad = {
  descripcion: string
  frecuencia: string
  dificultad: string
  consecuencia: string
}

type Puesto = {
  id: string
  nombre_puesto: string
  area: string
  empresas_mdt?: { nombre: string }[]
  estado_ocupante?: string
}

const OPCIONES_FRECUENCIA = [
  { valor: 'diaria', label: 'Diaria — La hago todos los días' },
  { valor: 'semanal', label: 'Semanal — La hago varias veces por semana' },
  { valor: 'mensual', label: 'Mensual — La hago algunas veces al mes' },
  { valor: 'eventual', label: 'Eventual — La hago de vez en cuando' },
]

const OPCIONES_DIFICULTAD = [
  { valor: 'simple', label: 'Simple — Sigo pasos establecidos' },
  { valor: 'analisis', label: 'Requiere análisis — Evalúo opciones antes de actuar' },
  { valor: 'compleja', label: 'Compleja — Tomo decisiones importantes con poca guía' },
]

const OPCIONES_CONSECUENCIA = [
  { valor: 'minima', label: 'Mínima — Si fallo, el impacto es pequeño y se corrige fácil' },
  { valor: 'moderada', label: 'Moderada — Si fallo, afecta a mi área o equipo' },
  { valor: 'alta', label: 'Alta — Si fallo, afecta a toda la empresa o clientes' },
]

const NIVELES_EDUCATIVOS = [
  'Bachillerato', 'Técnico / Tecnológico', 'Tercer nivel (Ingeniería / Licenciatura)',
  'Cuarto nivel (Maestría)', 'Doctorado',
]

export default function FormularioOcupante() {
  const { token } = useParams<{ token: string }>()
  const [puesto, setPuesto] = useState<Puesto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [enviado, setEnviado] = useState(false)
  const [paso, setPaso] = useState(1)
  const [guardando, setGuardando] = useState(false)

  // Datos del ocupante
  const [nombre, setNombre] = useState('')
  const [cargoActual, setCargoActual] = useState('')
  const [supervisadoPor, setSupervisadoPor] = useState('')
  const [supervisaA, setSupervisaA] = useState('')

  // Actividades
  const [actividades, setActividades] = useState<Actividad[]>(
    Array(6).fill(null).map(() => ({ descripcion: '', frecuencia: '', dificultad: '', consecuencia: '' }))
  )

  // Herramientas y conocimientos
  const [herramientas, setHerramientas] = useState('')
  const [conocimientos, setConocimientos] = useState('')

  // Perfil
  const [nivelEducativo, setNivelEducativo] = useState('')
  const [carrera, setCarrera] = useState('')
  const [experienciaAnios, setExperienciaAnios] = useState('')

  useEffect(() => {
    supabase
      .from('puestos')
      .select('id, nombre_puesto, area, estado_ocupante, empresas_mdt(nombre)')
      .eq('token', token)
      .single()
      .then(({ data }) => {
        setPuesto(data)
        setCargando(false)
      })
  }, [token])

  const actividadesValidas = actividades.filter(a => a.descripcion.trim() && a.frecuencia && a.dificultad && a.consecuencia)

  const handleEnviar = async () => {
    if (!puesto || actividadesValidas.length < 3) return
    setGuardando(true)

    const herramientasArr = herramientas.split('\n').map(h => h.trim()).filter(Boolean)
    const conocimientosArr = conocimientos.split('\n').map(c => c.trim()).filter(Boolean)

    await supabase.from('respuestas_ocupante').insert({
      puesto_id: puesto.id,
      nombre,
      cargo_actual: cargoActual,
      supervisado_por: supervisadoPor || null,
      supervisa_a: supervisaA || null,
      actividades: actividadesValidas,
      herramientas: herramientasArr,
      conocimientos: conocimientosArr,
      nivel_educativo: nivelEducativo,
      carrera,
      experiencia_anios: parseInt(experienciaAnios) || 0,
    })

    await supabase.from('puestos').update({ estado_ocupante: 'completado' }).eq('id', puesto.id)
    setGuardando(false)
    setEnviado(true)
  }

  if (cargando) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: GOLD, fontSize: 16 }}>Cargando...</div>
    </div>
  )

  if (!puesto) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Enlace no válido</div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Este enlace no existe o ya no está disponible.</div>
    </div>
  )

  if (enviado || puesto.estado_ocupante === 'completado') return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '2rem' }}>
      <div style={{ fontSize: 48 }}>✓</div>
      <div style={{ color: GOLD, fontSize: 22, fontWeight: 700, textAlign: 'center' }}>¡Gracias por tu información!</div>
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', maxWidth: 400 }}>
        Tu respuesta fue registrada exitosamente. El consultor de MINDTALENT revisará la información y se pondrá en contacto contigo.
      </div>
      <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
        Puesto: {puesto.nombre_puesto} · {puesto.area}
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
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {puesto.empresas_mdt?.[0]?.nombre ?? 'Diagnóstico de Puesto'}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Paso {paso} de {totalPasos}</div>
        </div>
        {/* Barra de progreso */}
        <div style={{ maxWidth: 680, margin: '10px auto 0', height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 99 }}>
          <div style={{ height: '100%', background: GOLD, borderRadius: 99, width: `${(paso / totalPasos) * 100}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Título del puesto */}
        <div style={{ background: 'white', borderRadius: 10, padding: '1.25rem 1.5rem', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)', borderLeft: `4px solid ${GOLD}` }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Estás completando información para el puesto:</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: DARK }}>{puesto.nombre_puesto}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{puesto.area}</div>
        </div>

        {/* PASO 1 — Datos personales */}
        {paso === 1 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 17 }}>Cuéntanos quién eres</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Esta información nos ayuda a identificar tu respuesta.</p>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Tu nombre completo</div>
              <input value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Ej: María González"
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
            </label>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Tu cargo actual</div>
              <input value={cargoActual} onChange={e => setCargoActual(e.target.value)}
                placeholder="Ej: Analista de Talento Humano"
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
            </label>

            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '14px 16px', marginBottom: 24, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Jerarquía (opcional)</div>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>⬆️ Supervisado por</div>
                <input value={supervisadoPor} onChange={e => setSupervisadoPor(e.target.value)}
                  placeholder="Cargo de tu jefe directo"
                  style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>⬇️ Supervisa a</div>
                <input value={supervisaA} onChange={e => setSupervisaA(e.target.value)}
                  placeholder="Cargos que supervisa (si aplica)"
                  style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
              </label>
            </div>

            <button onClick={() => setPaso(2)} disabled={!nombre.trim() || !cargoActual.trim()}
              style={{ background: nombre && cargoActual ? GOLD : '#e5e7eb', color: nombre && cargoActual ? DARK : '#9ca3af', padding: '.6rem 1.5rem', borderRadius: 6, border: 'none', cursor: nombre && cargoActual ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 14, width: '100%' }}>
              Continuar →
            </button>
          </div>
        )}

        {/* PASO 2 — Actividades */}
        {paso === 2 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 17 }}>¿Qué haces en tu trabajo?</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
              Describe tus actividades principales. Necesitas al menos 3 completas para continuar.
              <br />Sé específico: en vez de &quot;atender clientes&quot;, escribe &quot;responder consultas de clientes por teléfono y correo&quot;.
            </p>

            {actividades.map((act, i) => (
              <div key={i} style={{ marginBottom: 20, padding: '1rem', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: DARK, marginBottom: 8 }}>Actividad {i + 1}</div>

                <textarea
                  value={act.descripcion}
                  onChange={e => setActividades(prev => prev.map((a, j) => j === i ? { ...a, descripcion: e.target.value } : a))}
                  placeholder="Describe la actividad..."
                  rows={2}
                  style={{ width: '100%', padding: '.5rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#111', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }}
                />

                {act.descripcion.trim() && (<>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>¿Con qué frecuencia la haces?</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                    {OPCIONES_FRECUENCIA.map(op => (
                      <label key={op.valor} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                        <input type="radio" name={`freq-${i}`} value={op.valor} checked={act.frecuencia === op.valor}
                          onChange={() => setActividades(prev => prev.map((a, j) => j === i ? { ...a, frecuencia: op.valor } : a))} />
                        {op.label}
                      </label>
                    ))}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>¿Qué tan difícil es?</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                    {OPCIONES_DIFICULTAD.map(op => (
                      <label key={op.valor} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                        <input type="radio" name={`dif-${i}`} value={op.valor} checked={act.dificultad === op.valor}
                          onChange={() => setActividades(prev => prev.map((a, j) => j === i ? { ...a, dificultad: op.valor } : a))} />
                        {op.label}
                      </label>
                    ))}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>¿Qué pasa si la haces mal?</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {OPCIONES_CONSECUENCIA.map(op => (
                      <label key={op.valor} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                        <input type="radio" name={`cons-${i}`} value={op.valor} checked={act.consecuencia === op.valor}
                          onChange={() => setActividades(prev => prev.map((a, j) => j === i ? { ...a, consecuencia: op.valor } : a))} />
                        {op.label}
                      </label>
                    ))}
                  </div>
                </>)}
              </div>
            ))}

            <div style={{ fontSize: 12, color: actividadesValidas.length >= 3 ? '#2d6a4f' : '#6b7280', marginBottom: 12, textAlign: 'right' }}>
              {actividadesValidas.length} / {actividades.length} actividades completas
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPaso(1)}
                style={{ background: '#f3f4f6', color: '#374151', padding: '.6rem 1.25rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                ← Atrás
              </button>
              <button onClick={() => setPaso(3)} disabled={actividadesValidas.length < 3}
                style={{ flex: 1, background: actividadesValidas.length >= 3 ? GOLD : '#e5e7eb', color: actividadesValidas.length >= 3 ? DARK : '#9ca3af', padding: '.6rem 1.5rem', borderRadius: 6, border: 'none', cursor: actividadesValidas.length >= 3 ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 14 }}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* PASO 3 — Herramientas y conocimientos */}
        {paso === 3 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 17 }}>Herramientas y conocimientos</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
              Escribe uno por línea. No hay respuestas correctas o incorrectas.
            </p>

            <label style={{ display: 'block', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>
                ¿Qué programas, sistemas o herramientas usas?
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Ej: Excel, SAP, correo electrónico, cámara digital...</div>
              <textarea value={herramientas} onChange={e => setHerramientas(e.target.value)}
                rows={4} placeholder={"Excel\nSistema de nómina\nTeléfono IP"}
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#111', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </label>

            <label style={{ display: 'block', marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>
                ¿Qué conocimientos o temas necesitas dominar para hacer tu trabajo?
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Ej: Legislación laboral, atención al cliente, contabilidad básica...</div>
              <textarea value={conocimientos} onChange={e => setConocimientos(e.target.value)}
                rows={4} placeholder={"Legislación laboral\nGestión de personal\nAtención al cliente"}
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#111', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPaso(2)}
                style={{ background: '#f3f4f6', color: '#374151', padding: '.6rem 1.25rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                ← Atrás
              </button>
              <button onClick={() => setPaso(4)}
                style={{ flex: 1, background: GOLD, color: DARK, padding: '.6rem 1.5rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* PASO 4 — Perfil */}
        {paso === 4 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 17 }}>Tu formación y experiencia</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
              Cuéntanos sobre tu preparación académica y experiencia.
            </p>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Nivel de educación más alto alcanzado</div>
              <select value={nivelEducativo} onChange={e => setNivelEducativo(e.target.value)}
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: nivelEducativo ? '#111' : '#9ca3af', outline: 'none', boxSizing: 'border-box' }}>
                <option value=''>Selecciona...</option>
                {NIVELES_EDUCATIVOS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Carrera o área de estudio</div>
              <input value={carrera} onChange={e => setCarrera(e.target.value)}
                placeholder="Ej: Psicología Organizacional, Administración de Empresas..."
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
            </label>

            <label style={{ display: 'block', marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Años de experiencia en este tipo de trabajo</div>
              <input type="number" min="0" max="50" value={experienciaAnios} onChange={e => setExperienciaAnios(e.target.value)}
                placeholder="Ej: 3"
                style={{ width: 120, padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111', outline: 'none' }} />
            </label>

            {/* Resumen antes de enviar */}
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1rem', marginBottom: 20, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: DARK, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Resumen de tu respuesta</div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
                <div>· {actividadesValidas.length} actividades registradas</div>
                <div>· {herramientas.split('\n').filter(Boolean).length} herramientas indicadas</div>
                <div>· {conocimientos.split('\n').filter(Boolean).length} conocimientos indicados</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPaso(3)}
                style={{ background: '#f3f4f6', color: '#374151', padding: '.6rem 1.25rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                ← Atrás
              </button>
              <button onClick={handleEnviar} disabled={!nivelEducativo || guardando}
                style={{
                  flex: 1, background: nivelEducativo && !guardando ? DARK : '#e5e7eb',
                  color: nivelEducativo && !guardando ? 'white' : '#9ca3af',
                  padding: '.6rem 1.5rem', borderRadius: 6, border: 'none',
                  cursor: nivelEducativo && !guardando ? 'pointer' : 'not-allowed',
                  fontWeight: 700, fontSize: 14,
                }}>
                {guardando ? 'Enviando...' : 'Enviar respuesta'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

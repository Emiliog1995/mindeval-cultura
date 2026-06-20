'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

const DARK = '#0A1A32'
const GOLD = '#10b981'

type Actividad = {
  descripcion: string
  frecuencia: string
  dificultad: string
  consecuencia: string
}

type CatalogoPuesto = {
  nombre_puesto: string
  area: string
  supervisado_por: string
  supervisa_a: string
  actividades: string[]
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

function RatingGroup({
  label, name, opciones, valor, onChange,
}: {
  label: string
  name: string
  opciones: { valor: string; label: string }[]
  valor: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</div>
      {opciones.map(op => (
        <label key={op.valor} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer', fontSize: 12, color: '#374151', marginBottom: 4 }}>
          <input type="radio" name={name} value={op.valor} checked={valor === op.valor}
            onChange={() => onChange(op.valor)}
            style={{ marginTop: 2, accentColor: GOLD }} />
          {op.label}
        </label>
      ))}
    </div>
  )
}

export default function FormularioEmpresa() {
  const { token } = useParams<{ token: string }>()
  const [empresa, setEmpresa] = useState<{ id: string; nombre: string; logo_url?: string } | null>(null)
  const [catalogo, setCatalogo] = useState<CatalogoPuesto[]>([])
  const [cargando, setCargando] = useState(true)
  const [enviado, setEnviado] = useState(false)
  const [paso, setPaso] = useState(1)
  const [guardando, setGuardando] = useState(false)
  const [consentimiento, setConsentimiento] = useState(false)
  const submittedRef = useRef(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 600)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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

  const tieneCatalogo = catalogo.length > 0
  const puestoSeleccionado = catalogo.find(p => p.nombre_puesto === cargoActual) ?? null

  useEffect(() => {
    fetch(`/api/token/ocupante-empresa/${token}`)
      .then(async (r) => {
        if (!r.ok) return null
        return r.json()
      })
      .then((body) => {
        if (!body) { setCargando(false); return }
        setEmpresa(body.empresa)
        setCatalogo(body.catalogo ?? [])
        setCargando(false)
      })
  }, [token])

  const handleSeleccionarPuesto = (nombrePuesto: string) => {
    setCargoActual(nombrePuesto)
    const puesto = catalogo.find(p => p.nombre_puesto === nombrePuesto)
    if (!puesto) {
      setArea('')
      setSupervisadoPor('')
      setSupervisaA('')
      setActividades(Array(8).fill(null).map(() => ({ descripcion: '', frecuencia: '', dificultad: '', consecuencia: '' })))
      return
    }
    setArea(puesto.area)
    setSupervisadoPor(puesto.supervisado_por)
    setSupervisaA(puesto.supervisa_a)
    setActividades(puesto.actividades.map(desc => ({ descripcion: desc, frecuencia: '', dificultad: '', consecuencia: '' })))
  }

  const actividadesValidas = actividades.filter(
    a => a.descripcion.trim() && a.frecuencia && a.dificultad && a.consecuencia
  )

  const handleEnviar = async () => {
    if (!empresa || actividadesValidas.length < 3) return
    if (submittedRef.current) return
    submittedRef.current = true
    setGuardando(true)

    const res = await fetch(`/api/token/ocupante-empresa/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        cargoActual,
        area,
        supervisadoPor,
        supervisaA,
        actividades: actividadesValidas,
        herramientas: herramientas.split('\n').map(h => h.trim()).filter(Boolean),
        conocimientos: conocimientos.split('\n').map(c => c.trim()).filter(Boolean),
        nivelEducativo,
        carrera,
        experienciaAnios,
      }),
    })

    setGuardando(false)
    if (!res.ok) {
      submittedRef.current = false
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

  const inputReadonlyStyle: React.CSSProperties = {
    ...inputStyle,
    background: '#f3f4f6',
    color: '#6b7280',
  }

  const camposAutocompletados = tieneCatalogo && !!puestoSeleccionado

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
                placeholder="Ej: María González" style={inputStyle} maxLength={120} autoComplete="name" />
            </label>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Tu cargo o título del puesto *</div>
              {tieneCatalogo ? (
                <select
                  value={cargoActual}
                  onChange={e => handleSeleccionarPuesto(e.target.value)}
                  style={{ ...inputStyle, color: cargoActual ? '#111' : '#9ca3af' }}
                >
                  <option value=''>Selecciona tu cargo...</option>
                  {catalogo.map(p => (
                    <option key={p.nombre_puesto} value={p.nombre_puesto}>{p.nombre_puesto}</option>
                  ))}
                </select>
              ) : (
                <input value={cargoActual} onChange={e => setCargoActual(e.target.value)}
                  placeholder="Ej: Analista de Talento Humano" style={inputStyle} maxLength={120} autoComplete="organization-title" />
              )}
            </label>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Área o departamento *</div>
              <input
                value={area}
                onChange={e => setArea(e.target.value)}
                readOnly={camposAutocompletados}
                placeholder="Ej: Talento Humano, Finanzas, Operaciones..."
                style={camposAutocompletados ? inputReadonlyStyle : inputStyle}
                maxLength={120}
                autoComplete="off"
              />
            </label>

            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '14px 16px', marginBottom: 28, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Jerarquía {!tieneCatalogo && <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional)</span>}
              </div>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>⬆️ Supervisado por</div>
                <input
                  value={supervisadoPor}
                  onChange={e => setSupervisadoPor(e.target.value)}
                  readOnly={camposAutocompletados}
                  placeholder="Cargo de tu jefe directo"
                  style={camposAutocompletados ? inputReadonlyStyle : inputStyle}
                />
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>⬇️ Supervisa a</div>
                <input
                  value={supervisaA}
                  onChange={e => setSupervisaA(e.target.value)}
                  readOnly={camposAutocompletados}
                  placeholder="Cargos que supervisa (si aplica)"
                  style={camposAutocompletados ? inputReadonlyStyle : inputStyle}
                />
              </label>
            </div>

            {/* Consentimiento LOPDP */}
            <div style={{ background: '#f8f6f0', borderLeft: '3px solid #10b981', borderRadius: 6, padding: '12px 14px', marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: '#0A1A32', margin: 0, lineHeight: 1.6 }}>
                Tu información se usa <strong>exclusivamente</strong> para elaborar el descriptor de tu puesto. Solo el área de Talento Humano y el consultor de MINDTALENT tendrán acceso a tus datos.
              </p>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
              <input
                type="checkbox"
                checked={consentimiento}
                onChange={e => setConsentimiento(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: GOLD, flexShrink: 0 }}
              />
              <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                He leído y acepto el{' '}
                <a href="/privacidad" target="_blank" rel="noopener noreferrer"
                  style={{ color: DARK, fontWeight: 700, textDecoration: 'underline' }}>
                  Aviso de Privacidad
                </a>{' '}
                y autorizo el tratamiento de mis datos personales conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP).
              </span>
            </label>

            <button onClick={() => setPaso(2)} disabled={!nombre.trim() || !cargoActual.trim() || !area.trim() || !consentimiento}
              style={{
                width: '100%', padding: '.7rem', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 14,
                background: nombre && cargoActual && area && consentimiento ? GOLD : '#e5e7eb',
                color: nombre && cargoActual && area && consentimiento ? DARK : '#9ca3af',
                cursor: nombre && cargoActual && area && consentimiento ? 'pointer' : 'not-allowed',
              }}>
              Continuar →
            </button>
          </div>
        )}

        {/* PASO 2 — Actividades */}
        {paso === 2 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '1.75rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 18 }}>¿Qué haces en tu trabajo?</h2>

            {puestoSeleccionado ? (
              <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
                Estas son las actividades de tu cargo. Para cada una, indica con qué frecuencia la realizas, qué tan compleja es y qué pasaría si cometieras un error.
                <br /><strong style={{ color: DARK }}>Debes calificar al menos 3 para continuar.</strong>
              </p>
            ) : (
              <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>
                Describe tus actividades del día a día. Sé específico — en vez de &quot;atender clientes&quot;, escribe &quot;responder consultas por teléfono y correo&quot;.
                <br /><strong style={{ color: DARK }}>Necesitas al menos 3 completas para continuar.</strong>
              </p>
            )}

            {actividades.map((act, i) => (
              <div key={i} style={{
                marginBottom: 16, padding: '1rem', background: '#f9fafb', borderRadius: 8,
                border: `1px solid ${act.descripcion && act.frecuencia && act.dificultad && act.consecuencia ? 'rgba(16,185,129,0.4)' : '#e5e7eb'}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>ACTIVIDAD {i + 1}</div>

                {puestoSeleccionado ? (
                  <>
                    <div style={{ fontSize: 13, color: DARK, fontWeight: 500, marginBottom: 12, lineHeight: 1.5 }}>
                      {act.descripcion}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
                      <RatingGroup label="Frecuencia" name={`freq-${i}`} opciones={OPCIONES_FRECUENCIA} valor={act.frecuencia}
                        onChange={v => setActividades(prev => prev.map((a, j) => j === i ? { ...a, frecuencia: v } : a))} />
                      <RatingGroup label="Dificultad" name={`dif-${i}`} opciones={OPCIONES_DIFICULTAD} valor={act.dificultad}
                        onChange={v => setActividades(prev => prev.map((a, j) => j === i ? { ...a, dificultad: v } : a))} />
                      <RatingGroup label="Si fallo, las consecuencias serían..." name={`cons-${i}`} opciones={OPCIONES_CONSECUENCIA} valor={act.consecuencia}
                        onChange={v => setActividades(prev => prev.map((a, j) => j === i ? { ...a, consecuencia: v } : a))} />
                    </div>
                  </>
                ) : (
                  <>
                    <textarea
                      value={act.descripcion}
                      onChange={e => setActividades(prev => prev.map((a, j) => j === i ? { ...a, descripcion: e.target.value } : a))}
                      placeholder="¿Qué haces exactamente en esta actividad?"
                      rows={2} maxLength={500}
                      style={{ width: '100%', padding: '.5rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#111', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: act.descripcion.trim() ? 12 : 0 }}
                    />
                    {act.descripcion.trim() && (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
                        <RatingGroup label="Frecuencia" name={`freq-${i}`} opciones={OPCIONES_FRECUENCIA} valor={act.frecuencia}
                          onChange={v => setActividades(prev => prev.map((a, j) => j === i ? { ...a, frecuencia: v } : a))} />
                        <RatingGroup label="Dificultad" name={`dif-${i}`} opciones={OPCIONES_DIFICULTAD} valor={act.dificultad}
                          onChange={v => setActividades(prev => prev.map((a, j) => j === i ? { ...a, dificultad: v } : a))} />
                        <RatingGroup label="Si fallo, las consecuencias serían..." name={`cons-${i}`} opciones={OPCIONES_CONSECUENCIA} valor={act.consecuencia}
                          onChange={v => setActividades(prev => prev.map((a, j) => j === i ? { ...a, consecuencia: v } : a))} />
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {!puestoSeleccionado && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <button
                  onClick={() => setActividades(prev => [...prev, { descripcion: '', frecuencia: '', dificultad: '', consecuencia: '' }])}
                  disabled={actividades.length >= 20}
                  style={{ background: 'none', border: `1px dashed ${GOLD}`, color: GOLD, padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  + Agregar actividad
                </button>
                <div style={{ fontSize: 12, color: actividadesValidas.length >= 3 ? '#059669' : '#9ca3af', fontWeight: 600 }}>
                  {actividadesValidas.length} actividad{actividadesValidas.length !== 1 ? 'es' : ''} completa{actividadesValidas.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            {puestoSeleccionado && (
              <div style={{ fontSize: 12, color: actividadesValidas.length === actividades.length ? '#059669' : '#6b7280', fontWeight: 600, marginBottom: 12, textAlign: 'right' }}>
                {actividadesValidas.length} de {actividades.length} actividades calificadas
              </div>
            )}

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
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>Ej: Excel, Abila, Marylink, Teams, cámara, vehículo...</div>
              <textarea value={herramientas} onChange={e => setHerramientas(e.target.value)} rows={4}
                placeholder={"Excel\nSistema de nómina\nTeléfono IP"} maxLength={1000}
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#111', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </label>

            <label style={{ display: 'block', marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 4 }}>¿Qué conocimientos necesitas para hacer tu trabajo?</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>Ej: Manual de correspondencia, políticas de Kansas, normativa tributaria...</div>
              <textarea value={conocimientos} onChange={e => setConocimientos(e.target.value)} rows={4}
                placeholder={"Legislación laboral\nGestión documental\nAtención al cliente"} maxLength={1000}
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
                placeholder="Ej: Psicología, Contabilidad, Trabajo Social..."
                style={{ width: '100%', padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
            </label>

            <label style={{ display: 'block', marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 6 }}>Años de experiencia en este tipo de trabajo</div>
              <input type="number" min="0" max="50" value={experienciaAnios} onChange={e => setExperienciaAnios(e.target.value)}
                placeholder="Ej: 5"
                style={{ width: 140, padding: '.6rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111', outline: 'none' }} />
            </label>

            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: 24, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: DARK, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tu respuesta incluye</div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 2 }}>
                <div>· Nombre: <strong>{nombre}</strong> — {cargoActual} ({area})</div>
                <div>· {actividadesValidas.length} actividades calificadas</div>
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

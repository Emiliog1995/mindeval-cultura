'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const DARK = '#0A1A32'
const GOLD = '#10b981'
const NAVY = '#1E2D5A'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '.55rem .75rem', border: '1.5px solid #d1d5db',
  borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#0A1A32', marginBottom: 6,
}

export default function EditarPuesto() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [paso, setPaso] = useState(1)

  const [datos, setDatos] = useState({
    nombre_puesto: '', area: '', supervisado_por: '', supervisa_a: '', mision: '', fecha: '',
  })
  const [instruccion, setInstruccion] = useState({
    nivel_educativo: '', titulo: '', area_especializacion: '',
    experiencia_tipo: '', experiencia_anios: '',
  })
  const [conocimientosTexto, setConocimientosTexto] = useState('')
  const [destrezasTexto, setDestrezasTexto] = useState('')
  const [conductualesTexto, setConducualesTexto] = useState('')
  const [instruccionId, setInstruccionId] = useState<string | null>(null)
  const [actividades, setActividades] = useState<{ descripcion: string; es_esencial: boolean; frecuencia: number; consecuencia: number; complejidad: number }[]>([])
  const [respuestaOcupante, setRespuestaOcupante] = useState<{
    nombre?: string; cargo_actual?: string; actividades?: { descripcion: string; frecuencia: string; dificultad: string; consecuencia: string }[];
    herramientas?: string[]; conocimientos?: string[]; nivel_educativo?: string; carrera?: string; experiencia_anios?: number;
  } | null>(null)
  const [verOcupante, setVerOcupante] = useState(false)

  // Estados IA
  const [sugiriendoMision, setSugiriendoMision] = useState(false)
  const [sugiriendoCompetencias, setSugiriendoCompetencias] = useState(false)
  const [mensajeIA, setMensajeIA] = useState('')
  const [mensajeError, setMensajeError] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('puestos').select('*').eq('id', id).single(),
      supabase.from('instruccion_puesto').select('*').eq('puesto_id', id).single(),
      supabase.from('competencias_puesto').select('*').eq('puesto_id', id),
      supabase.from('actividades_puesto').select('*').eq('puesto_id', id).order('orden'),
      supabase.from('respuestas_ocupante').select('*').eq('puesto_id', id).order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
    ]).then(([{ data: p }, { data: inst }, { data: comps }, { data: acts }, { data: resp }]) => {
      if (resp) setRespuestaOcupante(resp)
      if (p) setDatos({
        nombre_puesto: p.nombre_puesto ?? '',
        area: p.area ?? '',
        supervisado_por: p.supervisado_por ?? '',
        supervisa_a: p.supervisa_a ?? '',
        mision: p.mision ?? '',
        fecha: p.fecha ?? '',
      })
      if (inst) {
        setInstruccionId(inst.id)
        setInstruccion({
          nivel_educativo: inst.nivel_educativo ?? '',
          titulo: inst.titulo ?? '',
          area_especializacion: inst.area_especializacion ?? '',
          experiencia_tipo: inst.experiencia_tipo ?? '',
          experiencia_anios: inst.experiencia_anios ?? '',
        })
      }
      if (comps && comps.length > 0) {
        const toText = (tipos: string[]) => comps.filter((c: { tipo: string; descripcion: string }) => tipos.includes(c.tipo)).map((c: { descripcion: string }) => c.descripcion).join('\n')
        setConocimientosTexto(toText(['conocimiento']))
        setDestrezasTexto(toText(['destreza_general', 'destreza_especifica']))
        setConducualesTexto(toText(['capacidad']))
      }
      if (acts) setActividades(acts)
      setLoading(false)
    })
  }, [id])

  const sugerirMision = async () => {
    if (!datos.nombre_puesto) return
    setSugiriendoMision(true)
    setMensajeIA('')
    setMensajeError(false)
    try {
      const actDesc = actividades.map(a => a.descripcion).filter(Boolean)
      const res = await fetch('/api/sugerir-mision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_puesto: datos.nombre_puesto, area: datos.area, actividades: actDesc }),
      })
      const data = await res.json()
      if (data.mision) {
        setDatos(d => ({ ...d, mision: data.mision }))
        setMensajeIA('Misión generada — puedes editarla.')
      }
    } catch (e) {
      setMensajeIA(`Error: ${e instanceof Error ? e.message : 'Error desconocido'}`)
      setMensajeError(true)
    }
    setSugiriendoMision(false)
  }

  const sugerirCompetencias = async () => {
    setSugiriendoCompetencias(true)
    setMensajeIA('')
    setMensajeError(false)
    try {
      const esenciales = actividades.filter(a => a.es_esencial)
      const fuente = esenciales.length > 0 ? esenciales : actividades
      const res = await fetch('/api/sugerir-competencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_puesto: datos.nombre_puesto,
          area: datos.area,
          actividades_esenciales: fuente.map(a => ({
            descripcion: a.descripcion,
            total: a.frecuencia && a.consecuencia && a.complejidad
              ? a.frecuencia + a.consecuencia * a.complejidad
              : undefined,
          })),
        }),
      })
      if (!res.ok) {
        const errBody = await res.text()
        setMensajeIA(`Error ${res.status}: ${errBody.slice(0, 120)}`)
        setMensajeError(true)
        setSugiriendoCompetencias(false)
        return
      }
      const data = await res.json()

      const conocimientos = (data.conocimientos ?? []).map((c: { descripcion: string }) => c.descripcion)
      const destrezasGen = (data.destrezas_generales ?? []).map((d: { codigo: string; nombre: string; descripcion: string }) => `${d.codigo} — ${d.nombre}: ${d.descripcion}`)
      const destrezasEsp = [
        ...(data.destrezas_especificas?.informaticos ?? []),
        ...(data.destrezas_especificas?.idiomas ?? []),
        ...(data.destrezas_especificas?.equipos ?? []),
      ]
      const conductuales = (data.capacidades ?? []).map((c: { descripcion: string }) => c.descripcion)

      setConocimientosTexto(conocimientos.join('\n'))
      setDestrezasTexto([...destrezasGen, ...destrezasEsp].join('\n'))
      setConducualesTexto(conductuales.join('\n'))
      setMensajeIA(`IA sugirió ${conocimientos.length} conocimientos, ${destrezasGen.length + destrezasEsp.length} destrezas y ${conductuales.length} conductuales — puedes editarlos.`)
    } catch (e) {
      setMensajeIA(`Error: ${e instanceof Error ? e.message : 'Error desconocido'}`)
      setMensajeError(true)
    }
    setSugiriendoCompetencias(false)
  }

  const guardar = async () => {
    setGuardando(true)
    await supabase.from('puestos').update({
      nombre_puesto: datos.nombre_puesto,
      area: datos.area,
      supervisado_por: datos.supervisado_por,
      supervisa_a: datos.supervisa_a,
      mision: datos.mision,
      fecha: datos.fecha,
    }).eq('id', id)

    const instData = {
      nivel_educativo: instruccion.nivel_educativo,
      titulo: instruccion.titulo,
      area_especializacion: instruccion.area_especializacion,
      experiencia_tipo: instruccion.experiencia_tipo,
      experiencia_anios: instruccion.experiencia_anios ? Number(instruccion.experiencia_anios) : null,
    }
    if (instruccionId) {
      await supabase.from('instruccion_puesto').update(instData).eq('id', instruccionId)
    } else {
      await supabase.from('instruccion_puesto').insert({ puesto_id: id, ...instData })
    }

    await supabase.from('competencias_puesto').delete().eq('puesto_id', id)
    const nuevas = [
      ...conocimientosTexto.split('\n').filter(l => l.trim()).map(l => ({ puesto_id: id, tipo: 'conocimiento', descripcion: l.trim(), sugerida_ia: false })),
      ...destrezasTexto.split('\n').filter(l => l.trim()).map(l => ({ puesto_id: id, tipo: 'destreza_especifica', descripcion: l.trim(), sugerida_ia: false })),
      ...conductualesTexto.split('\n').filter(l => l.trim()).map(l => ({ puesto_id: id, tipo: 'capacidad', descripcion: l.trim(), sugerida_ia: false })),
    ]
    if (nuevas.length > 0) await supabase.from('competencias_puesto').insert(nuevas)

    setGuardando(false)
    router.push(`/manual-puestos/${id}`)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: GOLD }}>Cargando...</div>
    </div>
  )

  const PASOS = ['Datos generales', 'Instrucción', 'Competencias']

  const btnIA: React.CSSProperties = {
    background: 'none', border: `1.5px solid ${GOLD}`, color: GOLD,
    padding: '.35rem .9rem', borderRadius: 6, cursor: 'pointer',
    fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Header */}
      <div style={{ background: DARK, padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push(`/manual-puestos/${id}`)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
              ← Volver a la ficha
            </button>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
              MIND<span style={{ color: GOLD }}>TALENT</span> — Editar puesto
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{datos.nombre_puesto}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: NAVY, padding: '.75rem 1.5rem', display: 'flex', gap: 4 }}>
        {PASOS.map((nombre, i) => (
          <button key={i} onClick={() => { setPaso(i + 1); setMensajeIA(''); setMensajeError(false) }}
            style={{
              background: paso === i + 1 ? GOLD : 'transparent',
              color: paso === i + 1 ? DARK : 'rgba(255,255,255,0.6)',
              border: 'none', borderRadius: 6, padding: '.35rem .9rem',
              cursor: 'pointer', fontSize: 12, fontWeight: paso === i + 1 ? 700 : 400,
            }}>
            {i + 1}. {nombre}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Banner respuesta del ocupante */}
        {respuestaOcupante && (
          <div style={{ background: 'white', borderRadius: 10, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.08)', border: '1.5px solid rgba(45,106,79,0.3)', overflow: 'hidden' }}>
            <div style={{ background: 'rgba(45,106,79,0.08)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f' }}>El ocupante ya respondió</span>
                <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>
                  {respuestaOcupante.nombre} · {respuestaOcupante.cargo_actual}
                </span>
              </div>
              <button onClick={() => setVerOcupante(v => !v)}
                style={{ background: 'none', border: '1px solid rgba(45,106,79,0.4)', color: '#2d6a4f', borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                {verOcupante ? 'Ocultar' : 'Ver respuestas'}
              </button>
            </div>
            {verOcupante && (
              <div style={{ padding: '1rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 12, color: '#374151' }}>
                <div>
                  <div style={{ fontWeight: 700, color: DARK, marginBottom: 6 }}>Actividades ({respuestaOcupante.actividades?.length ?? 0})</div>
                  {respuestaOcupante.actividades?.map((a, i) => (
                    <div key={i} style={{ marginBottom: 6, paddingLeft: 8, borderLeft: '2px solid #e5e7eb' }}>
                      <div style={{ fontWeight: 600 }}>{a.descripcion}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{a.frecuencia} · {a.dificultad} · {a.consecuencia}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: DARK, marginBottom: 6 }}>Herramientas</div>
                  {respuestaOcupante.herramientas?.map((h, i) => <div key={i}>· {h}</div>)}
                  <div style={{ fontWeight: 700, color: DARK, margin: '12px 0 6px' }}>Conocimientos</div>
                  {respuestaOcupante.conocimientos?.map((c, i) => <div key={i}>· {c}</div>)}
                  <div style={{ fontWeight: 700, color: DARK, margin: '12px 0 6px' }}>Formación</div>
                  <div>{respuestaOcupante.nivel_educativo} — {respuestaOcupante.carrera}</div>
                  <div>{respuestaOcupante.experiencia_anios} años de experiencia</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 14, padding: '2.5rem', boxShadow: '0 4px 20px rgba(0,0,0,.09)' }}>

          {/* PASO 1 — Datos generales */}
          {paso === 1 && (
            <>
              <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: '2px solid #f0f2f5' }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: DARK }}>Datos generales</h2>
                <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>Información básica del puesto.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>💼 Nombre del puesto *</label>
                  <input value={datos.nombre_puesto} onChange={e => setDatos(d => ({ ...d, nombre_puesto: e.target.value }))} style={inputStyle} placeholder='Ej: Analista de RR.HH.' />
                </div>
                <div>
                  <label style={labelStyle}>🏬 Área / Departamento *</label>
                  <input value={datos.area} onChange={e => setDatos(d => ({ ...d, area: e.target.value }))} style={inputStyle} placeholder='Ej: Gestión del Talento Humano' />
                </div>
              </div>
              <div style={{ background: '#f8f9fb', borderRadius: 10, padding: '16px 20px', marginBottom: 20, border: '1.5px solid #e5e7eb' }}>
                <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Jerarquía</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <label style={labelStyle}>⬆️ Supervisado por</label>
                    <input value={datos.supervisado_por} onChange={e => setDatos(d => ({ ...d, supervisado_por: e.target.value }))} style={inputStyle} placeholder='Cargo del jefe directo' />
                  </div>
                  <div>
                    <label style={labelStyle}>⬇️ Supervisa a</label>
                    <input value={datos.supervisa_a} onChange={e => setDatos(d => ({ ...d, supervisa_a: e.target.value }))} style={inputStyle} placeholder='Cargos bajo su supervisión' />
                  </div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>🎯 Misión del puesto</label>
                  <button
                    onClick={sugerirMision}
                    disabled={sugiriendoMision || !datos.nombre_puesto}
                    style={{ ...btnIA, opacity: sugiriendoMision || !datos.nombre_puesto ? 0.5 : 1 }}>
                    {sugiriendoMision ? '⏳ Generando...' : '✨ Sugerir con IA'}
                  </button>
                </div>
                <textarea value={datos.mision} onChange={e => setDatos(d => ({ ...d, mision: e.target.value }))}
                  rows={4} style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder='Describe la razón de ser del puesto en 2-3 líneas... o usa ✨ Sugerir con IA' />
                {mensajeIA && paso === 1 && (
                  <div style={{ fontSize: 12, color: mensajeError ? '#dc2626' : '#059669', marginTop: 6 }}>
                    {mensajeError ? '⚠️ ' : '✓ '}{mensajeIA}
                  </div>
                )}
              </div>
            </>
          )}

          {/* PASO 2 — Instrucción */}
          {paso === 2 && (
            <>
              <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: '2px solid #f0f2f5' }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: DARK }}>Instrucción formal y experiencia</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>Nivel educativo</label>
                  <input value={instruccion.nivel_educativo} onChange={e => setInstruccion(p => ({ ...p, nivel_educativo: e.target.value }))} style={inputStyle} placeholder='Ej: Tercer nivel' />
                </div>
                <div>
                  <label style={labelStyle}>Título requerido</label>
                  <input value={instruccion.titulo} onChange={e => setInstruccion(p => ({ ...p, titulo: e.target.value }))} style={inputStyle} placeholder='Ej: Ingeniería en Administración' />
                </div>
                <div>
                  <label style={labelStyle}>Área de especialización</label>
                  <input value={instruccion.area_especializacion} onChange={e => setInstruccion(p => ({ ...p, area_especializacion: e.target.value }))} style={inputStyle} placeholder='Ej: Recursos Humanos' />
                </div>
                <div>
                  <label style={labelStyle}>Años de experiencia</label>
                  <input value={instruccion.experiencia_anios} onChange={e => setInstruccion(p => ({ ...p, experiencia_anios: e.target.value }))} style={inputStyle} placeholder='Ej: 2' type='number' min='0' />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Tipo / área de experiencia</label>
                <textarea value={instruccion.experiencia_tipo} onChange={e => setInstruccion(p => ({ ...p, experiencia_tipo: e.target.value }))}
                  rows={3} style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder='Ej: Experiencia en selección de personal, nómina y gestión del desempeño' />
              </div>
            </>
          )}

          {/* PASO 3 — Competencias */}
          {paso === 3 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 20, borderBottom: '2px solid #f0f2f5' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: DARK }}>Conocimientos y competencias</h2>
                  <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>Una competencia por línea en cada sección.</p>
                </div>
                <button
                  onClick={sugerirCompetencias}
                  disabled={sugiriendoCompetencias || actividades.length === 0}
                  style={{
                    background: GOLD, color: DARK, border: 'none',
                    padding: '.45rem 1.1rem', borderRadius: 8, cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                    opacity: sugiriendoCompetencias || actividades.length === 0 ? 0.5 : 1,
                  }}>
                  {sugiriendoCompetencias ? '⏳ Analizando actividades...' : '✨ Sugerir todo con IA'}
                </button>
              </div>

              {mensajeIA && (
                <div style={{
                  background: mensajeError ? 'rgba(239,68,68,0.08)' : 'rgba(5,150,105,0.08)',
                  border: `1px solid ${mensajeError ? '#ef4444' : '#059669'}`,
                  borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12,
                  color: mensajeError ? '#dc2626' : '#059669',
                }}>
                  {mensajeError ? '⚠️ ' : '✓ '}{mensajeIA}
                </div>
              )}

              {actividades.length === 0 && (
                <div style={{ background: 'rgba(16,185,129,0.08)', border: `1px solid ${GOLD}`, borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#7a6020' }}>
                  Este puesto no tiene actividades registradas. La sugerencia IA requiere actividades para funcionar. Puedes completar las competencias manualmente.
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>📚 Sección 5 — Conocimientos requeridos</label>
                <p style={{ color: '#6b7280', fontSize: 12, margin: '0 0 6px' }}>Conocimientos técnicos, herramientas, software, normativas...</p>
                <textarea
                  value={conocimientosTexto}
                  onChange={e => setConocimientosTexto(e.target.value)}
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.8 }}
                  placeholder={'Ej: Manejo de Excel avanzado\nNormativa laboral ecuatoriana\nSistemas de nómina...'}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>🛠️ Sección 6 — Destrezas y habilidades</label>
                <p style={{ color: '#6b7280', fontSize: 12, margin: '0 0 6px' }}>Habilidades técnicas y cognitivas específicas del puesto...</p>
                <textarea
                  value={destrezasTexto}
                  onChange={e => setDestrezasTexto(e.target.value)}
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.8 }}
                  placeholder={'Ej: Pensamiento analítico\nRedacción de informes\nManejo de bases de datos...'}
                />
              </div>

              <div>
                <label style={labelStyle}>🤝 Sección 7 — Competencias conductuales</label>
                <p style={{ color: '#6b7280', fontSize: 12, margin: '0 0 6px' }}>Actitudes, valores y comportamientos esperados...</p>
                <textarea
                  value={conductualesTexto}
                  onChange={e => setConducualesTexto(e.target.value)}
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.8 }}
                  placeholder={'Ej: Trabajo en equipo\nOrientación a resultados\nComunicación efectiva...'}
                />
              </div>
            </>
          )}

          {/* Acciones */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
            <button onClick={() => paso > 1 ? setPaso(paso - 1) : router.push(`/manual-puestos/${id}`)}
              style={{ background: 'none', border: '1.5px solid #d1d5db', color: '#374151', padding: '.55rem 1.5rem', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              {paso === 1 ? 'Cancelar' : '← Anterior'}
            </button>
            {paso < 3
              ? <button onClick={() => { setPaso(paso + 1); setMensajeIA('') }}
                  style={{ background: DARK, color: 'white', padding: '.55rem 1.75rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                  Siguiente →
                </button>
              : <button onClick={guardar} disabled={guardando}
                  style={{ background: GOLD, color: DARK, padding: '.55rem 1.75rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, opacity: guardando ? 0.6 : 1, boxShadow: '0 2px 8px rgba(16,185,129,0.35)' }}>
                  {guardando ? 'Guardando...' : '💾 Guardar cambios'}
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

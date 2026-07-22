'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calcularTotal } from '@/lib/mdt-formula'
import { useAuthGuard } from '@/lib/useAuthGuard'

const DARK = '#0A1A32'
const GOLD = '#10b981'
const NAVY = '#1E2D5A'

interface Puesto {
  id: string; nombre_puesto: string; area: string; supervisado_por?: string
  supervisa_a?: string; mision?: string; fecha?: string
  empresas_mdt?: { nombre: string }
}
interface Actividad { id: string; orden: number; descripcion: string; frecuencia: number; consecuencia: number; complejidad: number; es_esencial: boolean }
interface Competencia { id: string; tipo: string; descripcion: string; requerimiento?: string; sugerida_ia: boolean }
interface Instruccion { nivel_educativo?: string; titulo?: string; area_especializacion?: string; experiencia_tipo?: string; experiencia_anios?: number; capacitacion?: { tema: string; horas: number }[] }
interface Indicador { id: string; indicador: string; formula?: string; meta?: string; cliente?: string; sugerido_ia: boolean }

export default function FichaPuesto() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { verificando } = useAuthGuard()

  const [puesto, setPuesto] = useState<Puesto | null>(null)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [competencias, setCompetencias] = useState<Competencia[]>([])
  const [instruccion, setInstruccion] = useState<Instruccion>({})
  const [indicadores, setIndicadores] = useState<Indicador[]>([])
  const [loading, setLoading] = useState(true)
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('puestos').select('*, empresas_mdt(nombre)').eq('id', id).single(),
      supabase.from('actividades_puesto').select('*').eq('puesto_id', id).order('orden'),
      supabase.from('competencias_puesto').select('*').eq('puesto_id', id),
      supabase.from('instruccion_puesto').select('*').eq('puesto_id', id).single(),
      supabase.from('indicadores_puesto').select('*').eq('puesto_id', id),
    ]).then(([{ data: p }, { data: acts }, { data: comps }, { data: inst }, { data: inds }]) => {
      setPuesto(p)
      setActividades(acts ?? [])
      setCompetencias(comps ?? [])
      setInstruccion(inst ?? {})
      setIndicadores(inds ?? [])
      setLoading(false)
    })
  }, [id])

  const esenciales = actividades.filter(a => a.es_esencial)
  const completitud = calcularCompletitud()

  function calcularCompletitud() {
    let puntos = 0
    if (puesto?.nombre_puesto) puntos += 20
    if (puesto?.mision) puntos += 20
    if (esenciales.length >= 3) puntos += 20
    if (competencias.length > 0) puntos += 20
    if (indicadores.length > 0) puntos += 20
    return puntos
  }

  const exportarPDF = async () => {
    if (!puesto) return
    setExportando(true)
    const { exportarFichaPDF } = await import('@/lib/exportar-ficha-pdf')
    await exportarFichaPDF(
      puesto,
      actividades.map(a => ({ descripcion: a.descripcion, frecuencia: a.frecuencia, consecuencia: a.consecuencia, complejidad: a.complejidad })),
      esenciales.map(a => ({ descripcion: a.descripcion, frecuencia: a.frecuencia, consecuencia: a.consecuencia, complejidad: a.complejidad })),
      competencias.map(c => ({ tipo: c.tipo, descripcion: c.descripcion, requerimiento: c.requerimiento })),
      instruccion,
      indicadores.map(ind => ({ indicador: ind.indicador, formula: ind.formula, meta: ind.meta, cliente: ind.cliente })),
      completitud < 80,
    )
    setExportando(false)
  }

  if (verificando) return null

  if (loading) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: GOLD }}>Cargando ficha...</div>
    </div>
  )

  if (!puesto) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'white' }}>Puesto no encontrado. <button onClick={() => router.push('/manual-puestos')} style={{ color: GOLD, background: 'none', border: 'none', cursor: 'pointer' }}>Volver al panel</button></div>
    </div>
  )

  const seccion = (num: number, titulo: string) => (
    <div style={{ background: NAVY, color: 'white', padding: '8px 14px', borderRadius: 6, marginBottom: 12, marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ background: GOLD, color: DARK, borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{num}</span>
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}>{titulo}</span>
    </div>
  )

  const pendiente = (txt?: string | null) => txt
    ? <span>{txt}</span>
    : <span style={{ color: GOLD, fontStyle: 'italic', fontSize: 12 }}>[Por completar]</span>

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Header */}
      <div style={{ background: DARK, padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/manual-puestos')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
              ← Panel
            </button>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
              MIND<span style={{ color: GOLD }}>TALENT</span>
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: 600 }}>{puesto.nombre_puesto}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Completitud</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: completitud >= 80 ? '#4ade80' : GOLD }}>{completitud}%</div>
          </div>
          <button onClick={() => router.push(`/manual-puestos/${id}/editar`)}
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '.5rem 1.25rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            ✏️ Editar
          </button>
          <button onClick={exportarPDF} disabled={exportando}
            style={{ background: GOLD, color: DARK, padding: '.5rem 1.25rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: exportando ? 0.6 : 1 }}>
            {exportando ? 'Generando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Empresa badge */}
        {puesto.empresas_mdt?.nombre && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 11, background: 'rgba(26,32,53,0.08)', padding: '3px 10px', borderRadius: 99, color: DARK, fontWeight: 600 }}>
              {puesto.empresas_mdt.nombre}
            </span>
          </div>
        )}

        {/* Indicador de completitud */}
        {completitud < 100 && (
          <div style={{ background: 'rgba(16,185,129,0.08)', border: `1px solid ${GOLD}`, borderRadius: 8, padding: '10px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#7a6020' }}>Ficha incompleta</div>
              <div style={{ fontSize: 11, color: '#9a7c2a', marginTop: 2 }}>
                {!puesto.mision && '· Falta misión  '}
                {esenciales.length < 3 && '· Menos de 3 actividades esenciales  '}
                {competencias.length === 0 && '· Faltan competencias  '}
                {indicadores.length === 0 && '· Faltan indicadores  '}
              </div>
            </div>
            <div style={{ width: 120, height: 8, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${completitud}%`, height: '100%', background: GOLD, borderRadius: 99 }} />
            </div>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 10, padding: '2rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)', color: '#111827' }}>
          {seccion(1, 'DATOS DE IDENTIFICACIÓN DEL PUESTO')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            <div><span style={label}>Nombre del puesto</span>{pendiente(puesto.nombre_puesto)}</div>
            <div><span style={label}>Área / Departamento</span>{pendiente(puesto.area)}</div>
            <div><span style={label}>Supervisado por</span>{pendiente(puesto.supervisado_por)}</div>
            <div><span style={label}>Supervisa a</span>{pendiente(puesto.supervisa_a)}</div>
            <div><span style={label}>Fecha</span>{puesto.fecha ? new Date(puesto.fecha + 'T00:00:00').toLocaleDateString('es-EC') : '—'}</div>
            <div><span style={label}>Metodología</span>MDT · Ministerio de Trabajo Ecuador</div>
          </div>

          {seccion(2, 'MISIÓN DEL PUESTO')}
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: puesto.mision ? DARK : GOLD, fontStyle: puesto.mision ? 'normal' : 'italic' }}>
            {puesto.mision || '[Por completar]'}
          </p>

          {seccion(3, 'ACTIVIDADES ESENCIALES — F + (CE × CM)')}
          {esenciales.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f0f2f5' }}>
                  {['N°', 'Actividad esencial', 'F', 'CE', 'CM', 'Total'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: h === 'N°' || h.length <= 3 ? 'center' : 'left', fontSize: 11, color: '#0A1A32', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {esenciales.map((a, i) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ padding: '6px 8px', textAlign: 'center', color: '#374151' }}>{i + 1}</td>
                    <td style={{ padding: '6px 8px' }}>{a.descripcion}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{a.frecuencia}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{a.consecuencia}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{a.complejidad}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800, color: DARK }}>
                      {calcularTotal(a.frecuencia, a.consecuencia, a.complejidad)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p style={{ color: GOLD, fontStyle: 'italic', fontSize: 12 }}>[Por completar — ninguna actividad marcada como esencial]</p>}

          {actividades.length > 0 && (
            <>
              <div style={{ margin: '20px 0 10px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Todas las actividades del puesto ({actividades.length})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f0f2f5' }}>
                    {['N°', 'Actividad', 'F', 'CE', 'CM', 'Total', 'Esencial'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: h === 'N°' || h.length <= 3 || h === 'Esencial' ? 'center' : 'left', fontSize: 11, color: '#0A1A32', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {actividades.map((a, i) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0', background: a.es_esencial ? 'rgba(16,185,129,0.06)' : i % 2 === 0 ? 'white' : '#f9fafb' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#374151' }}>{a.orden}</td>
                      <td style={{ padding: '6px 8px' }}>{a.descripcion}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{a.frecuencia || '—'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{a.consecuencia || '—'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{a.complejidad || '—'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: DARK }}>
                        {a.frecuencia && a.consecuencia && a.complejidad ? calcularTotal(a.frecuencia, a.consecuencia, a.complejidad) : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{a.es_esencial ? '★' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {seccion(4, 'INTERFAZ DEL PUESTO')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            <div><span style={label}>Reporta a</span>{pendiente(puesto.supervisado_por)}</div>
            <div><span style={label}>Supervisa directamente a</span>{pendiente(puesto.supervisa_a)}</div>
          </div>

          {seccion(5, 'CONOCIMIENTOS REQUERIDOS')}
          {competencias.filter(c => c.tipo === 'conocimiento').length > 0
            ? <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 2, color: '#111' }}>
              {competencias.filter(c => c.tipo === 'conocimiento').map(c => <li key={c.id}>{c.descripcion}</li>)}
            </ul>
            : <p style={{ color: GOLD, fontStyle: 'italic', fontSize: 12 }}>[Por completar]</p>}

          {seccion(6, 'DESTREZAS Y HABILIDADES')}
          {competencias.filter(c => c.tipo === 'destreza_general' || c.tipo === 'destreza_especifica').length > 0
            ? <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 2, color: '#111' }}>
              {competencias.filter(c => c.tipo === 'destreza_general' || c.tipo === 'destreza_especifica').map(c => <li key={c.id}>{c.descripcion}{c.requerimiento && ` — ${c.requerimiento}`}</li>)}
            </ul>
            : <p style={{ color: GOLD, fontStyle: 'italic', fontSize: 12 }}>[Por completar]</p>}

          {seccion(7, 'COMPETENCIAS CONDUCTUALES')}
          {competencias.filter(c => c.tipo === 'capacidad').length > 0
            ? <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 2, color: '#111' }}>
              {competencias.filter(c => c.tipo === 'capacidad').map(c => <li key={c.id}>{c.descripcion}</li>)}
            </ul>
            : <p style={{ color: GOLD, fontStyle: 'italic', fontSize: 12 }}>[Por completar]</p>}

          {seccion(8, 'INSTRUCCIÓN FORMAL Y EXPERIENCIA')}
          {instruccion.nivel_educativo ? (
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div><span style={label}>Nivel educativo</span>{instruccion.nivel_educativo}</div>
              {instruccion.titulo && <div><span style={label}>Título</span>{instruccion.titulo}</div>}
              {instruccion.area_especializacion && <div><span style={label}>Especialización</span>{instruccion.area_especializacion}</div>}
              {instruccion.experiencia_anios != null && <div><span style={label}>Experiencia requerida</span>{instruccion.experiencia_anios} años — {instruccion.experiencia_tipo}</div>}
              {instruccion.capacitacion && instruccion.capacitacion.length > 0 && instruccion.capacitacion[0].tema && (
                <div style={{ marginTop: 8 }}>
                  <span style={label}>Capacitación adicional</span>
                  <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                    {instruccion.capacitacion.map((c, i) => c.tema && <li key={i}>{c.tema} {c.horas ? `(${c.horas}h)` : ''}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : <p style={{ color: GOLD, fontStyle: 'italic', fontSize: 12 }}>[Por completar]</p>}

          {seccion(9, 'INDICADORES DE GESTIÓN')}
          {indicadores.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f0f2f5' }}>
                  {['Indicador', 'Fórmula', 'Meta', 'Cliente / Beneficiario'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, color: '#0A1A32', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {indicadores.map((ind, i) => (
                  <tr key={ind.id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{ind.indicador}</td>
                    <td style={{ padding: '6px 8px', color: '#374151', fontSize: 11 }}>{ind.formula ?? '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{ind.meta ?? '—'}</td>
                    <td style={{ padding: '6px 8px', color: '#374151' }}>{ind.cliente ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p style={{ color: GOLD, fontStyle: 'italic', fontSize: 12 }}>[Por completar]</p>}
        </div>
      </div>
    </div>
  )
}

const label: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 }

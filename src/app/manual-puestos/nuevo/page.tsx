'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calcularTotal, identificarEsenciales, type Actividad } from '@/lib/mdt-formula'

const DARK = '#0A1A32'
const GOLD = '#10b981'
const NAVY = '#1E2D5A'

interface Empresa { id: string; nombre: string; sector?: string }
interface Competencia { tipo: string; descripcion: string; requerimiento?: string; sugerida_ia?: boolean; _key: string }
interface Indicador { actividad_index: number; indicador: string; formula: string; meta: string; cliente: string; sugerido_ia?: boolean }
interface Instruccion {
  nivel_educativo: string; titulo: string; area_especializacion: string
  experiencia_tipo: string; experiencia_anios: string
  capacitacion: { tema: string; horas: string }[]
}

const actividadVacia = (orden: number): Actividad => ({ orden, descripcion: '', frecuencia: 0, consecuencia: 0, complejidad: 0 })

export default function NuevoPuesto() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0A1A32', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#10b981' }}>Cargando...</div></div>}>
      <NuevoPuestoInner />
    </Suspense>
  )
}

function NuevoPuestoInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const desdeRespuestaId = searchParams.get('desde')
  const [paso, setPaso] = useState(1)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [nuevaEmpresa, setNuevaEmpresa] = useState({ nombre: '', sector: '' })
  const [mostrarNuevaEmpresa, setMostrarNuevaEmpresa] = useState(false)
  const [bannerOcupante, setBannerOcupante] = useState<string | null>(null)

  const [datos, setDatos] = useState({
    empresa_id: '', nombre_puesto: '', area: '', supervisado_por: '', supervisa_a: '',
    mision: '', fecha: new Date().toISOString().slice(0, 10),
  })

  const [actividades, setActividades] = useState<Actividad[]>(
    Array.from({ length: 10 }, (_, i) => actividadVacia(i + 1))
  )
  const [esencialesManual, setEsencialesManual] = useState<Set<number>>()

  const [competencias, setCompetencias] = useState<Competencia[]>([])
  const [loadingIA, setLoadingIA] = useState(false)
  const [instruccion, setInstruccion] = useState<Instruccion>({
    nivel_educativo: '', titulo: '', area_especializacion: '',
    experiencia_tipo: '', experiencia_anios: '',
    capacitacion: [{ tema: '', horas: '' }],
  })
  const [indicadores, setIndicadores] = useState<Indicador[]>([])
  const [guardando, setGuardando] = useState(false)
  const [generandoMision, setGenerandoMision] = useState(false)

  useEffect(() => {
    supabase.from('empresas_mdt').select('*').order('nombre').then(({ data }) => setEmpresas(data ?? []))
  }, [])

  // Pre-poblar desde respuesta de ocupante
  useEffect(() => {
    if (!desdeRespuestaId) return

    const cargarDesdeOcupante = async () => {
      const { data } = await supabase
        .from('respuestas_ocupante')
        .select('*')
        .eq('id', desdeRespuestaId)
        .single()
      if (!data) return

      // Traer área y empresa: primero desde la respuesta directa, luego desde el puesto relacionado
      let area = data.area ?? ''
      let empresa_id = data.empresa_id ?? ''
      if (data.puesto_id && (!area || !empresa_id)) {
        const { data: puesto } = await supabase
          .from('puestos')
          .select('area, empresa_id')
          .eq('id', data.puesto_id)
          .single()
        area = area || puesto?.area ?? ''
        empresa_id = empresa_id || puesto?.empresa_id ?? ''
      }

      setBannerOcupante(
        `Información pre-cargada desde la respuesta de ${data.nombre ?? 'ocupante'}` +
        (data.cargo_actual ? ` — ${data.cargo_actual}` : '') +
        '. Revisa y ajusta los valores F / CE / CM en el Paso 2.'
      )

      // Paso 1: datos básicos
      setDatos(prev => ({
        ...prev,
        nombre_puesto: data.cargo_actual ?? prev.nombre_puesto,
        area: area || prev.area,
        empresa_id: empresa_id || prev.empresa_id,
        supervisado_por: data.supervisado_por ?? prev.supervisado_por,
        supervisa_a: data.supervisa_a ?? prev.supervisa_a,
      }))

        // Mapeo texto ocupante → escala MDT 1–5
        const mapFrecuencia: Record<string, number> = { diaria: 5, semanal: 4, mensual: 3, eventual: 2 }
        const mapDificultad: Record<string, number> = { simple: 1, analisis: 3, compleja: 5 }
        const mapConsecuencia: Record<string, number> = { minima: 1, moderada: 3, alta: 5 }

        // Paso 2: actividades con valores pre-cargados del ocupante
        const actsOcupante: Actividad[] = (data.actividades ?? []).map(
          (a: { descripcion: string; frecuencia?: string; dificultad?: string; consecuencia?: string }, i: number) => ({
            orden: i + 1,
            descripcion: a.descripcion ?? '',
            frecuencia: mapFrecuencia[a.frecuencia ?? ''] ?? 0,
            consecuencia: mapConsecuencia[a.consecuencia ?? ''] ?? 0,
            complejidad: mapDificultad[a.dificultad ?? ''] ?? 0,
          })
        )
        const filasTotales = Math.max(actsOcupante.length, 10)
        setActividades([
          ...actsOcupante,
          ...Array.from({ length: filasTotales - actsOcupante.length }, (_, i) =>
            actividadVacia(actsOcupante.length + i + 1)
          ),
        ])

        // Paso 4: competencias — conocimientos + herramientas del ocupante
        const conocComp: Competencia[] = (data.conocimientos ?? []).map((c: string, i: number) => ({
          tipo: 'conocimiento' as const,
          descripcion: c,
          sugerida_ia: false,
          _key: `oc_con_${i}`,
        }))
        const herramComp: Competencia[] = (data.herramientas ?? []).map((h: string, i: number) => ({
          tipo: 'destreza_general' as const,
          descripcion: h,
          sugerida_ia: false,
          _key: `oc_her_${i}`,
        }))
        const todasComp = [...conocComp, ...herramComp]
        if (todasComp.length > 0) setCompetencias(todasComp)

        // Paso 5: instrucción formal
        // El ocupante usa valores distintos a las opciones del consultor — mapear
        const mapNivel: Record<string, string> = {
          'Bachillerato': 'Bachillerato',
          'Técnico / Tecnológico': 'Técnico',
          'Tercer nivel (Ingeniería / Licenciatura)': 'Universitario',
          'Cuarto nivel (Maestría)': 'Maestría',
          'Doctorado': 'Doctorado',
        }
        setInstruccion(prev => ({
          ...prev,
          nivel_educativo: mapNivel[data.nivel_educativo ?? ''] ?? data.nivel_educativo ?? '',
          titulo: data.carrera ?? '',
          experiencia_anios: data.experiencia_anios != null ? String(data.experiencia_anios) : '',
        }))
    }

    cargarDesdeOcupante()
  }, [desdeRespuestaId])

  // Generar misión con IA al llegar al Paso 7 si está vacía
  useEffect(() => {
    if (paso !== 7 || datos.mision.trim() || generandoMision) return
    setGenerandoMision(true)
    fetch('/api/sugerir-mision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_puesto: datos.nombre_puesto,
        area: datos.area,
        actividades: esencialesDefinitivas.map(a => a.descripcion),
        empresa_id: datos.empresa_id || undefined,
      }),
    })
      .then(r => r.json())
      .then(data => { if (data.mision) setDatos(prev => ({ ...prev, mision: data.mision })) })
      .finally(() => setGenerandoMision(false))
  }, [paso]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recalcular esenciales cuando cambian actividades
  useEffect(() => {
    const e = identificarEsenciales(actividades)
    setEsencialesManual(new Set(e.map(a => a.orden)))
  }, [actividades])

  const actualizarActividad = useCallback((index: number, campo: keyof Actividad, valor: string | number) => {
    setActividades(prev => {
      const nueva = [...prev]
      nueva[index] = { ...nueva[index], [campo]: campo === 'descripcion' ? valor : Number(valor) }
      return nueva
    })
  }, [])

  const agregarFila = () => {
    setActividades(prev => [...prev, actividadVacia(prev.length + 1)])
  }

  const eliminarFila = (index: number) => {
    setActividades(prev => prev.filter((_, i) => i !== index).map((a, i) => ({ ...a, orden: i + 1 })))
  }

  const toggleEsencial = (orden: number) => {
    setEsencialesManual(prev => {
      const siguiente = new Set(prev)
      if (siguiente.has(orden)) siguiente.delete(orden)
      else siguiente.add(orden)
      return siguiente
    })
  }

  const esencialesDefinitivas = actividades.filter(a => esencialesManual?.has(a.orden) && a.descripcion.trim())

  const sugerirCompetencias = async () => {
    setLoadingIA(true)
    try {
      const res = await fetch('/api/sugerir-competencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actividades_esenciales: esencialesDefinitivas.map(a => ({ descripcion: a.descripcion, total: calcularTotal(a.frecuencia, a.consecuencia, a.complejidad) })),
          nombre_puesto: datos.nombre_puesto,
          area: datos.area,
          empresa_id: datos.empresa_id || undefined,
        }),
      })
      const data = await res.json()
      const nuevas: Competencia[] = [
        ...(data.conocimientos ?? []).map((c: { descripcion: string }, i: number) => ({ tipo: 'conocimiento', descripcion: c.descripcion, sugerida_ia: true, _key: `c${i}` })),
        ...(data.destrezas_generales ?? []).map((d: { nombre: string; codigo: string; descripcion: string }, i: number) => ({ tipo: 'destreza_general', descripcion: `${d.codigo} — ${d.nombre}: ${d.descripcion}`, sugerida_ia: true, _key: `dg${i}` })),
        ...(data.capacidades ?? []).map((c: { descripcion: string }, i: number) => ({ tipo: 'capacidad', descripcion: c.descripcion, sugerida_ia: true, _key: `cap${i}` })),
      ]
      setCompetencias(prev => [...prev.filter(c => !c.sugerida_ia), ...nuevas])
    } catch { /* sugerencias fallidas no bloquean */ }
    setLoadingIA(false)
  }

  const sugerirIndicadores = async () => {
    setLoadingIA(true)
    try {
      const res = await fetch('/api/sugerir-indicadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actividades_esenciales: esencialesDefinitivas.map(a => ({ descripcion: a.descripcion })),
          nombre_puesto: datos.nombre_puesto,
          area: datos.area,
          empresa_id: datos.empresa_id || undefined,
        }),
      })
      const data = await res.json()
      setIndicadores(data.map((ind: Omit<Indicador, 'sugerido_ia'>) => ({ ...ind, sugerido_ia: true })))
    } catch { /* fallback silencioso */ }
    setLoadingIA(false)
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      // 1. Insertar puesto
      const { data: puestoData, error: pErr } = await supabase.from('puestos').insert({
        empresa_id: datos.empresa_id || null,
        nombre_puesto: datos.nombre_puesto,
        area: datos.area,
        supervisado_por: datos.supervisado_por || null,
        supervisa_a: datos.supervisa_a || null,
        mision: datos.mision || null,
        fecha: datos.fecha,
      }).select().single()
      if (pErr || !puestoData) throw pErr

      const puestoId = puestoData.id

      // 2. Actividades
      const actividadesValidas = actividades.filter(a => a.descripcion.trim())
      if (actividadesValidas.length > 0) {
        await supabase.from('actividades_puesto').insert(
          actividadesValidas.map(a => ({
            puesto_id: puestoId,
            orden: a.orden,
            descripcion: a.descripcion,
            frecuencia: a.frecuencia || null,
            consecuencia: a.consecuencia || null,
            complejidad: a.complejidad || null,
            es_esencial: esencialesManual?.has(a.orden) ?? false,
          }))
        )
      }

      // 3. Competencias
      if (competencias.length > 0) {
        await supabase.from('competencias_puesto').insert(
          competencias.map(c => ({
            puesto_id: puestoId,
            tipo: c.tipo,
            descripcion: c.descripcion,
            requerimiento: c.requerimiento || null,
            sugerida_ia: c.sugerida_ia ?? false,
          }))
        )
      }

      // 4. Instrucción
      await supabase.from('instruccion_puesto').insert({
        puesto_id: puestoId,
        nivel_educativo: instruccion.nivel_educativo || null,
        titulo: instruccion.titulo || null,
        area_especializacion: instruccion.area_especializacion || null,
        experiencia_tipo: instruccion.experiencia_tipo || null,
        experiencia_anios: instruccion.experiencia_anios ? parseInt(instruccion.experiencia_anios) : null,
        capacitacion: instruccion.capacitacion.filter(c => c.tema),
      })

      // 5. Indicadores
      if (indicadores.length > 0) {
        await supabase.from('indicadores_puesto').insert(
          indicadores.map(ind => ({
            puesto_id: puestoId,
            indicador: ind.indicador,
            formula: ind.formula || null,
            meta: ind.meta || null,
            cliente: ind.cliente || null,
            sugerido_ia: ind.sugerido_ia ?? false,
          }))
        )
      }

      router.push(`/manual-puestos/${puestoId}`)
    } catch (e) {
      alert('Error al guardar. Revisa la consola.')
      console.error(e)
    }
    setGuardando(false)
  }

  const crearEmpresa = async () => {
    if (!nuevaEmpresa.nombre.trim()) return
    const { data } = await supabase.from('empresas_mdt').insert({ nombre: nuevaEmpresa.nombre, sector: nuevaEmpresa.sector }).select().single()
    if (data) {
      setEmpresas(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setDatos(prev => ({ ...prev, empresa_id: data.id }))
      setNuevaEmpresa({ nombre: '', sector: '' })
      setMostrarNuevaEmpresa(false)
    }
  }

  const actividadesConValores = actividades.filter(a => a.descripcion.trim() && a.frecuencia && a.consecuencia && a.complejidad)
  const puedeAvanzar2 = actividadesConValores.length >= 3

  const PASOS = ['Datos del puesto', 'Actividades MDT', 'Esenciales', 'Competencias IA', 'Instrucción', 'Indicadores', 'Vista previa']

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
              MIND<span style={{ color: GOLD }}>TALENT</span> — Nuevo Puesto
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Metodología MDT · F + (CE × CM)</div>
        </div>
      </div>

      {/* Barra de pasos */}
      <div style={{ background: NAVY, padding: '.75rem 1.5rem', display: 'flex', gap: 4, overflowX: 'auto' }}>
        {PASOS.map((label, i) => {
          const num = i + 1
          const activo = num === paso
          const completo = num < paso
          return (
            <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <div
                onClick={() => num < paso && setPaso(num)}
                style={{
                  padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: num < paso ? 'pointer' : 'default',
                  background: activo ? GOLD : completo ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)',
                  color: activo ? DARK : completo ? GOLD : 'rgba(255,255,255,0.5)',
                  border: activo ? `2px solid ${GOLD}` : '2px solid transparent',
                }}
              >
                {completo ? '✓ ' : `${num}. `}{label}
              </div>
              {i < PASOS.length - 1 && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>›</span>}
            </div>
          )
        })}
      </div>

      {bannerOcupante && (
        <div style={{ background: '#fffbeb', borderBottom: '2px solid #10b981', padding: '12px 1.5rem' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>📋</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#7a6020', marginBottom: 2 }}>
                Respuesta del ocupante pre-cargada
              </div>
              <div style={{ fontSize: 12, color: '#92400e' }}>{bannerOcupante}</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 16, fontSize: 11, color: '#a16207' }}>
                <span>✓ Nombre del puesto</span>
                <span>✓ Área</span>
                <span>✓ Actividades (sin puntaje)</span>
                <span>✓ Conocimientos y herramientas</span>
                <span>✓ Instrucción formal</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* ============ PASO 1 ============ */}
        {paso === 1 && (
          <div style={{ background: 'white', borderRadius: 14, padding: '2.5rem', boxShadow: '0 4px 20px rgba(0,0,0,.09)' }}>
            {/* Encabezado */}
            <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: '2px solid #f0f2f5' }}>
              <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 22, fontWeight: 700 }}>Datos del puesto</h2>
              <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Completa la información básica. Los campos con * son obligatorios.</p>
            </div>

            {/* Empresa + Nombre */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>🏢 Empresa</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={datos.empresa_id} onChange={e => setDatos(d => ({ ...d, empresa_id: e.target.value }))} style={inputStyle}>
                    <option value=''>— Selecciona empresa —</option>
                    {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                  <button onClick={() => setMostrarNuevaEmpresa(!mostrarNuevaEmpresa)}
                    style={{ background: DARK, color: 'white', border: 'none', borderRadius: 8, padding: '0 14px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', fontWeight: 600 }}>
                    + Nueva
                  </button>
                </div>
                {mostrarNuevaEmpresa && (
                  <div style={{ marginTop: 10, padding: 16, background: '#f8f9fb', borderRadius: 10, border: '1.5px solid #e5e7eb' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: DARK }}>Nueva empresa</p>
                    <input placeholder='Nombre de la empresa' value={nuevaEmpresa.nombre} onChange={e => setNuevaEmpresa(p => ({ ...p, nombre: e.target.value }))} style={{ ...inputStyle, marginBottom: 10 }} />
                    <input placeholder='Sector (opcional)' value={nuevaEmpresa.sector} onChange={e => setNuevaEmpresa(p => ({ ...p, sector: e.target.value }))} style={{ ...inputStyle, marginBottom: 12 }} />
                    <button onClick={crearEmpresa} style={{ background: GOLD, color: DARK, border: 'none', borderRadius: 6, padding: '7px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                      Crear empresa
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>💼 Nombre del puesto *</label>
                <input value={datos.nombre_puesto} onChange={e => setDatos(d => ({ ...d, nombre_puesto: e.target.value }))} style={inputStyle} placeholder='Ej: Analista de Recursos Humanos' />
              </div>
            </div>

            {/* Área + Fecha */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>🏬 Área / Departamento *</label>
                <input value={datos.area} onChange={e => setDatos(d => ({ ...d, area: e.target.value }))} style={inputStyle} placeholder='Ej: Gestión del Talento Humano' />
              </div>
              <div>
                <label style={labelStyle}>📅 Fecha</label>
                <input type='date' value={datos.fecha} onChange={e => setDatos(d => ({ ...d, fecha: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            {/* Supervisión */}
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

            {/* Misión */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>🎯 Misión del puesto</label>
                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>✨ La IA puede sugerirla si la dejas vacía</span>
              </div>
              <textarea value={datos.mision} onChange={e => setDatos(d => ({ ...d, mision: e.target.value }))}
                rows={3} style={{ ...inputStyle, resize: 'vertical' }}
                placeholder='Describe la razón de ser del puesto en 2-3 líneas...' />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                disabled={!datos.nombre_puesto.trim() || !datos.area.trim()}
                onClick={() => setPaso(2)}
                style={{ ...btnPrimario, opacity: !datos.nombre_puesto.trim() || !datos.area.trim() ? 0.35 : 1, fontSize: 15 }}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ============ PASO 2 ============ */}
        {paso === 2 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '2rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 18 }}>Tabla de actividades MDT</h2>
                <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>TOTAL = F + (CE × CM) · Mínimo 3 actividades con valores completos para continuar</p>
              </div>
              <div style={{ fontSize: 12, color: actividadesConValores.length >= 3 ? '#2d6a4f' : '#9ca3af' }}>
                {actividadesConValores.length} / {actividades.filter(a => a.descripcion.trim()).length} actividades valoradas
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: NAVY, color: 'white' }}>
                    <th style={th}>N°</th>
                    <th style={{ ...th, width: '45%' }}>Descripción de la actividad</th>
                    <th style={th}>
                      <div>F</div>
                      <div style={{ fontWeight: 400, fontSize: 9, opacity: 0.7, marginTop: 1 }}>Frecuencia</div>
                    </th>
                    <th style={th}>
                      <div>CE</div>
                      <div style={{ fontWeight: 400, fontSize: 9, opacity: 0.7, marginTop: 1 }}>Consecuencia</div>
                    </th>
                    <th style={th}>
                      <div>CM</div>
                      <div style={{ fontWeight: 400, fontSize: 9, opacity: 0.7, marginTop: 1 }}>Complejidad</div>
                    </th>
                    <th style={{ ...th, color: GOLD }}>TOTAL</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {actividades.map((act, i) => {
                    const total = act.frecuencia && act.consecuencia && act.complejidad
                      ? calcularTotal(act.frecuencia, act.consecuencia, act.complejidad) : null
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ ...td, color: '#9ca3af', textAlign: 'center' }}>{i + 1}</td>
                        <td style={td}>
                          <textarea
                            value={act.descripcion}
                            onChange={e => actualizarActividad(i, 'descripcion', e.target.value)}
                            rows={2}
                            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 4, padding: '4px 6px', fontSize: 11, resize: 'vertical', outline: 'none', color: '#111' }}
                            placeholder='Describe la actividad...'
                          />
                        </td>
                        {(['frecuencia', 'consecuencia', 'complejidad'] as const).map(campo => (
                          <td key={campo} style={{ ...td, textAlign: 'center' }}>
                            <select
                              value={act[campo] || ''}
                              onChange={e => actualizarActividad(i, campo, e.target.value)}
                              style={{ width: 50, textAlign: 'center', border: '1px solid #e5e7eb', borderRadius: 4, padding: '4px 2px', fontSize: 12, outline: 'none', color: '#111' }}>
                              <option value=''>—</option>
                              {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </td>
                        ))}
                        <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: total ? DARK : '#d1d5db', fontSize: 14 }}>
                          {total ?? '—'}
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          {actividades.length > 3 && (
                            <button onClick={() => eliminarFila(i)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14 }}>✕</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={agregarFila} disabled={actividades.length >= 33}
                style={{ background: 'none', border: `1px dashed ${GOLD}`, color: GOLD, padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                + Agregar actividad {actividades.length >= 33 ? '(máx. 33)' : ''}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setPaso(1)} style={btnSecundario}>← Anterior</button>
                <button onClick={() => setPaso(3)} disabled={!puedeAvanzar2}
                  style={{ ...btnPrimario, opacity: !puedeAvanzar2 ? 0.4 : 1 }}>
                  Continuar → {!puedeAvanzar2 && '(mín. 3 valoradas)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============ PASO 3 ============ */}
        {paso === 3 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '2rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 18 }}>Actividades esenciales</h2>
            <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 20 }}>
              El algoritmo MDT identifica las actividades con mayor puntaje TOTAL. Puedes ajustar la selección manualmente.
            </p>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 10 }}>
                Identificadas automáticamente (top puntaje):
              </div>
              {actividades
                .filter(a => a.descripcion.trim() && a.frecuencia && a.consecuencia && a.complejidad)
                .sort((a, b) => calcularTotal(b.frecuencia, b.consecuencia, b.complejidad) - calcularTotal(a.frecuencia, a.consecuencia, a.complejidad))
                .map(a => {
                  const total = calcularTotal(a.frecuencia, a.consecuencia, a.complejidad)
                  const esEsencial = esencialesManual?.has(a.orden)
                  return (
                    <div key={a.orden} onClick={() => toggleEsencial(a.orden)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', borderRadius: 8, marginBottom: 6,
                        cursor: 'pointer', transition: 'all .15s',
                        background: esEsencial ? 'rgba(16,185,129,0.08)' : '#f9fafb',
                        border: `2px solid ${esEsencial ? GOLD : '#e5e7eb'}`,
                      }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 4, border: `2px solid ${esEsencial ? GOLD : '#d1d5db'}`,
                        background: esEsencial ? GOLD : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, marginTop: 2,
                      }}>
                        {esEsencial && <span style={{ color: DARK, fontSize: 12, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: DARK }}>{a.orden}. {a.descripcion}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                          F={a.frecuencia} · CE={a.consecuencia} · CM={a.complejidad} · <strong style={{ color: esEsencial ? GOLD : '#6b7280' }}>TOTAL = {total}</strong>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>

            <div style={{ background: 'rgba(16,185,129,0.08)', border: `1px solid ${GOLD}`, borderRadius: 6, padding: '8px 14px', fontSize: 12, color: '#7a6020', marginBottom: 20 }}>
              {esencialesDefinitivas.length} actividad{esencialesDefinitivas.length !== 1 ? 'es' : ''} marcada{esencialesDefinitivas.length !== 1 ? 's' : ''} como esencial{esencialesDefinitivas.length !== 1 ? 'es' : ''}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setPaso(2)} style={btnSecundario}>← Anterior</button>
              <button onClick={() => { sugerirCompetencias(); setPaso(4) }} style={btnPrimario}>
                Continuar → (sugerir competencias con IA)
              </button>
            </div>
          </div>
        )}

        {/* ============ PASO 4 ============ */}
        {paso === 4 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '2rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 18 }}>Competencias del puesto</h2>
            <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>La IA sugiere competencias del diccionario MDT. Acepta, edita o elimina cada una. Puedes añadir manualmente.</p>

            {loadingIA && (
              <div style={{ textAlign: 'center', padding: '2rem', color: GOLD }}>
                Analizando actividades esenciales con IA...
              </div>
            )}

            {!loadingIA && competencias.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                <button onClick={sugerirCompetencias} style={btnPrimario}>Solicitar sugerencias IA</button>
              </div>
            )}

            {competencias.length > 0 && (
              <div>
                {(['conocimiento', 'destreza_general', 'capacidad'] as const).map(tipo => {
                  const labels: Record<string, string> = { conocimiento: 'Conocimientos', destreza_general: 'Destrezas generales MDT', capacidad: 'Competencias conductuales' }
                  const items = competencias.filter(c => c.tipo === tipo)
                  if (items.length === 0) return null
                  return (
                    <div key={tipo} style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{labels[tipo]}</div>
                      {items.map((c) => (
                        <div key={c._key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                          <input
                            value={c.descripcion}
                            onChange={e => setCompetencias(prev => prev.map(x => x._key === c._key ? { ...x, descripcion: e.target.value } : x))}
                            style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                          />
                          <button onClick={() => setCompetencias(prev => prev.filter(x => x._key !== c._key))}
                            style={{ background: 'none', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )
                })}

                <button onClick={() => setCompetencias(prev => [...prev, { tipo: 'conocimiento', descripcion: '', sugerida_ia: false, _key: `manual${Date.now()}` }])}
                  style={{ background: 'none', border: `1px dashed ${GOLD}`, color: GOLD, padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, marginBottom: 16 }}>
                  + Agregar competencia manualmente
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button onClick={() => setPaso(3)} style={btnSecundario}>← Anterior</button>
              <button onClick={() => setPaso(5)} style={btnPrimario}>Continuar →</button>
            </div>
          </div>
        )}

        {/* ============ PASO 5 ============ */}
        {paso === 5 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '2rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 20, fontSize: 18 }}>Instrucción formal y experiencia</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Nivel educativo</label>
                <select value={instruccion.nivel_educativo} onChange={e => setInstruccion(p => ({ ...p, nivel_educativo: e.target.value }))} style={inputStyle}>
                  <option value=''>— Selecciona —</option>
                  {['Bachillerato', 'Técnico', 'Tecnólogo', 'Universitario', 'Especialización', 'Maestría', 'Doctorado'].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Título / Área académica</label>
                <input value={instruccion.titulo} onChange={e => setInstruccion(p => ({ ...p, titulo: e.target.value }))} style={inputStyle} placeholder='Ej: Ingeniería en Administración' />
              </div>
              <div>
                <label style={labelStyle}>Área de especialización</label>
                <input value={instruccion.area_especializacion} onChange={e => setInstruccion(p => ({ ...p, area_especializacion: e.target.value }))} style={inputStyle} placeholder='Ej: Gestión del Talento Humano' />
              </div>
              <div>
                <label style={labelStyle}>Años de experiencia</label>
                <input type='number' min={0} max={30} value={instruccion.experiencia_anios}
                  onChange={e => setInstruccion(p => ({ ...p, experiencia_anios: e.target.value }))} style={inputStyle} placeholder='Ej: 2' />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Tipo / área de experiencia requerida</label>
              <textarea value={instruccion.experiencia_tipo} onChange={e => setInstruccion(p => ({ ...p, experiencia_tipo: e.target.value }))}
                rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder='Ej: Experiencia en selección de personal, nómina y gestión del desempeño' />
            </div>

            <div>
              <label style={labelStyle}>Capacitación adicional requerida</label>
              {instruccion.capacitacion.map((cap, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input value={cap.tema} onChange={e => setInstruccion(p => { const c = [...p.capacitacion]; c[i] = { ...c[i], tema: e.target.value }; return { ...p, capacitacion: c } })}
                    style={{ ...inputStyle, flex: 3 }} placeholder='Tema del curso / certificación' />
                  <input type='number' value={cap.horas} onChange={e => setInstruccion(p => { const c = [...p.capacitacion]; c[i] = { ...c[i], horas: e.target.value }; return { ...p, capacitacion: c } })}
                    style={{ ...inputStyle, width: 80 }} placeholder='Horas' />
                  <button onClick={() => setInstruccion(p => ({ ...p, capacitacion: p.capacitacion.filter((_, j) => j !== i) }))}
                    style={{ background: 'none', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>✕</button>
                </div>
              ))}
              <button onClick={() => setInstruccion(p => ({ ...p, capacitacion: [...p.capacitacion, { tema: '', horas: '' }] }))}
                style={{ background: 'none', border: `1px dashed ${GOLD}`, color: GOLD, padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                + Agregar capacitación
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button onClick={() => setPaso(4)} style={btnSecundario}>← Anterior</button>
              <button onClick={() => { sugerirIndicadores(); setPaso(6) }} style={btnPrimario}>Continuar →</button>
            </div>
          </div>
        )}

        {/* ============ PASO 6 ============ */}
        {paso === 6 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '2rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 18 }}>Indicadores de gestión</h2>
            <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>Un indicador por actividad esencial. La IA sugiere fórmulas del catálogo MDT.</p>

            {loadingIA && <div style={{ textAlign: 'center', padding: '2rem', color: GOLD }}>Generando indicadores con IA...</div>}

            {!loadingIA && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: NAVY, color: 'white' }}>
                      {['Actividad esencial', 'Indicador de gestión', 'Fórmula', 'Meta', 'Cliente / Beneficiario'].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {indicadores.length > 0
                      ? indicadores.map((ind, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ ...td, fontSize: 11, color: '#6b7280', maxWidth: 160 }}>
                            {esencialesDefinitivas[ind.actividad_index]?.descripcion ?? `Actividad ${ind.actividad_index + 1}`}
                          </td>
                          {(['indicador', 'formula', 'meta', 'cliente'] as const).map(campo => (
                            <td key={campo} style={td}>
                              <input value={ind[campo] ?? ''} onChange={e => setIndicadores(prev => prev.map((x, j) => j === i ? { ...x, [campo]: e.target.value } : x))}
                                style={{ ...inputStyle, fontSize: 11 }} />
                            </td>
                          ))}
                        </tr>
                      ))
                      : esencialesDefinitivas.map((act, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ ...td, fontSize: 11, color: '#6b7280' }}>{act.descripcion}</td>
                          {['indicador', 'formula', 'meta', 'cliente'].map(campo => (
                            <td key={campo} style={td}>
                              <input onChange={e => {
                                setIndicadores(prev => {
                                  const nueva = [...prev]
                                  const idx = nueva.findIndex(x => x.actividad_index === i)
                                  if (idx >= 0) nueva[idx] = { ...nueva[idx], [campo]: e.target.value }
                                  else nueva.push({ actividad_index: i, indicador: '', formula: '', meta: '', cliente: '', [campo]: e.target.value })
                                  return nueva
                                })
                              }} style={{ ...inputStyle, fontSize: 11 }} placeholder={campo === 'indicador' ? 'Nombre del indicador...' : ''} />
                            </td>
                          ))}
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button onClick={() => setPaso(5)} style={btnSecundario}>← Anterior</button>
              <button onClick={() => setPaso(7)} style={btnPrimario}>Ver vista previa →</button>
            </div>
          </div>
        )}

        {/* ============ PASO 7 ============ */}
        {paso === 7 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '2rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
            <h2 style={{ color: DARK, marginTop: 0, marginBottom: 4, fontSize: 18 }}>Vista previa — Ficha MDT</h2>
            <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 20 }}>Revisa antes de guardar. Puedes volver a cualquier paso para editar.</p>

            {generandoMision && (
              <div style={{ background: '#fffbeb', border: '1px solid #10b981', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#7a6020', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>✨</span> Generando misión del puesto con IA...
              </div>
            )}
            <ResumenFicha datos={datos} esenciales={esencialesDefinitivas} competencias={competencias} instruccion={instruccion} indicadores={indicadores} />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 12 }}>
              <button onClick={() => setPaso(6)} style={btnSecundario}>← Anterior</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => {
                    const { exportarFichaPDF } = await import('@/lib/exportar-ficha-pdf')
                    await exportarFichaPDF(datos, actividades.filter(a => a.descripcion.trim()), esencialesDefinitivas, competencias, { ...instruccion, experiencia_anios: instruccion.experiencia_anios ? parseInt(instruccion.experiencia_anios) : undefined, capacitacion: instruccion.capacitacion.map(c => ({ tema: c.tema, horas: parseInt(c.horas) || 0 })) }, indicadores, !datos.mision)
                  }}
                  style={btnSecundario}>
                  Exportar PDF borrador
                </button>
                <button onClick={guardar} disabled={guardando}
                  style={{ ...btnPrimario, opacity: guardando ? 0.6 : 1 }}>
                  {guardando ? 'Guardando...' : 'Guardar ficha'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ResumenFicha({ datos, esenciales, competencias, instruccion, indicadores }: {
  datos: { nombre_puesto: string; area: string; supervisado_por?: string; supervisa_a?: string; mision?: string; fecha?: string }
  esenciales: Actividad[]
  competencias: Competencia[]
  instruccion: Instruccion
  indicadores: Indicador[]
}) {
  const seccion = (titulo: string) => (
    <div style={{ background: NAVY, color: 'white', padding: '6px 12px', borderRadius: 4, fontSize: 12, fontWeight: 700, marginBottom: 8, marginTop: 16 }}>{titulo}</div>
  )
  const pendiente = (txt?: string) => txt ? <span>{txt}</span> : <span style={{ color: GOLD, fontStyle: 'italic' }}>[Por completar]</span>

  return (
    <div style={{ fontSize: 13, lineHeight: 1.6, color: '#111' }}>
      {seccion('1. DATOS DE IDENTIFICACIÓN')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <div><strong>Puesto:</strong> {pendiente(datos.nombre_puesto)}</div>
        <div><strong>Área:</strong> {pendiente(datos.area)}</div>
        <div><strong>Supervisado por:</strong> {pendiente(datos.supervisado_por)}</div>
        <div><strong>Supervisa a:</strong> {pendiente(datos.supervisa_a)}</div>
      </div>

      {seccion('2. MISIÓN')}
      <p style={{ margin: 0, color: datos.mision ? DARK : GOLD, fontStyle: datos.mision ? 'normal' : 'italic' }}>
        {datos.mision || '[Por completar]'}
      </p>

      {seccion('3. ACTIVIDADES ESENCIALES')}
      {esenciales.map((a, i) => (
        <div key={i} style={{ marginBottom: 4, paddingLeft: 12 }}>
          {i + 1}. {a.descripcion} <span style={{ color: '#6b7280', fontSize: 11 }}>(F={a.frecuencia} CE={a.consecuencia} CM={a.complejidad} → <strong>{calcularTotal(a.frecuencia, a.consecuencia, a.complejidad)}</strong>)</span>
        </div>
      ))}
      {esenciales.length === 0 && <p style={{ color: GOLD, fontStyle: 'italic' }}>[Sin actividades valoradas]</p>}

      {seccion('4–6. COMPETENCIAS')}
      {competencias.length > 0
        ? competencias.map((c, i) => <div key={i} style={{ paddingLeft: 12 }}>· {c.descripcion}</div>)
        : <p style={{ color: GOLD, fontStyle: 'italic' }}>[Por completar]</p>}

      {seccion('7. INSTRUCCIÓN Y EXPERIENCIA')}
      <div>
        {instruccion.nivel_educativo && <div>Nivel: {instruccion.nivel_educativo} · {instruccion.titulo}</div>}
        {instruccion.experiencia_anios && <div>Experiencia: {instruccion.experiencia_anios} años — {instruccion.experiencia_tipo}</div>}
        {!instruccion.nivel_educativo && <span style={{ color: GOLD, fontStyle: 'italic' }}>[Por completar]</span>}
      </div>

      {seccion('8. INDICADORES DE GESTIÓN')}
      {indicadores.length > 0
        ? indicadores.map((ind, i) => <div key={i} style={{ paddingLeft: 12 }}>· {ind.indicador} {ind.meta && `— Meta: ${ind.meta}`}</div>)
        : <p style={{ color: GOLD, fontStyle: 'italic' }}>[Por completar]</p>}
    </div>
  )
}

// Estilos reutilizables
const inputStyle: React.CSSProperties = { width: '100%', padding: '.55rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111', transition: 'border-color 0.2s' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#0A1A32', marginBottom: 6 }
const btnPrimario: React.CSSProperties = { background: GOLD, color: DARK, padding: '.6rem 2rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, boxShadow: '0 2px 8px rgba(16,185,129,0.35)', letterSpacing: 0.3 }
const btnSecundario: React.CSSProperties = { background: 'white', color: DARK, padding: '.5rem 1.25rem', borderRadius: 6, border: '1.5px solid #e5e7eb', cursor: 'pointer', fontSize: 13 }
const th: React.CSSProperties = { padding: '.5rem .75rem', textAlign: 'left', fontSize: 11, fontWeight: 600 }
const td: React.CSSProperties = { padding: '.4rem .6rem', verticalAlign: 'top' }

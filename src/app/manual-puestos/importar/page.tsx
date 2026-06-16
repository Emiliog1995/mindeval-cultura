'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthGuard } from '@/lib/useAuthGuard'
import { authHeaders } from '@/lib/auth-headers'

const DARK = '#0A1A32'
const GOLD = '#10b981'
const NAVY = '#1E2D5A'

interface PuestoImportado {
  nombre_puesto: string
  area: string
  supervisado_por?: string
  supervisa_a?: string
  mision?: string
  actividades: string[]
  conocimientos: string[]
  destrezas: string[]
  competencias_conductuales: string[]
  /** campo legacy por si la IA devuelve el campo viejo */
  competencias_mencionadas?: string[]
  instruccion?: string
  indicadores_mencionados: string[]
  _importado?: boolean
}

export default function ImportarManual() {
  const router = useRouter()
  const { verificando } = useAuthGuard()
  const fileRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [textoPDF, setTextoPDF] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [puestos, setPuestos] = useState<PuestoImportado[]>([])
  const [error, setError] = useState('')
  const [importando, setImportando] = useState<Set<number>>(new Set())
  const [importados, setImportados] = useState<Set<number>>(new Set())

  const procesarArchivo = async () => {
    if (!archivo && !textoPDF.trim()) {
      setError('Sube un archivo .docx o pega el texto del documento.')
      return
    }
    setError('')
    setProcesando(true)

    try {
      let res: Response
      const headers = await authHeaders()

      if (archivo) {
        const form = new FormData()
        form.append('file', archivo)
        res = await fetch('/api/importar-manual', { method: 'POST', body: form, headers })
      } else {
        // Texto plano → enviamos como txt
        const blob = new Blob([textoPDF], { type: 'text/plain' })
        const form = new FormData()
        form.append('file', new File([blob], 'manual.txt', { type: 'text/plain' }))
        res = await fetch('/api/importar-manual', { method: 'POST', body: form, headers })
      }

      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setPuestos(data.puestos ?? [])
        if ((data.puestos ?? []).length === 0) {
          setError('No se identificaron puestos en el documento. Verifica que el contenido sea un manual de puestos.')
        }
      }
    } catch {
      setError('Error al procesar el documento. Intenta de nuevo.')
    }
    setProcesando(false)
  }

  const importarPuesto = async (puesto: PuestoImportado, index: number) => {
    setImportando(prev => new Set([...prev, index]))
    try {
      const { data: pData, error: pErr } = await supabase.from('puestos').insert({
        nombre_puesto: puesto.nombre_puesto,
        area: puesto.area || 'Por definir',
        supervisado_por: puesto.supervisado_por || null,
        supervisa_a: puesto.supervisa_a || null,
        mision: puesto.mision || null,
        fecha: new Date().toISOString().slice(0, 10),
      }).select().single()

      if (pErr || !pData) throw pErr

      if (puesto.actividades.length > 0) {
        await supabase.from('actividades_puesto').insert(
          puesto.actividades.map((desc, i) => ({
            puesto_id: pData.id,
            orden: i + 1,
            descripcion: desc,
            es_esencial: false,
          }))
        )
      }

      // Competencias separadas por tipo
      const todasCompetencias = [
        ...(puesto.conocimientos ?? []).map(d => ({ puesto_id: pData.id, tipo: 'conocimiento', descripcion: d, sugerida_ia: true })),
        ...(puesto.destrezas ?? []).map(d => ({ puesto_id: pData.id, tipo: 'destreza_especifica', descripcion: d, sugerida_ia: true })),
        ...(puesto.competencias_conductuales ?? []).map(d => ({ puesto_id: pData.id, tipo: 'capacidad', descripcion: d, sugerida_ia: true })),
        // compatibilidad con respuesta legacy
        ...(puesto.competencias_mencionadas ?? []).map(d => ({ puesto_id: pData.id, tipo: 'conocimiento', descripcion: d, sugerida_ia: true })),
      ]
      if (todasCompetencias.length > 0) {
        await supabase.from('competencias_puesto').insert(todasCompetencias)
      }

      if (puesto.instruccion) {
        await supabase.from('instruccion_puesto').insert({
          puesto_id: pData.id,
          experiencia_tipo: puesto.instruccion,
        })
      }

      if (puesto.indicadores_mencionados?.length > 0) {
        await supabase.from('indicadores_puesto').insert(
          puesto.indicadores_mencionados.map(ind => ({
            puesto_id: pData.id,
            indicador: ind,
            sugerido_ia: true,
          }))
        )
      }

      setImportados(prev => new Set([...prev, index]))
    } catch {
      setError(`Error al importar "${puesto.nombre_puesto}"`)
    }
    setImportando(prev => { const n = new Set(prev); n.delete(index); return n })
  }

  if (verificando) return null

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
              MIND<span style={{ color: GOLD }}>TALENT</span> — Importar Manual
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>IA reestructura al formato MDT de 9 secciones</div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Zona de carga */}
        {puestos.length === 0 && (
          <div style={{ background: 'white', borderRadius: 10, padding: '2rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)', marginBottom: 20 }}>
            <h2 style={{ color: DARK, marginTop: 0, fontSize: 18 }}>Sube tu manual existente</h2>
            <p style={{ color: '#6b7280', fontSize: 13 }}>
              Acepta archivos Word (.docx). Si tienes un PDF, copia y pega el texto abajo.
              La IA identificará los puestos y los reestructurará al formato MDT. Los puestos importados llegan como <strong>borradores</strong> — deberás asignar los valores F/CE/CM manualmente.
            </p>

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${archivo ? GOLD : '#d1d5db'}`, borderRadius: 8, padding: '2rem',
                textAlign: 'center', cursor: 'pointer', marginBottom: 16, background: archivo ? 'rgba(16,185,129,0.04)' : '#f9fafb',
                transition: 'all .15s',
              }}>
              <input ref={fileRef} type='file' accept='.docx,.txt' style={{ display: 'none' }} onChange={e => { setArchivo(e.target.files?.[0] ?? null); setTextoPDF('') }} />
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              {archivo
                ? <div style={{ color: DARK, fontWeight: 600 }}>{archivo.name}</div>
                : <div style={{ color: '#9ca3af', fontSize: 13 }}>Haz clic para seleccionar un archivo .docx</div>}
            </div>

            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, marginBottom: 12 }}>— o pega el texto directamente —</div>

            <textarea
              value={textoPDF}
              onChange={e => { setTextoPDF(e.target.value); setArchivo(null) }}
              rows={8}
              placeholder='Pega aquí el contenido del manual (especialmente útil para PDFs)...'
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 6, padding: '.75rem', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            />

            {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={procesarArchivo}
                disabled={procesando || (!archivo && !textoPDF.trim())}
                style={{
                  background: GOLD, color: DARK, padding: '.6rem 1.75rem', borderRadius: 6, border: 'none',
                  cursor: 'pointer', fontWeight: 700, fontSize: 14,
                  opacity: procesando || (!archivo && !textoPDF.trim()) ? 0.5 : 1,
                }}>
                {procesando ? 'Procesando con IA...' : 'Analizar documento →'}
              </button>
            </div>
          </div>
        )}

        {/* Resultados */}
        {puestos.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, color: DARK, fontSize: 18 }}>
                  {puestos.length} puesto{puestos.length !== 1 ? 's' : ''} identificado{puestos.length !== 1 ? 's' : ''}
                </h2>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 12 }}>
                  Revisa cada puesto e impórtalo como borrador. Luego podrás completar los valores F/CE/CM en la ficha.
                </p>
              </div>
              <button onClick={() => { setPuestos([]); setArchivo(null); setTextoPDF(''); setError('') }}
                style={{ background: 'none', border: '1px solid #e5e7eb', color: '#6b7280', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                Cargar otro documento
              </button>
            </div>

            {puestos.map((p, i) => (
              <div key={i} style={{
                background: 'white', borderRadius: 10, padding: '1.5rem', marginBottom: 16,
                boxShadow: '0 1px 4px rgba(0,0,0,.08)',
                border: importados.has(i) ? `2px solid #4ade80` : '2px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, color: DARK, fontSize: 16 }}>{p.nombre_puesto}</h3>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Área: {p.area || 'No identificada'}</div>
                  </div>
                  {importados.has(i)
                    ? <span style={{ background: 'rgba(74,222,128,0.15)', color: '#166534', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>✓ Importado</span>
                    : <button
                      onClick={() => importarPuesto(p, i)}
                      disabled={importando.has(i)}
                      style={{ background: DARK, color: 'white', padding: '.4rem 1.25rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, opacity: importando.has(i) ? 0.6 : 1 }}>
                      {importando.has(i) ? 'Importando...' : 'Importar como borrador'}
                    </button>}
                </div>

                {p.mision && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: NAVY, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>Misión identificada</div>
                    <p style={{ margin: 0, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{p.mision}</p>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: NAVY, marginBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      Actividades ({p.actividades.length})
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16, color: '#374151', lineHeight: 1.7 }}>
                      {p.actividades.slice(0, 5).map((a, j) => <li key={j}>{a}</li>)}
                      {p.actividades.length > 5 && <li style={{ color: '#9ca3af' }}>+{p.actividades.length - 5} más...</li>}
                    </ul>
                  </div>
                  <div>
                    {((p.conocimientos?.length ?? 0) + (p.destrezas?.length ?? 0) + (p.competencias_conductuales?.length ?? 0)) > 0 && (
                      <>
                        <div style={{ fontWeight: 600, color: NAVY, marginBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                          Competencias ({(p.conocimientos?.length ?? 0) + (p.destrezas?.length ?? 0) + (p.competencias_conductuales?.length ?? 0)})
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16, color: '#374151', lineHeight: 1.7 }}>
                          {(p.conocimientos ?? []).slice(0, 2).map((c, j) => <li key={`c${j}`}>📚 {c}</li>)}
                          {(p.destrezas ?? []).slice(0, 2).map((c, j) => <li key={`d${j}`}>🛠️ {c}</li>)}
                          {(p.competencias_conductuales ?? []).slice(0, 2).map((c, j) => <li key={`k${j}`}>🤝 {c}</li>)}
                        </ul>
                      </>
                    )}
                    {p.indicadores_mencionados?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 600, color: NAVY, marginBottom: 2, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>Indicadores ({p.indicadores_mencionados.length})</div>
                        <ul style={{ margin: 0, paddingLeft: 16, color: '#374151', lineHeight: 1.7 }}>
                          {p.indicadores_mencionados.slice(0, 3).map((ind, j) => <li key={j}>{ind}</li>)}
                        </ul>
                      </div>
                    )}
                    {p.instruccion && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 600, color: NAVY, marginBottom: 2, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>Instrucción</div>
                        <p style={{ margin: 0, color: '#374151', lineHeight: 1.5 }}>{p.instruccion}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {importados.size > 0 && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button onClick={() => router.push('/manual-puestos')}
                  style={{ background: GOLD, color: DARK, padding: '.6rem 2rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                  Ver panel de puestos →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

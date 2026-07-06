'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthGuard } from '@/lib/useAuthGuard'
import type { TramoIR } from '@/lib/nomina-scoring'

type ParametrosRow = {
  id?: string
  anio: number
  sbu: number
  aporte_personal: number
  aporte_patronal: number
  fondos_reserva: number
  factor_decimo3: number
  factor_decimo4: number
  factor_vacaciones: number
  tabla_ir: TramoIR[]
}

const inputStyle = { padding: '.4rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111', width: 130 }
const inputPct = { ...inputStyle, width: 90 }

function vacio(anio: number): ParametrosRow {
  return {
    anio, sbu: 0, aporte_personal: 0, aporte_patronal: 0, fondos_reserva: 0,
    factor_decimo3: 0, factor_decimo4: 0, factor_vacaciones: 0, tabla_ir: [],
  }
}

export default function ParametrosLegalesAdmin() {
  const router = useRouter()
  const { verificando } = useAuthGuard()

  const [anios, setAnios] = useState<number[]>([])
  const [anioSeleccionado, setAnioSeleccionado] = useState<number | null>(null)
  const [form, setForm] = useState<ParametrosRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    supabase.from('parametros_legales').select('anio').order('anio', { ascending: false }).then(({ data }) => {
      const lista = (data ?? []).map(r => r.anio)
      setAnios(lista)
      if (lista.length > 0) setAnioSeleccionado(lista[0])
      else setAnioSeleccionado(new Date().getFullYear())
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (anioSeleccionado === null) return
    setMensaje('')
    supabase.from('parametros_legales').select('*').eq('anio', anioSeleccionado).maybeSingle().then(({ data }) => {
      setForm(data ? {
        id: data.id,
        anio: data.anio,
        sbu: data.sbu,
        aporte_personal: data.aporte_personal,
        aporte_patronal: data.aporte_patronal,
        fondos_reserva: data.fondos_reserva,
        factor_decimo3: data.factor_decimo3,
        factor_decimo4: data.factor_decimo4,
        factor_vacaciones: data.factor_vacaciones,
        tabla_ir: data.tabla_ir ?? [],
      } : vacio(anioSeleccionado))
    })
  }, [anioSeleccionado])

  function actualizarCampo<K extends keyof ParametrosRow>(campo: K, valor: ParametrosRow[K]) {
    setForm(prev => prev ? { ...prev, [campo]: valor } : prev)
  }

  function actualizarTramo(index: number, campo: keyof TramoIR, valor: number) {
    setForm(prev => {
      if (!prev) return prev
      const tabla_ir = prev.tabla_ir.map((t, i) => i === index ? { ...t, [campo]: valor } : t)
      return { ...prev, tabla_ir }
    })
  }

  function agregarTramo() {
    setForm(prev => {
      if (!prev) return prev
      const ultimo = prev.tabla_ir[prev.tabla_ir.length - 1]
      const nuevo: TramoIR = { desde: ultimo ? ultimo.hasta : 0, hasta: ultimo ? ultimo.hasta + 1000 : 1000, impuesto_fraccion: 0, porcentaje_excedente: 0 }
      return { ...prev, tabla_ir: [...prev.tabla_ir, nuevo] }
    })
  }

  function eliminarTramo(index: number) {
    setForm(prev => prev ? { ...prev, tabla_ir: prev.tabla_ir.filter((_, i) => i !== index) } : prev)
  }

  function crearNuevoAnio() {
    const siguiente = (anios[0] ?? new Date().getFullYear() - 1) + 1
    setAnioSeleccionado(siguiente)
    if (!anios.includes(siguiente)) setAnios(prev => [siguiente, ...prev].sort((a, b) => b - a))
  }

  async function guardar() {
    if (!form) return
    setGuardando(true)
    setMensaje('')
    const { error } = await supabase.from('parametros_legales').upsert({
      anio: form.anio,
      sbu: form.sbu,
      aporte_personal: form.aporte_personal,
      aporte_patronal: form.aporte_patronal,
      fondos_reserva: form.fondos_reserva,
      factor_decimo3: form.factor_decimo3,
      factor_decimo4: form.factor_decimo4,
      factor_vacaciones: form.factor_vacaciones,
      tabla_ir: form.tabla_ir,
    }, { onConflict: 'anio' })
    setGuardando(false)
    if (error) {
      setMensaje('Error al guardar: ' + error.message)
    } else {
      setMensaje('Guardado correctamente.')
      if (!anios.includes(form.anio)) setAnios(prev => [form.anio, ...prev].sort((a, b) => b - a))
    }
  }

  if (verificando || loading) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <div style={{ background: '#1a2035', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/nomina')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
            ← Nómina
          </button>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Parámetros legales</span>
        </div>
        <button onClick={crearNuevoAnio}
          style={{ background: '#c9a84c', color: '#1a2035', padding: '.45rem 1.1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          + Nuevo año
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ marginBottom: 20 }}>
          <select value={anioSeleccionado ?? ''} onChange={e => setAnioSeleccionado(Number(e.target.value))} style={inputStyle}>
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
            {anioSeleccionado !== null && !anios.includes(anioSeleccionado) && (
              <option value={anioSeleccionado}>{anioSeleccionado}</option>
            )}
          </select>
        </div>

        {form && (
          <>
            <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2035', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Parámetros {form.anio}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <Campo label="SBU (Salario Básico Unificado)">
                  <input type="number" value={form.sbu} onChange={e => actualizarCampo('sbu', Number(e.target.value))} style={inputStyle} />
                </Campo>
                <Campo label="Aporte personal IESS (ej. 0.0945 = 9.45%)">
                  <input type="number" step="0.0001" value={form.aporte_personal} onChange={e => actualizarCampo('aporte_personal', Number(e.target.value))} style={inputPct} />
                </Campo>
                <Campo label="Aporte patronal IESS">
                  <input type="number" step="0.0001" value={form.aporte_patronal} onChange={e => actualizarCampo('aporte_patronal', Number(e.target.value))} style={inputPct} />
                </Campo>
                <Campo label="Fondos de reserva">
                  <input type="number" step="0.0001" value={form.fondos_reserva} onChange={e => actualizarCampo('fondos_reserva', Number(e.target.value))} style={inputPct} />
                </Campo>
                <Campo label="Factor décimo tercero (1/12)">
                  <input type="number" step="0.0001" value={form.factor_decimo3} onChange={e => actualizarCampo('factor_decimo3', Number(e.target.value))} style={inputPct} />
                </Campo>
                <Campo label="Factor vacaciones (1/24)">
                  <input type="number" step="0.0001" value={form.factor_vacaciones} onChange={e => actualizarCampo('factor_vacaciones', Number(e.target.value))} style={inputPct} />
                </Campo>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af' }}>
                Décimo cuarto mensual se calcula automáticamente como SBU / 12 = ${(form.sbu / 12).toFixed(2)}
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2035', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Tabla de Impuesto a la Renta (anual, según SRI)
                </div>
                <button onClick={agregarTramo} style={{ background: 'rgba(201,168,76,0.15)', color: '#7a6020', padding: '.3rem .8rem', borderRadius: 5, border: '1px solid rgba(201,168,76,0.4)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                  + Agregar tramo
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Desde', 'Hasta', 'Imp. fracción básica', '% excedente', ''].map(h => (
                      <th key={h} style={{ padding: '.4rem .5rem', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.tabla_ir.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '.3rem .5rem' }}><input type="number" value={t.desde} onChange={e => actualizarTramo(i, 'desde', Number(e.target.value))} style={{ ...inputStyle, width: 100 }} /></td>
                      <td style={{ padding: '.3rem .5rem' }}><input type="number" value={t.hasta} onChange={e => actualizarTramo(i, 'hasta', Number(e.target.value))} style={{ ...inputStyle, width: 100 }} /></td>
                      <td style={{ padding: '.3rem .5rem' }}><input type="number" value={t.impuesto_fraccion} onChange={e => actualizarTramo(i, 'impuesto_fraccion', Number(e.target.value))} style={{ ...inputStyle, width: 100 }} /></td>
                      <td style={{ padding: '.3rem .5rem' }}><input type="number" step="0.01" value={t.porcentaje_excedente} onChange={e => actualizarTramo(i, 'porcentaje_excedente', Number(e.target.value))} style={inputPct} /></td>
                      <td style={{ padding: '.3rem .5rem' }}>
                        <button onClick={() => eliminarTramo(i)} style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c', padding: '.25rem .6rem', borderRadius: 5, border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontSize: 11 }}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {form.tabla_ir.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Sin tramos definidos.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={guardar} disabled={guardando}
                style={{ background: '#c9a84c', color: '#1a2035', padding: '.6rem 1.5rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                {guardando ? 'Guardando…' : `Guardar parámetros ${form.anio}`}
              </button>
              {mensaje && <span style={{ fontSize: 12, color: mensaje.startsWith('Error') ? '#b91c1c' : '#2d6a4f' }}>{mensaje}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthGuard } from '@/lib/useAuthGuard'
import { calcularUtilidades, type ResultadoUtilidades, type ReparticionUtilidad } from '@/lib/nomina-scoring'
import { exportarUtilidadesPDF } from '@/lib/exportar-utilidades-pdf'

type Empresa = { id: string; nombre: string }

type EmpleadoNomina = {
  id: string
  nombre: string
  cargas_familiares: number
}

// Reparto guardado de un año ya calculado. Incluye cargasFamiliares porque, a
// diferencia de ReparticionUtilidad, esto es lo que se muestra en la tabla
// para un año congelado (no viene de empleados_nomina, que puede haber
// cambiado desde entonces).
type ReparticionGuardada = ReparticionUtilidad & { cargasFamiliares: number }

type UtilidadHistorico = {
  anio: number
  utilidad_liquida: number
  valor_10_porciento: number
  valor_5_porciento: number
  total_empleados: number
  reparticiones: ReparticionGuardada[]
}

const inputStyle = { padding: '.4rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }
const money = (n: number) => `$${n.toFixed(2)}`

export default function Utilidades() {
  const router = useRouter()
  const { verificando } = useAuthGuard()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const [anio, setAnio] = useState(new Date().getFullYear() - 1)
  const [empleados, setEmpleados] = useState<EmpleadoNomina[]>([])
  const [utilidadLiquida, setUtilidadLiquida] = useState('')
  const [loading, setLoading] = useState(false)
  const [guardandoCargaId, setGuardandoCargaId] = useState<string | null>(null)
  const [guardandoUtilidad, setGuardandoUtilidad] = useState(false)
  const [historial, setHistorial] = useState<UtilidadHistorico[]>([])

  useEffect(() => {
    supabase.from('empresas_mdt').select('id, nombre').order('nombre').then(({ data }) => setEmpresas(data ?? []))
  }, [])

  useEffect(() => {
    if (!empresaSeleccionada) { setEmpleados([]); setHistorial([]); return }
    setLoading(true)
    supabase.from('empleados_nomina').select('id, nombre, cargas_familiares').eq('empresa_id', empresaSeleccionada).eq('estado', 'activo').order('nombre')
      .then(({ data }) => { setEmpleados(data ?? []); setLoading(false) })
    cargarHistorial(empresaSeleccionada)
  }, [empresaSeleccionada])

  async function cargarHistorial(empresaId: string) {
    const { data } = await supabase
      .from('utilidades_procesadas')
      .select('anio, utilidad_liquida, valor_10_porciento, valor_5_porciento, total_empleados, reparticiones')
      .eq('empresa_id', empresaId)
      .order('anio', { ascending: false })
    setHistorial((data ?? []) as UtilidadHistorico[])
  }

  async function actualizarCargas(id: string, valor: number) {
    setGuardandoCargaId(id)
    const { error } = await supabase.from('empleados_nomina').update({ cargas_familiares: valor }).eq('id', id)
    setGuardandoCargaId(null)
    if (!error) setEmpleados(prev => prev.map(e => e.id === id ? { ...e, cargas_familiares: valor } : e))
  }

  // Si este año ya se calculó y guardó antes, se muestra el snapshot congelado
  // (empleados y cargas familiares de ESE momento), nunca la nómina de hoy.
  const historicoAnioActual = historial.find(h => h.anio === anio) ?? null
  const anioBloqueado = historicoAnioActual !== null

  let resultado: ResultadoUtilidades | null = null
  if (historicoAnioActual) {
    resultado = {
      totalUtilidades: historicoAnioActual.utilidad_liquida * 0.15,
      pool10Porciento: historicoAnioActual.valor_10_porciento,
      pool5Porciento: historicoAnioActual.valor_5_porciento,
      reparticiones: historicoAnioActual.reparticiones,
    }
  } else if (empleados.length > 0 && Number(utilidadLiquida) > 0) {
    resultado = calcularUtilidades(
      empleados.map(e => ({ id: e.id, nombre: e.nombre, cargasFamiliares: e.cargas_familiares })),
      Number(utilidadLiquida)
    )
  }

  if (verificando) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <div style={{ background: '#1a2035', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/nomina')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
          ← Nómina
        </button>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Utilidades</span>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)', borderRadius: 8, padding: '.9rem 1.1rem', color: '#7a6020', fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>
          15% de la utilidad líquida de la empresa: 10% repartido en partes iguales entre todos los trabajadores, 5% en proporción a cargas familiares. La utilidad líquida se obtiene de la declaración de impuesto a la renta de la empresa — ingrésala manualmente, este sistema no la calcula.
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={empresaSeleccionada} onChange={e => setEmpresaSeleccionada(e.target.value)} style={inputStyle}>
            <option value=''>Selecciona una empresa…</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={inputStyle}>
            {[0, 1, 2, 3].map(offset => {
              const a = new Date().getFullYear() - 1 - offset
              return <option key={a} value={a}>Ejercicio {a}</option>
            })}
          </select>
          <input
            type="number"
            value={anioBloqueado ? historicoAnioActual!.utilidad_liquida : utilidadLiquida}
            onChange={e => setUtilidadLiquida(e.target.value)}
            disabled={anioBloqueado}
            placeholder="Utilidad líquida de la empresa"
            style={{ ...inputStyle, width: 220 }}
          />
        </div>

        {anioBloqueado && (
          <div style={{ background: 'rgba(45,106,79,0.1)', border: '1px solid rgba(45,106,79,0.3)', borderRadius: 8, padding: '.75rem 1rem', color: '#2d6a4f', fontSize: 12, marginBottom: 20 }}>
            🔒 El ejercicio {anio} ya fue calculado y guardado. Se muestra el reparto congelado con los empleados y cargas familiares de ese momento — no se recalcula aunque hoy la nómina activa sea distinta.
          </div>
        )}

        {!empresaSeleccionada && (
          <div style={{ background: 'white', borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            Selecciona una empresa para calcular el reparto de utilidades {anio}.
          </div>
        )}

        {empresaSeleccionada && loading && <div style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</div>}

        {empresaSeleccionada && !loading && empleados.length === 0 && !anioBloqueado && (
          <div style={{ background: 'white', borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            Esta empresa no tiene empleados activos.
          </div>
        )}

        {empresaSeleccionada && !loading && (empleados.length > 0 || anioBloqueado) && (
          <>
            {resultado && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Total utilidades (15%)', valor: resultado.totalUtilidades, color: '#1a2035' },
                  { label: '10% partes iguales', valor: resultado.pool10Porciento, color: '#243447' },
                  { label: '5% por cargas familiares', valor: resultado.pool5Porciento, color: '#c9a84c' },
                ].map(k => (
                  <div key={k.label} style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.08)', borderLeft: `4px solid ${k.color}` }}>
                    <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{money(k.valor)}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1a2035', color: 'white' }}>
                    {['Empleado', 'Cargas familiares', '10% partes iguales', '5% por cargas', 'Total a recibir'].map(h => (
                      <th key={h} style={{ padding: '.5rem .75rem', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {anioBloqueado ? (
                    historicoAnioActual!.reparticiones.map((rep, i) => (
                      <tr key={rep.empleadoId} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '.4rem .75rem', fontSize: 13, fontWeight: 600, color: '#1a2035' }}>{rep.nombre}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{rep.cargasFamiliares}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{money(rep.montoIgual)}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{money(rep.montoCargas)}</td>
                        <td style={{ padding: '.4rem .75rem', fontSize: 12, fontWeight: 700, color: '#2d6a4f' }}>{money(rep.total)}</td>
                      </tr>
                    ))
                  ) : (
                    empleados.map((e, i) => {
                      const rep = resultado?.reparticiones.find(r => r.empleadoId === e.id)
                      return (
                        <tr key={e.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '.4rem .75rem', fontSize: 13, fontWeight: 600, color: '#1a2035' }}>{e.nombre}</td>
                          <td style={{ padding: '.4rem .75rem' }}>
                            <input
                              type="number"
                              defaultValue={e.cargas_familiares}
                              onBlur={ev => actualizarCargas(e.id, Number(ev.target.value) || 0)}
                              disabled={guardandoCargaId === e.id}
                              style={{ ...inputStyle, width: 70 }}
                            />
                          </td>
                          <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{rep ? money(rep.montoIgual) : '—'}</td>
                          <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{rep ? money(rep.montoCargas) : '—'}</td>
                          <td style={{ padding: '.4rem .75rem', fontSize: 12, fontWeight: 700, color: '#2d6a4f' }}>{rep ? money(rep.total) : '—'}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!resultado && (
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
                Ingresa la utilidad líquida de la empresa para ver el reparto calculado.
              </div>
            )}

            {resultado && (
              <button
                onClick={async () => {
                  const empresaNombre = empresas.find(e => e.id === empresaSeleccionada)?.nombre ?? ''
                  const utilidadUsada = anioBloqueado ? historicoAnioActual!.utilidad_liquida : Number(utilidadLiquida)

                  if (anioBloqueado) {
                    // Ya guardado: solo se reexporta el PDF con el snapshot
                    // congelado, nunca se vuelve a escribir en la BD.
                    exportarUtilidadesPDF(empresaNombre, anio, utilidadUsada, resultado)
                    return
                  }

                  setGuardandoUtilidad(true)
                  exportarUtilidadesPDF(empresaNombre, anio, utilidadUsada, resultado)
                  // Snapshot de cargas familiares al momento del cálculo, para
                  // que consultar este año más adelante no dependa de la
                  // nómina activa de ese momento futuro.
                  const reparticionesConCargas: ReparticionGuardada[] = resultado.reparticiones.map(r => ({
                    ...r,
                    cargasFamiliares: empleados.find(e => e.id === r.empleadoId)?.cargas_familiares ?? 0,
                  }))
                  await supabase.from('utilidades_procesadas').upsert({
                    empresa_id: empresaSeleccionada,
                    anio,
                    utilidad_liquida: utilidadUsada,
                    valor_10_porciento: resultado.pool10Porciento,
                    valor_5_porciento: resultado.pool5Porciento,
                    total_empleados: resultado.reparticiones.length,
                    reparticiones: reparticionesConCargas,
                  }, { onConflict: 'empresa_id,anio' })
                  setGuardandoUtilidad(false)
                  cargarHistorial(empresaSeleccionada)
                }}
                disabled={guardandoUtilidad}
                style={{ marginTop: 16, background: '#1a2035', color: 'white', padding: '.6rem 1.5rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                {guardandoUtilidad ? 'Guardando…' : anioBloqueado ? '🔒 Exportar PDF (año ya guardado)' : 'Exportar PDF y guardar'}
              </button>
            )}
          </>
        )}

        {empresaSeleccionada && historial.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2035', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Histórico de utilidades por año
            </div>
            <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1a2035', color: 'white' }}>
                    {['Año', 'Utilidad líquida', '10% partes iguales', '5% cargas', 'Empleados'].map(h => (
                      <th key={h} style={{ padding: '.5rem .75rem', textAlign: 'left', fontSize: 11, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h, i) => (
                    <tr key={h.anio} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '.4rem .75rem', fontSize: 13, fontWeight: 600, color: '#1a2035' }}>{h.anio}</td>
                      <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{money(h.utilidad_liquida)}</td>
                      <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{money(h.valor_10_porciento)}</td>
                      <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{money(h.valor_5_porciento)}</td>
                      <td style={{ padding: '.4rem .75rem', fontSize: 12, color: '#374151' }}>{h.total_empleados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

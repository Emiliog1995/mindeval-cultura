'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthGuard } from '@/lib/useAuthGuard'
import { calcularNomina, resultadoDesdeGuardado, type ParametrosLegales, type ResultadoNomina } from '@/lib/nomina-scoring'

type Empresa = { id: string; nombre: string }

type EmpleadoNomina = {
  id: string
  empresa_id: string
  nombre: string
  cargo: string | null
  sueldo_nominal: number
  fondos_reserva_activo: boolean
  estado: string
}

type Novedades = {
  diasTrabajados: number
  horasSuplementarias: number
  horasExtraordinarias: number
  comisiones: number
  bonos: number
  anticipos: number
  prestamoIess: number
  otrosDescuentos: number
}

type EstadoRol = 'borrador' | 'aprobado' | 'pagado'

type FilaNomina = {
  empleado: EmpleadoNomina
  novedades: Novedades
  resultado: ResultadoNomina
  guardado: boolean
  guardando: boolean
  estado: EstadoRol
  // true cuando estado es 'aprobado' o 'pagado': el resultado viene tal cual
  // se guardó en nomina_mensual y no se vuelve a calcular ni se deja editar.
  bloqueado: boolean
}

const novedadesPorDefecto: Novedades = {
  diasTrabajados: 30,
  horasSuplementarias: 0,
  horasExtraordinarias: 0,
  comisiones: 0,
  bonos: 0,
  anticipos: 0,
  prestamoIess: 0,
  otrosDescuentos: 0,
}

const inputNum = { width: 64, padding: '.25rem .4rem', border: '1.5px solid #d1d5db', borderRadius: 5, fontSize: 12, outline: 'none', color: '#111', textAlign: 'right' as const }

export default function RolNominaPeriodo() {
  const router = useRouter()
  const params = useParams<{ periodo: string }>()
  const periodo = params.periodo
  const { verificando } = useAuthGuard()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const [parametros, setParametros] = useState<ParametrosLegales | null>(null)
  const [filas, setFilas] = useState<FilaNomina[]>([])
  const [loading, setLoading] = useState(true)
  const [guardandoTodo, setGuardandoTodo] = useState(false)
  // Ids de novedades_nomina pendientes que se usaron para pre-llenar cada fila;
  // se marcan aplicado=true recién cuando el consultor guarda esa fila.
  const [novedadesConsumidas, setNovedadesConsumidas] = useState<Record<string, string[]>>({})

  const anio = useMemo(() => Number(periodo.split('-')[0]), [periodo])

  useEffect(() => {
    supabase.from('empresas_mdt').select('id, nombre').order('nombre').then(({ data }) => setEmpresas(data ?? []))
  }, [])

  useEffect(() => {
    supabase.from('parametros_legales').select('*').eq('anio', anio).maybeSingle().then(({ data }) => {
      if (data) {
        setParametros({
          anio: data.anio,
          sbu: data.sbu,
          aporte_personal: data.aporte_personal,
          aporte_patronal: data.aporte_patronal,
          fondos_reserva: data.fondos_reserva,
          factor_decimo3: data.factor_decimo3,
          factor_decimo4: data.factor_decimo4,
          factor_vacaciones: data.factor_vacaciones,
          tabla_ir: data.tabla_ir,
        })
      }
    })
  }, [anio])

  useEffect(() => {
    if (!empresaSeleccionada) { setFilas([]); setNovedadesConsumidas({}); setLoading(false); return }
    setLoading(true)
    supabase.from('empleados_nomina').select('*').eq('empresa_id', empresaSeleccionada).eq('estado', 'activo').order('nombre')
      .then(async ({ data: emps }) => {
        const empleadosLista = emps ?? []
        const ids = empleadosLista.map(e => e.id)

        const [{ data: existentes }, { data: novedadesPendientes }] = await Promise.all([
          supabase.from('nomina_mensual').select('*').eq('empresa_id', empresaSeleccionada).eq('periodo', periodo),
          ids.length > 0
            ? supabase.from('novedades_nomina').select('*').eq('periodo', periodo).eq('aplicado', false).in('empleado_id', ids)
            : Promise.resolve({ data: [] }),
        ])

        const mapaExistentes = new Map((existentes ?? []).map(n => [n.empleado_id, n]))
        const consumidas: Record<string, string[]> = {}

        const nuevasFilas: FilaNomina[] = empleadosLista.map(empleado => {
          const previo = mapaExistentes.get(empleado.id)

          if (previo) {
            // Ya hay un rol guardado para este periodo: no se pisa con novedades,
            // el consultor ya lo procesó y puede seguir ajustándolo a mano.
            const estadoPrevio = (previo.estado ?? 'borrador') as EstadoRol
            const bloqueado = estadoPrevio === 'aprobado' || estadoPrevio === 'pagado'
            return {
              empleado,
              novedades: {
                diasTrabajados: previo.dias_trabajados,
                horasSuplementarias: previo.horas_suplementarias,
                horasExtraordinarias: previo.horas_extraordinarias,
                comisiones: previo.comisiones,
                bonos: previo.bonos,
                anticipos: previo.anticipos,
                prestamoIess: previo.prestamo_iess,
                otrosDescuentos: previo.otros_descuentos,
              },
              // Roles aprobados/pagados: se leen tal cual se guardaron, nunca
              // se recalculan. Borradores: se recalculan en el efecto de abajo.
              resultado: bloqueado ? resultadoDesdeGuardado(previo) : resultadoVacio(),
              guardado: true,
              guardando: false,
              estado: estadoPrevio,
              bloqueado,
            }
          }

          // Sin rol guardado todavía: pre-llenar con las novedades pendientes
          // del mes (ausencias descuentan días, horas y anticipos se suman).
          const novedadesEmpleado = (novedadesPendientes ?? []).filter(n => n.empleado_id === empleado.id)
          const sumar = (tipo: string) => novedadesEmpleado.filter(n => n.tipo_novedad === tipo).reduce((acc, n) => acc + n.valor, 0)

          const diasAusencia = sumar('ausencia')
          const novedades: Novedades = {
            ...novedadesPorDefecto,
            diasTrabajados: Math.max(0, 30 - diasAusencia),
            horasSuplementarias: sumar('suplementaria'),
            horasExtraordinarias: sumar('extra'),
            anticipos: sumar('anticipo'),
          }

          const idsConsumidos = novedadesEmpleado
            .filter(n => ['ausencia', 'suplementaria', 'extra', 'anticipo'].includes(n.tipo_novedad))
            .map(n => n.id)
          if (idsConsumidos.length > 0) consumidas[empleado.id] = idsConsumidos

          return { empleado, novedades, resultado: resultadoVacio(), guardado: false, guardando: false, estado: 'borrador' as EstadoRol, bloqueado: false }
        })

        setNovedadesConsumidas(consumidas)
        setFilas(nuevasFilas)
        setLoading(false)
      })
  }, [empresaSeleccionada, periodo])

  useEffect(() => {
    if (!parametros) return
    setFilas(prev => prev.map(f => {
      // Bloqueadas (aprobado/pagado): el resultado ya vino de resultadoDesdeGuardado
      // y no se toca, aunque cambien los parámetros legales del año.
      if (f.bloqueado) return f
      return {
        ...f,
        resultado: calcularNomina(
          { sueldoNominal: f.empleado.sueldo_nominal, fondosReservaActivo: f.empleado.fondos_reserva_activo },
          f.novedades,
          parametros
        ),
      }
    }))
  }, [parametros, filas.length])

  function actualizarNovedad(empleadoId: string, campo: keyof Novedades, valor: number) {
    if (!parametros) return
    setFilas(prev => prev.map(f => {
      if (f.empleado.id !== empleadoId || f.bloqueado) return f
      const novedades = { ...f.novedades, [campo]: valor }
      return { ...f, novedades, guardado: false, resultado: calcularNomina(
        { sueldoNominal: f.empleado.sueldo_nominal, fondosReservaActivo: f.empleado.fondos_reserva_activo },
        novedades,
        parametros
      ) }
    }))
  }

  // La grilla muestra Comisiones + Bonos como un solo campo combinado;
  // al editarlo, guardamos todo en `comisiones` y anulamos `bonos` para
  // no arrastrar un valor de bonos guardado antes y duplicarlo.
  function actualizarComisionesBonos(empleadoId: string, valor: number) {
    if (!parametros) return
    setFilas(prev => prev.map(f => {
      if (f.empleado.id !== empleadoId || f.bloqueado) return f
      const novedades = { ...f.novedades, comisiones: valor, bonos: 0 }
      return { ...f, novedades, guardado: false, resultado: calcularNomina(
        { sueldoNominal: f.empleado.sueldo_nominal, fondosReservaActivo: f.empleado.fondos_reserva_activo },
        novedades,
        parametros
      ) }
    }))
  }

  async function guardarFila(fila: FilaNomina) {
    // Bloqueada (aprobado/pagado): ya está congelada, no se vuelve a guardar.
    if (fila.bloqueado) return
    setFilas(prev => prev.map(f => f.empleado.id === fila.empleado.id ? { ...f, guardando: true } : f))
    const { error } = await supabase.from('nomina_mensual').upsert({
      empleado_id: fila.empleado.id,
      empresa_id: fila.empleado.empresa_id,
      periodo,
      dias_trabajados: fila.novedades.diasTrabajados,
      horas_suplementarias: fila.novedades.horasSuplementarias,
      horas_extraordinarias: fila.novedades.horasExtraordinarias,
      comisiones: fila.novedades.comisiones,
      bonos: fila.novedades.bonos,
      anticipos: fila.novedades.anticipos,
      prestamo_iess: fila.novedades.prestamoIess,
      otros_descuentos: fila.novedades.otrosDescuentos,
      sueldo_ganado: fila.resultado.sueldoGanado,
      valor_horas_suplementarias: fila.resultado.valorHorasSuplementarias,
      valor_horas_extraordinarias: fila.resultado.valorHorasExtraordinarias,
      total_ingresos: fila.resultado.totalIngresos,
      aporte_iess_personal: fila.resultado.aporteIessPersonal,
      impuesto_renta: fila.resultado.impuestoRenta,
      total_descuentos: fila.resultado.totalDescuentos,
      liquido_recibir: fila.resultado.liquidoRecibir,
      aporte_patronal: fila.resultado.aportePatronal,
      fondos_reserva: fila.resultado.fondosReserva,
      costo_empresa: fila.resultado.costoEmpresa,
      provision_decimo3: fila.resultado.provisionDecimo3,
      provision_decimo4: fila.resultado.provisionDecimo4,
      provision_vacaciones: fila.resultado.provisionVacaciones,
    }, { onConflict: 'empleado_id,periodo' })

    const idsConsumidos = novedadesConsumidas[fila.empleado.id]
    if (!error && idsConsumidos && idsConsumidos.length > 0) {
      await supabase.from('novedades_nomina').update({ aplicado: true }).in('id', idsConsumidos)
      setNovedadesConsumidas(prev => {
        const copia = { ...prev }
        delete copia[fila.empleado.id]
        return copia
      })
    }

    setFilas(prev => prev.map(f => f.empleado.id === fila.empleado.id ? { ...f, guardando: false, guardado: !error } : f))
  }

  async function guardarTodo() {
    setGuardandoTodo(true)
    for (const fila of filas) {
      if (!fila.guardado) await guardarFila(fila)
    }
    setGuardandoTodo(false)
  }

  async function cambiarEstadoMasivo(nuevoEstado: EstadoRol) {
    const idsGuardados = filas.filter(f => f.guardado).map(f => f.empleado.id)
    if (idsGuardados.length === 0) return
    const { error } = await supabase.from('nomina_mensual')
      .update({ estado: nuevoEstado })
      .eq('empresa_id', empresaSeleccionada)
      .eq('periodo', periodo)
      .in('empleado_id', idsGuardados)
    if (!error) {
      // A partir de aprobado/pagado la fila queda congelada: su `resultado`
      // actual es exactamente lo que se guardó (guardarFila ya se llamó antes
      // para poder aprobar), así que se conserva tal cual y se bloquea edición.
      setFilas(prev => prev.map(f => f.guardado ? { ...f, estado: nuevoEstado, bloqueado: true } : f))
    }
  }

  const conteoEstados = filas.reduce(
    (acc, f) => { if (f.guardado) acc[f.estado] += 1; return acc },
    { borrador: 0, aprobado: 0, pagado: 0 } as Record<EstadoRol, number>
  )

  const totales = filas.reduce((acc, f) => ({
    totalIngresos: acc.totalIngresos + f.resultado.totalIngresos,
    liquido: acc.liquido + f.resultado.liquidoRecibir,
    costoEmpresa: acc.costoEmpresa + f.resultado.costoEmpresa,
  }), { totalIngresos: 0, liquido: 0, costoEmpresa: 0 })

  if (verificando) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <div style={{ background: '#1a2035', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/nomina')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
            ← Nómina
          </button>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Rol de nómina — {periodo}</span>
        </div>
        {filas.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardarTodo} disabled={guardandoTodo}
              style={{ background: '#c9a84c', color: '#1a2035', padding: '.45rem 1.1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {guardandoTodo ? 'Guardando…' : 'Guardar todo'}
            </button>
            <button onClick={() => cambiarEstadoMasivo('aprobado')} disabled={conteoEstados.borrador === 0 && conteoEstados.aprobado === 0}
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '.45rem 1.1rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              Aprobar nómina
            </button>
            <button onClick={() => cambiarEstadoMasivo('pagado')} disabled={filas.filter(f => f.guardado).length === 0}
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '.45rem 1.1rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              Marcar como pagado
            </button>
          </div>
        )}
      </div>

      <div style={{ maxWidth: '100%', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <select value={empresaSeleccionada} onChange={e => setEmpresaSeleccionada(e.target.value)}
            style={{ padding: '.4rem .75rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111' }}>
            <option value=''>Selecciona una empresa…</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>

        {!parametros && (
          <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '1rem 1.25rem', color: '#b91c1c', fontSize: 13, marginBottom: 20 }}>
            No hay parámetros legales configurados para el año {anio}. Ve a Nómina → Parámetros legales antes de procesar este periodo.
          </div>
        )}

        {!empresaSeleccionada && (
          <div style={{ background: 'white', borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            Selecciona una empresa para ver su rol de nómina de {periodo}.
          </div>
        )}

        {empresaSeleccionada && loading && <div style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</div>}

        {empresaSeleccionada && !loading && parametros && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total ingresos', valor: totales.totalIngresos, color: '#1a2035' },
                { label: 'Total líquido a pagar', valor: totales.liquido, color: '#2d6a4f' },
                { label: 'Costo total empresa', valor: totales.costoEmpresa, color: '#c9a84c' },
              ].map(k => (
                <div key={k.label} style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.08)', borderLeft: `4px solid ${k.color}` }}>
                  <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>${k.valor.toFixed(2)}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
              Estado de roles: <b style={{ color: '#7a6020' }}>{conteoEstados.borrador} borrador</b> · <b style={{ color: '#1a2035' }}>{conteoEstados.aprobado} aprobado</b> · <b style={{ color: '#2d6a4f' }}>{conteoEstados.pagado} pagado</b>
            </div>

            {filas.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                Esta empresa no tiene empleados activos. Ve a Nómina → Empleados para agregarlos.
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.08)', overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1400 }}>
                  <thead>
                    <tr style={{ background: '#1a2035', color: 'white' }}>
                      {['Nombre', 'Sueldo nom.', 'Días', 'H. Suplem.', 'H. Extra', 'Comis./Bonos', 'Total ingr.', 'Aporte IESS', 'Anticipos', 'Préstamo', 'Otros desc.', 'IR', 'Total desc.', 'Líquido', 'Ap. Patronal', 'F. Reserva', 'Costo empresa', 'Estado', ''].map(h => (
                        <th key={h} style={{ padding: '.5rem .6rem', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={f.empleado.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '.4rem .6rem', fontSize: 12, fontWeight: 600, color: '#1a2035', whiteSpace: 'nowrap' }}>
                          {f.empleado.nombre}
                          {novedadesConsumidas[f.empleado.id] && (
                            <span title="Pre-llenado desde Novedades del periodo" style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#7a6020', background: 'rgba(201,168,76,0.15)', padding: '1px 5px', borderRadius: 8 }}>
                              novedades
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '.4rem .6rem', fontSize: 12, color: '#374151' }}>${f.empleado.sueldo_nominal.toFixed(2)}</td>
                        <td style={{ padding: '.4rem .6rem' }}><input type="number" value={f.novedades.diasTrabajados} disabled={f.bloqueado} onChange={e => actualizarNovedad(f.empleado.id, 'diasTrabajados', Number(e.target.value))} style={inputNum} /></td>
                        <td style={{ padding: '.4rem .6rem' }}><input type="number" value={f.novedades.horasSuplementarias} disabled={f.bloqueado} onChange={e => actualizarNovedad(f.empleado.id, 'horasSuplementarias', Number(e.target.value))} style={inputNum} /></td>
                        <td style={{ padding: '.4rem .6rem' }}><input type="number" value={f.novedades.horasExtraordinarias} disabled={f.bloqueado} onChange={e => actualizarNovedad(f.empleado.id, 'horasExtraordinarias', Number(e.target.value))} style={inputNum} /></td>
                        <td style={{ padding: '.4rem .6rem' }}><input type="number" value={f.novedades.comisiones + f.novedades.bonos} disabled={f.bloqueado} onChange={e => actualizarComisionesBonos(f.empleado.id, Number(e.target.value))} style={inputNum} /></td>
                        <td style={{ padding: '.4rem .6rem', fontSize: 12, fontWeight: 700, color: '#1a2035' }}>${f.resultado.totalIngresos.toFixed(2)}</td>
                        <td style={{ padding: '.4rem .6rem', fontSize: 12, color: '#374151' }}>${f.resultado.aporteIessPersonal.toFixed(2)}</td>
                        <td style={{ padding: '.4rem .6rem' }}><input type="number" value={f.novedades.anticipos} disabled={f.bloqueado} onChange={e => actualizarNovedad(f.empleado.id, 'anticipos', Number(e.target.value))} style={inputNum} /></td>
                        <td style={{ padding: '.4rem .6rem' }}><input type="number" value={f.novedades.prestamoIess} disabled={f.bloqueado} onChange={e => actualizarNovedad(f.empleado.id, 'prestamoIess', Number(e.target.value))} style={inputNum} /></td>
                        <td style={{ padding: '.4rem .6rem' }}><input type="number" value={f.novedades.otrosDescuentos} disabled={f.bloqueado} onChange={e => actualizarNovedad(f.empleado.id, 'otrosDescuentos', Number(e.target.value))} style={inputNum} /></td>
                        <td style={{ padding: '.4rem .6rem', fontSize: 12, color: '#374151' }}>${f.resultado.impuestoRenta.toFixed(2)}</td>
                        <td style={{ padding: '.4rem .6rem', fontSize: 12, color: '#374151' }}>${f.resultado.totalDescuentos.toFixed(2)}</td>
                        <td style={{ padding: '.4rem .6rem', fontSize: 12, fontWeight: 700, color: '#2d6a4f' }}>${f.resultado.liquidoRecibir.toFixed(2)}</td>
                        <td style={{ padding: '.4rem .6rem', fontSize: 12, color: '#374151' }}>${f.resultado.aportePatronal.toFixed(2)}</td>
                        <td style={{ padding: '.4rem .6rem', fontSize: 12, color: '#374151' }}>${f.resultado.fondosReserva.toFixed(2)}</td>
                        <td style={{ padding: '.4rem .6rem', fontSize: 12, fontWeight: 700, color: '#c9a84c' }}>${f.resultado.costoEmpresa.toFixed(2)}</td>
                        <td style={{ padding: '.4rem .6rem' }}>
                          <span style={{
                            padding: '.15rem .6rem', borderRadius: 12, fontSize: 10, fontWeight: 700,
                            background: f.estado === 'pagado' ? 'rgba(45,106,79,0.12)' : f.estado === 'aprobado' ? 'rgba(26,32,53,0.1)' : 'rgba(201,168,76,0.15)',
                            color: f.estado === 'pagado' ? '#2d6a4f' : f.estado === 'aprobado' ? '#1a2035' : '#7a6020',
                          }}>
                            {f.estado}
                          </span>
                        </td>
                        <td style={{ padding: '.4rem .6rem', whiteSpace: 'nowrap' }}>
                          <button onClick={() => guardarFila(f)} disabled={f.guardando || f.bloqueado}
                            style={{ background: f.guardado ? 'rgba(45,106,79,0.12)' : '#c9a84c', color: f.guardado ? '#2d6a4f' : '#1a2035', padding: '.3rem .7rem', borderRadius: 5, border: 'none', cursor: f.bloqueado ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, marginRight: 6, opacity: f.bloqueado ? 0.6 : 1 }}>
                            {f.guardando ? '…' : f.bloqueado ? `🔒 ${f.estado}` : f.guardado ? '✓ Guardado' : 'Guardar'}
                          </button>
                          <button onClick={() => router.push(`/nomina/periodo/${periodo}/${f.empleado.id}`)}
                            style={{ background: 'rgba(26,32,53,0.06)', color: '#1a2035', padding: '.3rem .7rem', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                            Ver rol
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function resultadoVacio(): ResultadoNomina {
  return {
    sueldoGanado: 0, valorHorasSuplementarias: 0, valorHorasExtraordinarias: 0, totalIngresos: 0,
    aporteIessPersonal: 0, impuestoRenta: 0, totalDescuentos: 0, liquidoRecibir: 0,
    aportePatronal: 0, fondosReserva: 0, costoEmpresa: 0,
    provisionDecimo3: 0, provisionDecimo4: 0, provisionVacaciones: 0,
  }
}

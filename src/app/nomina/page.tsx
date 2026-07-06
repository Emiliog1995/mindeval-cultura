'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthGuard } from '@/lib/useAuthGuard'

type Empresa = {
  id: string
  nombre: string
}

type NominaMensual = {
  id: string
  empresa_id: string
  periodo: string
  total_ingresos: number
  liquido_recibir: number
  costo_empresa: number
  provision_decimo3: number
  provision_decimo4: number
  provision_vacaciones: number
  horas_extraordinarias: number
  anticipos: number
  estado: string
}

type NovedadPendiente = {
  id: string
  tipo_novedad: string
}

function periodoActual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function DashboardNomina() {
  const router = useRouter()
  const { verificando } = useAuthGuard()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const [periodo, setPeriodo] = useState(periodoActual())
  const [filas, setFilas] = useState<NominaMensual[]>([])
  const [empleadosCount, setEmpleadosCount] = useState(0)
  const [novedadesPendientes, setNovedadesPendientes] = useState<NovedadPendiente[]>([])
  const [vacacionesVencidas, setVacacionesVencidas] = useState(0)
  const [loading, setLoading] = useState(true)
  const [nuevaEmpresa, setNuevaEmpresa] = useState(false)
  const [nombreNuevaEmpresa, setNombreNuevaEmpresa] = useState('')
  const [creandoEmpresa, setCreandoEmpresa] = useState(false)

  useEffect(() => {
    supabase.from('empresas_mdt').select('id, nombre').order('nombre').then(({ data }) => {
      setEmpresas(data ?? [])
    })
  }, [])

  async function crearEmpresa() {
    if (!nombreNuevaEmpresa.trim()) return
    setCreandoEmpresa(true)
    const { data, error } = await supabase.from('empresas_mdt').insert({ nombre: nombreNuevaEmpresa.trim() }).select().single()
    setCreandoEmpresa(false)
    if (!error && data) {
      setEmpresas(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setEmpresaSeleccionada(data.id)
      setNuevaEmpresa(false)
      setNombreNuevaEmpresa('')
    }
  }

  useEffect(() => {
    setLoading(true)
    let query = supabase.from('nomina_mensual').select('*').eq('periodo', periodo)
    if (empresaSeleccionada) query = query.eq('empresa_id', empresaSeleccionada)

    let empQuery = supabase.from('empleados_nomina').select('id', { count: 'exact', head: true }).eq('estado', 'activo')
    if (empresaSeleccionada) empQuery = empQuery.eq('empresa_id', empresaSeleccionada)

    const novQuery = supabase.from('novedades_nomina').select('id, tipo_novedad').eq('periodo', periodo).eq('aplicado', false)

    Promise.all([query, empQuery, novQuery]).then(([nomina, emp, nov]) => {
      setFilas(nomina.data ?? [])
      setEmpleadosCount(emp.count ?? 0)
      setNovedadesPendientes(nov.data ?? [])
      setLoading(false)
    })

    supabase.from('vacaciones_empleado').select('id', { count: 'exact', head: true }).gt('dias_pendientes', 15)
      .then(({ count }) => setVacacionesVencidas(count ?? 0))
  }, [empresaSeleccionada, periodo])

  const totales = filas.reduce(
    (acc, f) => ({
      liquido: acc.liquido + (f.liquido_recibir || 0),
      costoEmpresa: acc.costoEmpresa + (f.costo_empresa || 0),
      provisiones: acc.provisiones + (f.provision_decimo3 || 0) + (f.provision_decimo4 || 0) + (f.provision_vacaciones || 0),
      horasExtra: acc.horasExtra + (f.horas_extraordinarias || 0),
      anticipos: acc.anticipos + (f.anticipos || 0),
    }),
    { liquido: 0, costoEmpresa: 0, provisiones: 0, horasExtra: 0, anticipos: 0 }
  )

  const conteoEstados = filas.reduce(
    (acc, f) => { acc[f.estado as 'borrador' | 'aprobado' | 'pagado'] = (acc[f.estado as 'borrador' | 'aprobado' | 'pagado'] ?? 0) + 1; return acc },
    {} as Record<'borrador' | 'aprobado' | 'pagado', number>
  )

  const rolesProcesados = filas.length
  const rolesPendientes = Math.max(0, empleadosCount - rolesProcesados)
  const anticiposPendientesCount = novedadesPendientes.filter(n => n.tipo_novedad === 'anticipo').length
  const horasExtraAlerta = novedadesPendientes.filter(n => n.tipo_novedad === 'extra' || n.tipo_novedad === 'suplementaria').length

  if (verificando) return null

  const secciones = [
    { label: 'Empleados', desc: 'Importar desde Manual de Puestos, fichas', href: '/nomina/empleados' },
    { label: `Rol de nómina — ${periodo}`, desc: 'Grilla mensual, cálculo automático', href: `/nomina/periodo/${periodo}` },
    { label: 'Novedades', desc: 'Ausencias, permisos, horas extra, anticipos', href: '/nomina/novedades' },
    { label: 'Vacaciones', desc: 'Saldo acumulado, días tomados, pendientes', href: '/nomina/vacaciones' },
    { label: 'Liquidaciones', desc: 'Desahucio, despido intempestivo', href: '/nomina/liquidaciones' },
    { label: 'Utilidades', desc: 'Cálculo anual 15%', href: '/nomina/utilidades' },
    { label: 'Parámetros legales', desc: 'SBU, tasas IESS, tabla IR (editable)', href: '/nomina/admin/parametros' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Header */}
      <div style={{ background: '#1a2035', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
              ← Ecosistema
            </button>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'white', letterSpacing: 1 }}>
              MIND<span style={{ color: '#c9a84c' }}>TALENT</span>
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            Nómina Ecuador 2026 — Rol de pagos, provisiones y liquidaciones
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={empresaSeleccionada} onChange={e => setEmpresaSeleccionada(e.target.value)}
            style={{ padding: '.4rem .75rem', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, fontSize: 12, background: 'rgba(255,255,255,0.1)', color: 'white' }}>
            <option value='' style={{ color: '#111' }}>Todas las empresas</option>
            {empresas.map(e => <option key={e.id} value={e.id} style={{ color: '#111' }}>{e.nombre}</option>)}
          </select>
          <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
            style={{ padding: '.4rem .75rem', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, fontSize: 12, background: 'rgba(255,255,255,0.1)', color: 'white' }} />
          <button onClick={() => setNuevaEmpresa(true)}
            style={{ background: '#c9a84c', color: '#1a2035', padding: '.4rem 1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
            + Nueva empresa
          </button>
        </div>
      </div>

      {nuevaEmpresa && (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem 1.5rem 0' }}>
          <div style={{ background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,.08)', border: '1px solid #c9a84c', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a2035' }}>Nueva empresa:</span>
            <input
              value={nombreNuevaEmpresa}
              onChange={e => setNombreNuevaEmpresa(e.target.value)}
              placeholder="Nombre de la empresa"
              style={{ padding: '.4rem .6rem', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', color: '#111', width: 260 }}
            />
            <button onClick={crearEmpresa} disabled={!nombreNuevaEmpresa.trim() || creandoEmpresa}
              style={{ background: '#c9a84c', color: '#1a2035', padding: '.4rem 1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: !nombreNuevaEmpresa.trim() ? 0.5 : 1 }}>
              {creandoEmpresa ? 'Creando…' : 'Crear'}
            </button>
            <button onClick={() => { setNuevaEmpresa(false); setNombreNuevaEmpresa('') }} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}>
              Cancelar
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
            Esta empresa queda disponible en todo el ecosistema (Cultura, Clima, 360°, Manual de Puestos), no solo en Nómina.
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Empleados activos', valor: empleadosCount, color: '#1a2035' },
            { label: 'Roles procesados', valor: `${rolesProcesados} / ${empleadosCount}`, color: '#243447' },
            { label: 'Total líquido a pagar', valor: `$${totales.liquido.toFixed(2)}`, color: '#2d6a4f' },
            { label: 'Costo total empresa', valor: `$${totales.costoEmpresa.toFixed(2)}`, color: '#c9a84c' },
            { label: 'Provisiones acumuladas', valor: `$${totales.provisiones.toFixed(2)}`, color: '#7a6020' },
          ].map(k => (
            <div key={k.label} style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.08)', borderLeft: `4px solid ${k.color}` }}>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{loading ? '…' : k.valor}</div>
            </div>
          ))}
        </div>

        {rolesProcesados > 0 && (
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 24 }}>
            Estado de roles ({periodo}): <b style={{ color: '#7a6020' }}>{conteoEstados.borrador ?? 0} borrador</b> · <b style={{ color: '#1a2035' }}>{conteoEstados.aprobado ?? 0} aprobado</b> · <b style={{ color: '#2d6a4f' }}>{conteoEstados.pagado ?? 0} pagado</b>
          </div>
        )}

        {/* Alertas */}
        {(rolesPendientes > 0 || anticiposPendientesCount > 0 || horasExtraAlerta > 0 || vacacionesVencidas > 0) && (
          <div style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7a6020', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Alertas del periodo {periodo}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#4b3a10', lineHeight: 1.8 }}>
              {rolesPendientes > 0 && <li>{rolesPendientes} empleado(s) sin rol procesado este periodo</li>}
              {anticiposPendientesCount > 0 && <li>{anticiposPendientesCount} anticipo(s) pendiente(s) de aplicar</li>}
              {horasExtraAlerta > 0 && <li>{horasExtraAlerta} registro(s) de horas extra/suplementarias pendientes de aplicar</li>}
              {vacacionesVencidas > 0 && <li>{vacacionesVencidas} empleado(s) con más de 15 días de vacaciones pendientes</li>}
            </ul>
          </div>
        )}

        {/* Navegación a secciones */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {secciones.map(s => (
            <button key={s.href} onClick={() => router.push(s.href)}
              style={{
                textAlign: 'left', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
                padding: '1rem 1.25rem', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.06)',
              }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2035', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{s.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

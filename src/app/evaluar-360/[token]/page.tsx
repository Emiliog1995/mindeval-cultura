"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  COMPETENCIAS_360, POTENCIAL_CRITERIOS, FUENTE_LABELS, ESCALA_INDICADOR, LABEL_SIN_REGISTRO,
  competenciasConLabels,
  type CompetenciaKey, type PotencialKey, type FuenteEvaluacion, type CompetenciaLabels,
} from "@/lib/360-types";
import type { Evaluado360, Token360 } from "@/lib/supabase";

type CompetenciasMap = Record<CompetenciaKey, number>;
type PotencialMap = Record<PotencialKey, number>;

function emptyCompetencias(): CompetenciasMap {
  return Object.fromEntries(COMPETENCIAS_360.map((c) => [c.key, 3])) as CompetenciasMap;
}
function emptyPotencial(): PotencialMap {
  return Object.fromEntries(POTENCIAL_CRITERIOS.map((c) => [c.key, 3])) as PotencialMap;
}

interface IndicadorEsencialForm {
  id: string;
  indicador: string;
  meta: string;
  formula: string | null;
}

// La escala es 1-5 y no arranca en 0: un 1 ya significa "muy por debajo", no
// "no evaluado". Quien llena el formulario tiene que ver esto antes de mover
// la primera barra, o cada evaluador califica con un criterio distinto.
const ESCALA_COMPETENCIA = [
  { valor: 5, label: "Siempre lo demuestra. Es un referente para los demás." },
  { valor: 4, label: "Casi siempre. Por encima de lo que el puesto espera." },
  { valor: 3, label: "Generalmente. Cumple con lo que el puesto espera." },
  { valor: 2, label: "A veces. Por debajo de lo esperado." },
  { valor: 1, label: "Rara vez o nunca. Muy por debajo de lo esperado." },
];


/**
 * Modo demostración: /evaluar-360/demo
 *
 * Existe para poder mostrarle el formulario a la organización antes de
 * lanzar el proceso — en una reunión, proyectado — sin gastar un enlace real
 * ni ensuciar los resultados. Es la MISMA pantalla que verán los evaluadores,
 * no una maqueta aparte: si se hace un cambio en el formulario, la demo lo
 * refleja sola. Nada de lo que se haga aquí llega a la base de datos.
 *
 * El token real es un UUID, así que la palabra "demo" nunca colisiona con uno.
 */
const TOKEN_DEMO = "demo";

const EVALUADO_DEMO: Evaluado360 = {
  id: "demo",
  nombre: "MARÍA EJEMPLO PÉREZ",
  cargo: "Especialista de Correspondencia",
  departamento: "Subproyecto y comunidades",
} as Evaluado360;

const INDICADORES_DEMO: IndicadorEsencialForm[] = [
  { id: "demo-1", indicador: "Cumplimiento de plazos de envío de correspondencia", meta: "≥ 90%", formula: "(Envíos a tiempo / Total de envíos) x 100" },
  { id: "demo-2", indicador: "Cartas respondidas dentro del período", meta: "100% en plazo", formula: "(Cartas respondidas / Cartas recibidas) x 100" },
  { id: "demo-3", indicador: "Visitas de seguimiento realizadas", meta: "≥ 12 por trimestre", formula: "Número de visitas efectivas" },
];

export default function EvaluarToken360() {
  const { token } = useParams<{ token: string }>();
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<{ token: Token360; evaluado: Evaluado360 } | null>(null);
  const [indicadoresEsenciales, setIndicadoresEsenciales] = useState<IndicadorEsencialForm[]>([]);

  const [competencias, setCompetencias] = useState<CompetenciasMap>(emptyCompetencias());
  const [potencial, setPotencial] = useState<PotencialMap>(emptyPotencial());
  const [calificacionesIndicadores, setCalificacionesIndicadores] = useState<Record<string, number>>({});
  // Indicadores que el jefe declaró sin registro: no se califican, se reportan.
  const [sinRegistro, setSinRegistro] = useState<Set<string>>(new Set());
  const [necesidades, setNecesidades] = useState("");
  const [competenciaLabels, setCompetenciaLabels] = useState<CompetenciaLabels | null>(null);
  const [tocados, setTocados] = useState<Set<string>>(new Set());
  const esDemo = token === TOKEN_DEMO;
  const competencias360 = competenciasConLabels(competenciaLabels);
  const [demoFuente, setDemoFuente] = useState<FuenteEvaluacion>("par");

  useEffect(() => {
    if (esDemo) {
      // Sin ?empresa= la demo no hace ni una petición. Con el parámetro pide
      // solo los nombres de las competencias, para que al mostrársela a la
      // organización aparezcan como ellos las llaman.
      const empresaDemo = new URLSearchParams(window.location.search).get("empresa");
      if (empresaDemo) {
        fetch(`/api/360-competencias?empresa_id=${encodeURIComponent(empresaDemo)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => setCompetenciaLabels(j?.competenciaLabels ?? null))
          .catch(() => {});
      }
      // El resto se arma en el cliente: nunca toca la base ni consume un token.
      setData({
        token: { fuente: demoFuente, completado: false } as Token360,
        evaluado: EVALUADO_DEMO,
      });
      setIndicadoresEsenciales(demoFuente === "jefe" ? INDICADORES_DEMO : []);
      setCalificacionesIndicadores(Object.fromEntries(INDICADORES_DEMO.map((i) => [i.id, 3])));
      setSinRegistro(new Set());
      setNecesidades("");
      setCompetencias(emptyCompetencias());
      setPotencial(emptyPotencial());
      setTocados(new Set());
      setEnviado(false);
      setError("");
      setCargando(false);
      return;
    }
    fetch(`/api/token/360/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? "Este link no es válido o ya no está disponible.");
        }
        return r.json() as Promise<{
          token: Token360;
          evaluado: Evaluado360;
          indicadoresEsenciales: IndicadorEsencialForm[];
          competenciaLabels: CompetenciaLabels | null;
        }>;
      })
      .then((res) => {
        if (res.token.completado) {
          setEnviado(true);
        } else {
          setData(res);
          setCompetenciaLabels(res.competenciaLabels ?? null);
          setIndicadoresEsenciales(res.indicadoresEsenciales ?? []);
          setCalificacionesIndicadores(
            Object.fromEntries((res.indicadoresEsenciales ?? []).map((i) => [i.id, 3])),
          );
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setCargando(false));
  }, [token, esDemo, demoFuente]);

  function marcarTocado(clave: string) {
    setTocados((prev) => {
      if (prev.has(clave)) return prev;
      const next = new Set(prev);
      next.add(clave);
      return next;
    });
  }

  function setComp(key: CompetenciaKey, val: number) {
    setCompetencias((prev) => ({ ...prev, [key]: val }));
    marcarTocado(`comp:${key}`);
  }
  function setPot(key: PotencialKey, val: number) {
    setPotencial((prev) => ({ ...prev, [key]: val }));
    marcarTocado(`pot:${key}`);
  }
  function alternarSinRegistro(id: string) {
    setSinRegistro((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    marcarTocado(`ind:${id}`);
  }

  function setIndicador(id: string, val: number) {
    setCalificacionesIndicadores((prev) => ({ ...prev, [id]: val }));
    marcarTocado(`ind:${id}`);
  }

  function camposFaltantes(): string[] {
    if (!data) return [];
    const esJefe = data.token.fuente === "jefe";
    const faltan: string[] = [];

    for (const c of COMPETENCIAS_360) {
      if (!tocados.has(`comp:${c.key}`)) faltan.push(c.label);
    }
    if (esJefe) {
      for (const p of POTENCIAL_CRITERIOS) {
        if (!tocados.has(`pot:${p.key}`)) faltan.push(p.label);
      }
      for (const ind of indicadoresEsenciales) {
        if (!tocados.has(`ind:${ind.id}`)) faltan.push(ind.indicador);
      }
    }
    return faltan;
  }

  async function handleEnviar() {
    if (!data) return;
    const faltan = camposFaltantes();
    if (faltan.length > 0) {
      setError(`Falta calificar: ${faltan.join(", ")}.`);
      return;
    }
    if (esDemo) {
      // Se muestra la misma pantalla de agradecimiento, sin escribir nada.
      setEnviado(true);
      return;
    }
    setEnviando(true);
    setError("");
    try {
      const esJefe = data.token.fuente === "jefe";
      const res = await fetch(`/api/token/360/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competencias,
          potencial: esJefe ? potencial : undefined,
          indicadoresResultado: esJefe
            ? indicadoresEsenciales.map((ind) => ({
                indicador_puesto_id: ind.id,
                calificacion: sinRegistro.has(ind.id) ? null : calificacionesIndicadores[ind.id] ?? 3,
                sin_registro: sinRegistro.has(ind.id),
              }))
            : undefined,
          necesidades: data.token.fuente === "autoevaluacion" ? necesidades : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Error al enviar");
      }
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A1A32" }}>
        <p className="text-gray-400 text-sm">Cargando…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#0A1A32" }}>
        <div className="bg-[#1e2a42] rounded-xl p-6 border border-red-500/40 max-w-md text-center">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const bandaDemo = esDemo ? (
    <div style={{ background: "#fef3c7", borderBottom: "2px solid #f59e0b" }} className="px-6 py-3">
      <div className="max-w-2xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-bold" style={{ color: "#92400e" }}>
          MODO DEMOSTRACIÓN · nada de lo que hagas aquí se guarda
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[11px]" style={{ color: "#92400e" }}>Ver como:</span>
          {(["autoevaluacion", "par", "jefe"] as FuenteEvaluacion[]).map((f) => (
            <button
              key={f}
              onClick={() => setDemoFuente(f)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={
                demoFuente === f
                  ? { background: "#92400e", color: "#fef3c7" }
                  : { background: "#fde68a", color: "#92400e" }
              }
            >
              {f === "jefe" ? "Jefe directo" : f === "autoevaluacion" ? "Autoevaluación" : "Par / Colaborador / Cliente interno"}
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  if (enviado) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#0A1A32" }}>
        {bandaDemo}
        <div className="flex items-center justify-center px-4 py-24">
          <div className="bg-[#1e2a42] rounded-xl p-8 border border-[#2d3a50] max-w-md text-center space-y-3">
            <div className="text-4xl">✅</div>
            <h1 className="text-white font-bold text-lg">¡Gracias por tu evaluación!</h1>
            <p className="text-gray-400 text-sm">
              {esDemo
                ? "Así se ve al terminar. Como esto es una demostración, no se guardó nada."
                : "Tu respuesta fue enviada correctamente."}
            </p>
            {esDemo && (
              <button
                onClick={() => { setEnviado(false); setTocados(new Set()); }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "#10b981", color: "#0A1A32" }}
              >
                Volver a la demostración
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A1A32" }}>
      {bandaDemo}
      <div className="border-b border-[#2d3a50] px-6 py-4">
        <h1 className="text-lg font-bold text-white">Evaluación 360°</h1>
        <p className="text-sm text-gray-400">
          Estás evaluando a <span className="text-[#10b981] font-semibold">{data.evaluado.nombre}</span> como{" "}
          <span className="font-semibold">{FUENTE_LABELS[data.token.fuente]}</span>
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <div className="rounded-xl border border-[#10b981]/40 bg-[#10b981]/[0.07] p-4 space-y-3">
          <h2 className="text-sm font-bold text-white">Cómo llenar esta evaluación</h2>

          <p className="text-xs text-gray-300 leading-relaxed">
            Calificas <strong className="text-white">del 1 al 5</strong> (no hay 0). Puedes usar decimales:
            si dudas entre 3 y 4, deja la barra en 3.5.
          </p>

          <div className="space-y-1 pt-1">
            {ESCALA_COMPETENCIA.map((op) => (
              <div key={op.valor} className="flex items-start gap-2.5">
                <span
                  className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                  style={{ background: "#10b981", color: "#0A1A32" }}
                >
                  {op.valor}
                </span>
                <span className="text-[11px] text-gray-300 leading-6">{op.label}</span>
              </div>
            ))}
          </div>

          {data.token.fuente === "jefe" && (
            <div className="pt-2 mt-1 border-t border-[#10b981]/25 space-y-2">
              <p className="text-xs font-bold text-white">Como jefe directo tienes dos secciones más</p>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                <strong className="text-white">Potencial:</strong> solo lo califica el jefe. No mide lo que la
                persona ya hace bien, sino hasta dónde podría llegar. Se usa la misma escala del 1 al 5.
              </p>
              {indicadoresEsenciales.length > 0 && (
                <>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    <strong className="text-white">Indicadores de gestión:</strong> son los del Manual de Puestos,
                    con la meta que se fijó para cada uno. Aquí no calificas cómo se comportó la persona sino
                    <strong className="text-white"> cuánto cumplió esa meta</strong> en el período. Si de alguno
                    no se lleva registro, puedes marcarlo como tal en vez de calificarlo al tanteo:
                  </p>
                  <div className="space-y-1">
                    {ESCALA_INDICADOR.map((op) => (
                      <div key={op.valor} className="flex items-start gap-2.5">
                        <span
                          className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                          style={{ background: "#2dd4bf", color: "#0A1A32" }}
                        >
                          {op.valor}
                        </span>
                        <span className="text-[11px] text-gray-300 leading-6">{op.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <p className="text-[11px] text-gray-400 leading-relaxed pt-1 border-t border-[#10b981]/25">
            El punto <span className="text-amber-400">●</span> marca lo que todavía no calificaste. No podés enviar
            hasta que no quede ninguno: mueve cada barra aunque quieras dejarla donde está.
            Se responde una sola vez y tus respuestas se consolidan con las del resto de evaluadores.
          </p>
        </div>

        <div className="bg-[#1e2a42] rounded-xl border border-[#2d3a50] p-4 space-y-3">
          <p className="text-xs text-gray-500">Competencias (1.0 – 5.0)</p>
          {competencias360.map((comp) => (
            <div key={comp.key} className="flex items-center gap-3">
              <span className="text-xs text-gray-300 w-40 shrink-0 flex items-center gap-1">
                {comp.label}
                {!tocados.has(`comp:${comp.key}`) && <span className="text-amber-400" title="Sin calificar">●</span>}
              </span>
              <input
                type="range" min={1} max={5} step={0.1}
                value={competencias[comp.key]}
                onChange={(e) => setComp(comp.key, parseFloat(e.target.value))}
                className="flex-1 accent-[#2dd4bf]"
              />
              <span className="text-[#2dd4bf] text-sm font-bold w-10 text-right">
                {competencias[comp.key].toFixed(1)}
              </span>
            </div>
          ))}
        </div>

        {data.token.fuente === "jefe" && (
          <div className="bg-[#1e2a42] rounded-xl border border-[#2d3a50] p-4 space-y-3">
            <p className="text-xs text-gray-500">Potencial (1.0 – 5.0)</p>
            {POTENCIAL_CRITERIOS.map((crit) => (
              <div key={crit.key} className="flex items-center gap-3">
                <span className="text-xs text-gray-300 w-40 shrink-0 flex items-center gap-1">
                  {crit.label}
                  {!tocados.has(`pot:${crit.key}`) && <span className="text-amber-400" title="Sin calificar">●</span>}
                </span>
                <input
                  type="range" min={1} max={5} step={0.1}
                  value={potencial[crit.key]}
                  onChange={(e) => setPot(crit.key, parseFloat(e.target.value))}
                  className="flex-1 accent-[#10b981]"
                />
                <span className="text-[#10b981] text-sm font-bold w-10 text-right">
                  {potencial[crit.key].toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}

        {data.token.fuente === "jefe" && indicadoresEsenciales.length > 0 && (
          <div className="bg-[#1e2a42] rounded-xl border border-[#2d3a50] p-4 space-y-4">
            <div>
              <p className="text-xs text-gray-500">Cumplimiento de indicadores esenciales</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                ¿Qué tan cumplida está la meta de cada indicador de este período?
              </p>
              <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "#fbbf24" }}>
                Si de algún indicador no se lleva registro y no tienes el dato, márcalo abajo en vez
                de calificarlo al tanteo. No cuenta en contra de la persona, y saber qué no se está
                midiendo es parte de lo que busca esta evaluación.
              </p>
            </div>
            {indicadoresEsenciales.map((ind) => {
              const marcadoSinRegistro = sinRegistro.has(ind.id);
              return (
                <div key={ind.id} className="space-y-1.5">
                  <p className="text-xs text-gray-300 flex items-center gap-1">
                    {ind.indicador}
                    {!tocados.has(`ind:${ind.id}`) && <span className="text-amber-400" title="Sin calificar">●</span>}
                  </p>
                  {ind.formula && (
                    <p className="text-[10px] text-gray-500">Fórmula: {ind.formula}</p>
                  )}
                  <p className="text-[10px] text-gray-500">Meta: {ind.meta}</p>
                  <select
                    value={calificacionesIndicadores[ind.id] ?? 3}
                    onChange={(e) => setIndicador(ind.id, parseInt(e.target.value, 10))}
                    disabled={marcadoSinRegistro}
                    className="w-full bg-[#0A1A32] border border-[#2d3a50] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#10b981] disabled:opacity-40"
                  >
                    {ESCALA_INDICADOR.map((op) => (
                      <option key={op.valor} value={op.valor}>{op.valor} — {op.label}</option>
                    ))}
                  </select>
                  <label className="flex items-start gap-2 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={marcadoSinRegistro}
                      onChange={() => alternarSinRegistro(ind.id)}
                      className="mt-0.5 accent-[#f59e0b]"
                    />
                    <span className="text-[11px] leading-snug" style={{ color: marcadoSinRegistro ? "#fbbf24" : "#9ca3af" }}>
                      {LABEL_SIN_REGISTRO}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        )}

        {data.token.fuente === "autoevaluacion" && (
          <div className="bg-[#1e2a42] rounded-xl border border-[#2d3a50] p-4 space-y-2">
            <div>
              <p className="text-xs text-gray-500">¿Qué necesitas para hacer mejor tu trabajo?</p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                Capacitaciones que te servirían, materiales o herramientas que te faltan, apoyo que
                necesitas de otra área. Lo lee Talento Humano y se toma en cuenta para tu plan de
                desarrollo. Puedes dejarlo en blanco si no tienes nada que pedir.
              </p>
            </div>
            <textarea
              id="necesidades-360"
              value={necesidades}
              onChange={(e) => setNecesidades(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Por ejemplo: un curso de Excel para llevar mejor los reportes, o una capacitación en atención a familias."
              className="w-full bg-[#0A1A32] border border-[#2d3a50] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#10b981]"
            />
            <p className="text-[10px] text-gray-600 text-right">{necesidades.length} / 2000</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
        )}

        <button
          onClick={handleEnviar}
          disabled={enviando}
          className="w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-60"
          style={{ backgroundColor: "#10b981", color: "#0A1A32" }}
        >
          {enviando ? "Enviando…" : "Enviar evaluación"}
        </button>
      </div>
    </div>
  );
}

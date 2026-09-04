"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";
import {
  listarEvaluaciones, listarClima, eliminarEvaluacion, eliminarClima, listarSesiones, crearSesion, eliminarSesion,
  crear360Evaluado, crearTokens360, listarEmpresas, listarPersonasConPuestoPorEmpresa, calcularFuentesAplicables,
  type Evaluacion, type ClimaRespuesta, type Sesion, type Evaluado360, type Token360, type Empresa, type PersonaConPuesto,
} from "@/lib/supabase";
import { FUENTE_LABELS, type FuenteEvaluacion } from "@/lib/360-types";
import { derivarDestinatarios, type DestinatarioSugerido, type MapaJefaturas, type SugerenciaDestinatarios } from "@/lib/360-organigrama";
import { authHeaders } from "@/lib/auth-headers";
import { getLevelColor } from "@/lib/scoring";
import { useAuthGuard, cerrarSesion } from "@/lib/useAuthGuard";
import type { ScoringResult } from "@/lib/scoring";
import { CLIMA_DIMENSIONS, type ClimaDimension } from "@/lib/clima-items";
import { getClimaLevelColor, type ClimaResult } from "@/lib/clima-scoring";
import SaludOrganizacionalTab from "@/components/SaludOrganizacionalTab";
import RadarRiesgoTab from "@/components/RadarRiesgoTab";
import Eval360DashboardPreview from "@/components/360/Eval360DashboardPreview";
import PeriodoSelect from "@/components/360/PeriodoSelect";

type Tab = "docs" | "clima" | "salud" | "alertas" | "sesiones" | "eval360";
const TABS_VALIDOS: Tab[] = ["docs", "clima", "salud", "alertas", "sesiones", "eval360"];

const CLIMA_DIM_CODES: ClimaDimension[] = ["A", "B", "C", "D", "E", "F"];

export default function Dashboard() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verificando } = useAuthGuard();

  // ─── Tab ─────────────────────────────────────────────────────────────────
  const tabInicial = TABS_VALIDOS.includes(searchParams.get("tab") as Tab) ? (searchParams.get("tab") as Tab) : "docs";
  const [activeTab, setActiveTab] = useState<Tab>(tabInicial);

  // ─── DOCS ────────────────────────────────────────────────────────────────
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [filtroArea, setFiltroArea]     = useState("");
  const [filtroCargo, setFiltroCargo]   = useState("");
  const [cargando, setCargando]         = useState(true);
  const [error, setError]               = useState("");

  // ─── Empresas (para el selector del panel de clientes) ────────────────────
  const [empresas, setEmpresas]   = useState<Empresa[]>([]);

  // ─── Sesiones ────────────────────────────────────────────────────────────
  const [sesiones, setSesiones]               = useState<Sesion[]>([]);
  const [nuevaTipo, setNuevaTipo]             = useState<'cultura' | 'clima' | '360'>("cultura");
  const [nuevaEmpresaId, setNuevaEmpresaId]   = useState(searchParams.get("empresa") ?? "");
  const [creandoSesion, setCreandoSesion]     = useState(false);
  const [linkCopiado, setLinkCopiado]         = useState<string | null>(null);

  const nombreEmpresaSeleccionada = empresas.find((e) => e.id === nuevaEmpresaId)?.nombre;

  // ─── 360° (generación de links desde el dashboard) ─────────────────────
  const [modo360, setModo360] = useState<'individual' | 'masivo'>("individual");
  const [datos360, setDatos360] = useState({ nombre: "", cargo: "", departamento: "", jefe: "", periodo: "", puestoId: "" });
  const [personasEmpresa, setPersonasEmpresa] = useState<PersonaConPuesto[]>([]);
  const [personaId, setPersonaId] = useState("");
  const FUENTES_FIJAS: FuenteEvaluacion[] = ["autoevaluacion", "jefe", "par", "colaborador", "cliente_interno"];
  const [fuentesAplicables, setFuentesAplicables] = useState<FuenteEvaluacion[]>(FUENTES_FIJAS);
  const [textoMasivo360, setTextoMasivo360] = useState("");
  // Línea de mando resuelta por IA sobre el organigrama en texto libre del
  // Manual. Se pide una sola vez por empresa: de ahí salen jefe, pares y
  // colaboradores de cualquier evaluado de esa nómina.
  const [mapaJefaturas, setMapaJefaturas] = useState<MapaJefaturas | null>(null);
  const [cargandoOrganigrama, setCargandoOrganigrama] = useState(false);
  const [errorOrganigrama, setErrorOrganigrama] = useState("");
  const [sugerencia, setSugerencia] = useState<SugerenciaDestinatarios | null>(null);
  // Nadie recibe un enlace sin que la consultora lo haya dejado marcado.
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [nuevoDestinatario, setNuevoDestinatario] = useState<{ fuente: FuenteEvaluacion; personaId: string }>({ fuente: "par", personaId: "" });
  const [evaluados360, setEvaluados360] = useState<Array<{ evaluado: Evaluado360; empresa?: string; links: Array<{ fuente: FuenteEvaluacion; url: string; destinatario?: { nombre: string; email: string | null } }> }>>([]);
  const [expandido360, setExpandido360] = useState<string | null>(null);
  const [error360, setError360] = useState("");
  const [progresoMasivo360, setProgresoMasivo360] = useState<{ total: number; hecho: number } | null>(null);

  // ─── Clima ───────────────────────────────────────────────────────────────
  const [climaData, setClimaData]         = useState<ClimaRespuesta[]>([]);
  const [cargandoClima, setCargandoClima] = useState(true);
  const [errorClima, setErrorClima]       = useState("");

  useEffect(() => {
    if (verificando) return;

    listarEvaluaciones()
      .then(setEvaluaciones)
      .catch(() => setError("No se pudieron cargar las evaluaciones. Verifica las credenciales de Supabase."))
      .finally(() => setCargando(false));

    listarClima()
      .then(setClimaData)
      .catch(() => setErrorClima("No se pudieron cargar los datos de clima."))
      .finally(() => setCargandoClima(false));

    listarSesiones().then(setSesiones).catch(() => {});
    listarEmpresas().then(setEmpresas).catch(() => {});
  }, [verificando]);

  useEffect(() => {
    setPersonaId("");
    setFuentesAplicables(FUENTES_FIJAS);
    // El organigrama es de la empresa: al cambiar de cliente se descarta el
    // anterior para no proponer destinatarios de otra nómina.
    setMapaJefaturas(null);
    setSugerencia(null);
    setSeleccionados(new Set());
    setErrorOrganigrama("");
    if (!nuevaEmpresaId) {
      setPersonasEmpresa([]);
      return;
    }
    listarPersonasConPuestoPorEmpresa(nuevaEmpresaId).then(setPersonasEmpresa).catch(() => setPersonasEmpresa([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuevaEmpresaId]);

  // La resolución tarda ~40s, así que se dispara apenas hay empresa y modo 360:
  // corre mientras se llena el formulario y suele estar lista al momento de
  // elegir a la persona, en vez de hacer esperar con el formulario ya completo.
  useEffect(() => {
    if (nuevaTipo !== "360" || !nuevaEmpresaId || personasEmpresa.length === 0) return;
    if (mapaJefaturas || cargandoOrganigrama || errorOrganigrama) return;
    cargarOrganigrama(nuevaEmpresaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuevaTipo, nuevaEmpresaId, personasEmpresa]);

  /** Resuelve la línea de mando de la empresa (una llamada, se reutiliza). */
  async function cargarOrganigrama(empresaId: string): Promise<MapaJefaturas | null> {
    if (mapaJefaturas) return mapaJefaturas;
    setCargandoOrganigrama(true);
    setErrorOrganigrama("");
    try {
      const res = await fetch("/api/360-organigrama", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ empresa_id: empresaId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo resolver el organigrama");
      const mapa = json as MapaJefaturas;
      setMapaJefaturas(mapa);
      return mapa;
    } catch (e) {
      setErrorOrganigrama(
        e instanceof Error ? e.message : "No se pudo resolver el organigrama. Asigna los destinatarios a mano.",
      );
      return null;
    } finally {
      setCargandoOrganigrama(false);
    }
  }

  /** Marca por defecto solo lo inequívoco; lo dudoso queda visible sin marcar. */
  function preseleccionAlta(propuesta: SugerenciaDestinatarios): Set<string> {
    return new Set(
      Object.entries(propuesta.destinatarios).flatMap(([fuente, lista]) =>
        (lista ?? []).filter((d) => d.confianza === "alta").map((d) => `${fuente}:${d.persona_id}`),
      ),
    );
  }

  /** Un envío por destinatario marcado. Puro: no depende del estado de React. */
  function enviosDe(
    propuesta: SugerenciaDestinatarios | null,
    marcados: Set<string>,
  ): Array<{ fuente: FuenteEvaluacion; destinatario: DestinatarioSugerido }> {
    if (!propuesta) return [];
    return Object.entries(propuesta.destinatarios).flatMap(([fuente, lista]) =>
      (lista ?? [])
        .filter((d) => marcados.has(`${fuente}:${d.persona_id}`))
        .map((d) => ({ fuente: fuente as FuenteEvaluacion, destinatario: d })),
    );
  }

  async function resolverSugerenciaPara(id: string): Promise<SugerenciaDestinatarios | null> {
    if (!nuevaEmpresaId) return null;
    const mapa = await cargarOrganigrama(nuevaEmpresaId);
    if (!mapa) return null;
    const propuesta = derivarDestinatarios(id, personasEmpresa, mapa);
    setSugerencia(propuesta);
    setSeleccionados(preseleccionAlta(propuesta));
    return propuesta;
  }

  async function handleSeleccionarPersona(id: string) {
    setPersonaId(id);
    setSugerencia(null);
    setSeleccionados(new Set());
    if (id === "" || id === "manual") {
      setDatos360((prev) => ({ ...prev, nombre: "", cargo: "", departamento: "", jefe: "", puestoId: "" }));
      setFuentesAplicables(FUENTES_FIJAS);
      return;
    }
    const p = personasEmpresa.find((x) => x.id === id);
    if (!p) return;
    setDatos360((prev) => ({
      ...prev,
      nombre: p.nombre,
      cargo: p.cargo ?? "",
      departamento: p.departamento ?? "",
      jefe: p.jefe ?? "",
      puestoId: p.puesto_id ?? "",
    }));
    setFuentesAplicables(calcularFuentesAplicables(p, personasEmpresa));

    await resolverSugerenciaPara(id);
  }

  function alternarDestinatario(fuente: FuenteEvaluacion, personaIdDestino: string) {
    const clave = `${fuente}:${personaIdDestino}`;
    setSeleccionados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  /**
   * Agrega a mano un destinatario que la derivación no propuso.
   *
   * El puesto no siempre alcanza para decidir quién es par: en Fundación
   * Unbound la Analista Contable y la Asistente Contable tienen cargos
   * distintos pero se evalúan entre sí como pares. En vez de escribir esa
   * excepción en el código -- que solo sirve para ese cliente -- la consultora
   * la agrega acá y queda marcada como decisión suya, no de la IA.
   */
  function agregarDestinatarioManual() {
    const { fuente, personaId: idNuevo } = nuevoDestinatario;
    if (!sugerencia || !idNuevo) return;
    const p = personasEmpresa.find((x) => x.id === idNuevo);
    if (!p) return;
    const agregado: DestinatarioSugerido = {
      persona_id: p.id,
      nombre: p.nombre,
      email: p.email,
      confianza: "media",
      motivo: "Agregado a mano por la consultora.",
    };
    setSugerencia((prev) =>
      prev
        ? {
            ...prev,
            destinatarios: { ...prev.destinatarios, [fuente]: [...(prev.destinatarios[fuente] ?? []), agregado] },
            sin_resolver: prev.sin_resolver.filter((x) => x.fuente !== fuente),
          }
        : prev,
    );
    setSeleccionados((prev) => new Set(prev).add(`${fuente}:${p.id}`));
    setNuevoDestinatario((prev) => ({ ...prev, personaId: "" }));
  }

  /** Nadie puede ocupar dos roles frente al mismo evaluado, ni evaluarse a sí mismo. */
  function personasDisponiblesParaAgregar(): PersonaConPuesto[] {
    if (!sugerencia) return [];
    const yaConRol = new Set(
      Object.values(sugerencia.destinatarios).flatMap((l) => (l ?? []).map((d) => d.persona_id)),
    );
    return personasEmpresa.filter((p) => p.id !== personaId && !yaConRol.has(p.id));
  }

  function enviosSeleccionados() {
    return enviosDe(sugerencia, seleccionados);
  }

  async function handleCrearSesion() {
    if (nuevaTipo === "360") return handleGenerar360();
    setCreandoSesion(true);
    try {
      const s = await crearSesion({ tipo: nuevaTipo, empresa: nombreEmpresaSeleccionada, empresa_id: nuevaEmpresaId || undefined });
      setSesiones((prev) => [s, ...prev]);
    } finally {
      setCreandoSesion(false);
    }
  }

  async function handleGenerar360() {
    if (!datos360.nombre || !datos360.cargo || !datos360.departamento || !datos360.periodo) {
      setError360("Completa nombre, cargo, departamento y período.");
      return;
    }
    setError360("");
    setCreandoSesion(true);
    try {
      const evaluado = await crear360Evaluado({
        nombre: datos360.nombre,
        cargo: datos360.cargo,
        departamento: datos360.departamento,
        empresa: nombreEmpresaSeleccionada,
        empresa_id: nuevaEmpresaId || undefined,
        puesto_id: datos360.puestoId || undefined,
        persona_id: personaId && personaId !== "manual" ? personaId : undefined,
        jefe: datos360.jefe || undefined,
      });
      // Un enlace por evaluador marcado, no uno por fuente: si el evaluado tiene
      // cuatro pares, cada uno necesita su propio token porque el formulario se
      // cierra al responderse.
      //
      // Resolver el organigrama tarda ~40s, y quien completa el formulario rápido
      // llega hasta acá antes de que termine. Si en ese caso cayéramos al
      // fallback, se generarían enlaces sin destinatario sin avisar -- que es
      // justo lo que el matching viene a evitar. Así que se espera la propuesta
      // pendiente en vez de darla por inexistente.
      const esDeLaNomina = personaId !== "" && personaId !== "manual";
      let propuesta = sugerencia;
      let marcados = seleccionados;
      if (esDeLaNomina && !propuesta && !errorOrganigrama) {
        propuesta = await resolverSugerenciaPara(personaId);
        if (propuesta) marcados = preseleccionAlta(propuesta);
      }

      const envios = enviosDe(propuesta, marcados);
      // Con propuesta pero sin nadie marcado es un descuido, no una intención.
      if (propuesta && envios.length === 0) {
        setError360("Marca al menos a una persona en la lista de destinatarios.");
        return;
      }
      // Sin nómina detrás (alta manual, o si falló la IA) se cae al
      // comportamiento anterior: un enlace por fuente aplicable.
      const fuentes = envios.length > 0 ? envios.map((e) => e.fuente) : fuentesAplicables;
      const tokens: Token360[] = await crearTokens360(evaluado.id, datos360.periodo, fuentes);
      const base = typeof window !== "undefined" ? window.location.origin : "";

      // Se emparejan token y destinatario dentro de cada fuente, sin depender
      // del orden en que la base devolvió las filas.
      const porFuente = new Map<FuenteEvaluacion, DestinatarioSugerido[]>();
      for (const e of envios) {
        const lista = porFuente.get(e.fuente) ?? [];
        lista.push(e.destinatario);
        porFuente.set(e.fuente, lista);
      }
      const links = tokens.map((t) => ({
        fuente: t.fuente,
        url: `${base}/evaluar-360/${t.token}`,
        destinatario: porFuente.get(t.fuente)?.shift(),
      }));

      setEvaluados360((prev) => [{ evaluado, empresa: nombreEmpresaSeleccionada, links }, ...prev]);
      setExpandido360(evaluado.id);
      setDatos360({ nombre: "", cargo: "", departamento: "", jefe: "", periodo: "", puestoId: "" });
      setPersonaId("");
      setFuentesAplicables(FUENTES_FIJAS);
      setSugerencia(null);
      setSeleccionados(new Set());
    } catch (e) {
      setError360(e instanceof Error ? e.message : "Error al generar los links de evaluación 360°");
    } finally {
      setCreandoSesion(false);
    }
  }

  function copiarLink360(url: string) {
    navigator.clipboard.writeText(url);
    setLinkCopiado(url);
    setTimeout(() => setLinkCopiado(null), 2000);
  }

  async function handleGenerarMasivo360() {
    if (!datos360.periodo.trim()) {
      setError360("Indica el período antes de cargar la lista.");
      return;
    }
    const filas = textoMasivo360
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(",").map((c) => c.trim()));

    const invalidas = filas.filter((f) => f.length < 3 || !f[0] || !f[1] || !f[2]);
    if (filas.length === 0) {
      setError360("Pega al menos una línea con: Nombre, Cargo, Departamento.");
      return;
    }
    if (invalidas.length > 0) {
      setError360(`Hay ${invalidas.length} línea(s) sin nombre, cargo o departamento. Revisa el formato.`);
      return;
    }

    setError360("");
    setCreandoSesion(true);
    setProgresoMasivo360({ total: filas.length, hecho: 0 });
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const nuevos: typeof evaluados360 = [];
    const fuentes: FuenteEvaluacion[] = ["autoevaluacion", "jefe", "par", "colaborador", "cliente_interno"];

    try {
      for (const [nombre, cargo, departamento, jefe] of filas) {
        const evaluado = await crear360Evaluado({ nombre, cargo, departamento, empresa: nombreEmpresaSeleccionada, empresa_id: nuevaEmpresaId || undefined, jefe: jefe || undefined });
        const tokens: Token360[] = await crearTokens360(evaluado.id, datos360.periodo, fuentes);
        const links = tokens.map((t) => ({ fuente: t.fuente, url: `${base}/evaluar-360/${t.token}` }));
        nuevos.push({ evaluado, empresa: nombreEmpresaSeleccionada, links });
        setProgresoMasivo360((p) => p ? { ...p, hecho: p.hecho + 1 } : p);
      }
      setEvaluados360((prev) => [...nuevos, ...prev]);
      setTextoMasivo360("");
    } catch (e) {
      setError360(e instanceof Error ? e.message : "Error durante la carga masiva. Algunos registros pueden haberse creado.");
    } finally {
      setCreandoSesion(false);
      setProgresoMasivo360(null);
    }
  }

  async function exportarLinks360Excel() {
    const { utils, writeFile } = await import("xlsx");
    const filas = evaluados360.flatMap(({ evaluado, empresa, links }) =>
      links.map((l) => ({
        Empresa: empresa ?? "",
        Nombre: evaluado.nombre,
        Cargo: evaluado.cargo,
        Departamento: evaluado.departamento,
        Fuente: FUENTE_LABELS[l.fuente],
        "Enviar a": l.destinatario?.nombre ?? "",
        "Correo": l.destinatario?.email ?? "",
        Link: l.url,
      }))
    );
    const ws = utils.json_to_sheet(filas);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Links 360");
    writeFile(wb, `Links_360_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function handleEliminarSesion(id: string) {
    await eliminarSesion(id);
    setSesiones((prev) => prev.filter((s) => s.id !== id));
  }

  function getLinkSesion(s: Sesion) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/eval?id=${s.id}`;
  }

  function copiarLink(s: Sesion) {
    navigator.clipboard.writeText(getLinkSesion(s));
    setLinkCopiado(s.id);
    setTimeout(() => setLinkCopiado(null), 2000);
  }

  // ─── DOCS helpers ────────────────────────────────────────────────────────
  const evaluacionesEmpresa = nuevaEmpresaId ? evaluaciones.filter((e) => e.empresa_id === nuevaEmpresaId) : evaluaciones;
  const areas  = [...new Set(evaluacionesEmpresa.map((e) => e.area).filter(Boolean))].sort();
  const cargos = [...new Set(evaluacionesEmpresa.map((e) => e.cargo).filter(Boolean))].sort();

  const filtradas = evaluacionesEmpresa.filter((e) => {
    if (filtroArea  && e.area  !== filtroArea)  return false;
    if (filtroCargo && e.cargo !== filtroCargo) return false;
    return true;
  });

  function promedioOrg() {
    if (!filtradas.length) return null;
    const dims = ["I", "II", "III", "IV"] as const;
    return dims.map((dim) => {
      const valores = filtradas.map((e) => {
        const s = e.scores as ScoringResult;
        return s.dimensions.find((d) => d.code === dim)?.mean ?? 0;
      });
      const mean = valores.reduce((a, b) => a + b, 0) / valores.length;
      return {
        subject: { I: "Implicación", II: "Consistencia", III: "Adaptabilidad", IV: "Misión" }[dim],
        value: parseFloat(mean.toFixed(2)),
      };
    });
  }

  const globalProm = filtradas.length
    ? (filtradas.reduce((a, e) => a + (e.score_global ?? 0), 0) / filtradas.length).toFixed(2)
    : "-";

  async function exportarExcel() {
    const { utils, writeFile } = await import("xlsx");
    const filas = filtradas.map((e) => {
      const s = e.scores as ScoringResult;
      const row: Record<string, string | number> = {
        ID: e.id,
        Fecha: new Date(e.created_at).toLocaleDateString("es-EC"),
        Nombre: e.nombre,
        Cargo: e.cargo,
        "Área": e.area,
        Empresa: e.empresa,
        "Score Global": e.score_global ?? 0,
        Nivel: e.nivel ?? "",
      };
      s.dimensions.forEach((d) => { row[`Dim ${d.code} ${d.label}`] = d.mean; });
      s.subscales.forEach((sub) => { row[`${sub.code} ${sub.label}`] = sub.mean; });
      return row;
    });
    const ws = utils.json_to_sheet(filas);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Evaluaciones");
    writeFile(wb, `DOCS_Dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ─── Eliminar ────────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState<{ tipo: "docs" | "clima"; id: string; nombre: string } | null>(null);
  const [eliminando, setEliminando] = useState(false);

  async function handleEliminar() {
    if (!confirmDelete) return;
    setEliminando(true);
    try {
      if (confirmDelete.tipo === "docs") {
        await eliminarEvaluacion(confirmDelete.id);
        setEvaluaciones((prev) => prev.filter((e) => e.id !== confirmDelete.id));
      } else {
        await eliminarClima(confirmDelete.id);
        setClimaData((prev) => prev.filter((r) => r.id !== confirmDelete.id));
      }
      setConfirmDelete(null);
    } catch {
      alert("No se pudo eliminar el registro. Intenta de nuevo.");
    } finally {
      setEliminando(false);
    }
  }

  // ─── Clima helpers ───────────────────────────────────────────────────────
  const [filtroAreaClima,  setFiltroAreaClima]  = useState("");
  const [filtroCargoClima, setFiltroCargoClima] = useState("");

  const climaDataEmpresa = nuevaEmpresaId ? climaData.filter((r) => r.empresa_id === nuevaEmpresaId) : climaData;
  const areasClima  = [...new Set(climaDataEmpresa.map((r) => r.area).filter(Boolean))].sort() as string[];
  const cargosClima = [...new Set(climaDataEmpresa.map((r) => r.cargo).filter(Boolean))].sort() as string[];

  const climaFiltrada = climaDataEmpresa.filter((r) => {
    if (filtroAreaClima  && r.area  !== filtroAreaClima)  return false;
    if (filtroCargoClima && r.cargo !== filtroCargoClima) return false;
    return true;
  });

  function promedioOrgClima() {
    if (!climaFiltrada.length) return null;
    return CLIMA_DIM_CODES.map((code) => {
      const valores = climaFiltrada.map((r) => {
        const s = r.scores as ClimaResult;
        return s.dimensions.find((d) => d.code === code)?.mean ?? 0;
      });
      const mean = valores.reduce((a, b) => a + b, 0) / valores.length;
      return { subject: CLIMA_DIMENSIONS[code], value: parseFloat(mean.toFixed(2)) };
    });
  }

  const globalClima = climaFiltrada.length
    ? (climaFiltrada.reduce((a, r) => a + (r.score_global ?? 0), 0) / climaFiltrada.length).toFixed(2)
    : "-";

  async function exportarExcelClima() {
    const { utils, writeFile } = await import("xlsx");
    const filas = climaFiltrada.map((r) => {
      const s = r.scores as ClimaResult;
      const row: Record<string, string | number> = {
        Fecha:          new Date(r.created_at).toLocaleDateString("es-EC"),
        Nombre:         r.nombre  ?? "",
        Cargo:          r.cargo   ?? "",
        "Área":         r.area    ?? "",
        Empresa:        r.empresa ?? "",
        "Score Global": r.score_global ?? 0,
        Nivel:          r.nivel ?? "",
      };
      s.dimensions.forEach((d) => { row[d.label] = d.mean; });
      return row;
    });
    const ws = utils.json_to_sheet(filas);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Clima Laboral");
    writeFile(wb, `Clima_Dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const radarData      = promedioOrg();
  const radarDataClima = promedioOrgClima();

  if (verificando) return null;

  const FONT_SYSTEM = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const EASE_APPLE = "cubic-bezier(0.16, 1, 0.3, 1)";
  const CARD_SHADOW = "0 1px 2px rgba(10,26,50,0.04), 0 12px 28px -14px rgba(10,26,50,0.14)";
  const CARD_BORDER = "1px solid #e8ecf2";
  const KPI_ICONS: Record<string, string> = {
    "Evaluados (muestra)": "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    "Total en BD": "M4 7c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3zm0 0v10c0 1.66 3.58 3 8 3s8-1.34 8-3V7M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3",
    "Promedio Global": "M9 17V9m6 8V5M4 21h16M4 17v.01M4 9V21",
    "Último ingreso": "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "#f0f4f8", fontFamily: FONT_SYSTEM }}>
      <style jsx>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .card-in { animation: cardIn 0.4s ${EASE_APPLE} both; }
      `}</style>

      {/* Header + navegación — una sola pieza navy, sin la costura tab/contenido de antes */}
      <header style={{ background: "linear-gradient(160deg, #0A1A32 0%, #14224a 100%)" }} className="pt-5 pb-0 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between pb-5">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(16,185,129,0.18)", border: "1.5px solid rgba(16,185,129,0.35)" }}
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#10b981" opacity="0.3"/>
                  <path d="M9 12l2 2 4-4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <span style={{ color: "#10b981", letterSpacing: "0.02em" }} className="text-lg font-bold leading-none">MINDTALENT</span>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Dashboard de Consultor</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  value={nuevaEmpresaId}
                  onChange={(e) => setNuevaEmpresaId(e.target.value)}
                  className="appearance-none rounded-lg pl-3 pr-8 py-2 text-sm font-medium outline-none cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(255,255,255,0.14)", colorScheme: "dark", transition: `border-color 200ms ${EASE_APPLE}, background 200ms ${EASE_APPLE}` }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#10b981"; e.currentTarget.style.background = "rgba(255,255,255,0.14)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                >
                  <option value="" style={{ color: "#111" }}>Todas las empresas</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id} style={{ color: "#111" }}>{emp.nombre}</option>
                  ))}
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.5)">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <button
                onClick={async () => { await cerrarSesion(); router.push("/"); }}
                className="px-4 py-2 rounded-lg text-sm font-semibold active:scale-95"
                style={{ color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", transition: `background 200ms ${EASE_APPLE}, color 200ms ${EASE_APPLE}, transform 150ms ${EASE_APPLE}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
              >
                Cerrar sesión
              </button>
            </div>
          </div>

          {/* Segmented control de navegación */}
          <div className="flex gap-1 pb-3 overflow-x-auto" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4, width: "fit-content" }}>
          {(["docs", "clima", "salud", "sesiones", "eval360"] as Tab[]).map((tab) => {
            const labels: Record<Tab, string> = {
              docs:     "Cultura DOCS",
              clima:    "Clima Laboral",
              salud:    "Salud Organizacional",
              alertas:  "Radar de Riesgo",
              sesiones: "Programar evaluaciones",
              eval360:  "Evaluación 360°",
            };
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="relative px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap"
                style={{
                  background: isActive ? "#ffffff" : "transparent",
                  color:      isActive ? "#0A1A32" : "rgba(255,255,255,0.6)",
                  boxShadow:  isActive ? "0 2px 8px rgba(0,0,0,0.18)" : "none",
                  transition: `background 250ms ${EASE_APPLE}, color 250ms ${EASE_APPLE}, box-shadow 250ms ${EASE_APPLE}`,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.9)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
              >
                {labels[tab]}
                {isActive && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 rounded-full"
                    style={{ bottom: -9, width: 14, height: 3, background: "#F9B912" }}
                  />
                )}
              </button>
            );
          })}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* ══════════════════ TAB: CULTURA DOCS ═══════════════════════════════ */}
        {activeTab === "docs" && (
          <>
            {error && <p className="text-red-600 bg-red-50 rounded-lg px-4 py-3 text-sm">{error}</p>}

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Evaluados (muestra)", value: filtradas.length.toString() },
                { label: "Total en BD",         value: evaluacionesEmpresa.length.toString() },
                { label: "Promedio Global",     value: globalProm },
                { label: "Último ingreso",      value: evaluacionesEmpresa[0] ? new Date(evaluacionesEmpresa[0].created_at).toLocaleDateString("es-EC") : "-" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="card-in bg-white rounded-2xl p-5 flex items-center gap-4"
                  style={{ boxShadow: CARD_SHADOW, border: CARD_BORDER }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.1)" }}>
                    <svg width="18" height="18" fill="none" stroke="#059669" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={KPI_ICONS[label]} />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold leading-tight" style={{ color: "#0A1A32", fontVariantNumeric: "tabular-nums" }}>{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Filtros */}
            <div className="card-in bg-white rounded-2xl p-5 flex flex-wrap gap-4 items-end" style={{ boxShadow: CARD_SHADOW, border: CARD_BORDER }}>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Filtrar por Área</label>
                <select
                  value={filtroArea}
                  onChange={(e) => setFiltroArea(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/15 transition-[border-color,box-shadow] duration-200 text-gray-900"
                  style={{ colorScheme: "light" }}
                >
                  <option value="">Todas las áreas</option>
                  {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Filtrar por Cargo</label>
                <select
                  value={filtroCargo}
                  onChange={(e) => setFiltroCargo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/15 transition-[border-color,box-shadow] duration-200 text-gray-900"
                  style={{ colorScheme: "light" }}
                >
                  <option value="">Todos los cargos</option>
                  {cargos.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {(filtroArea || filtroCargo) && (
                <button
                  onClick={() => { setFiltroArea(""); setFiltroCargo(""); }}
                  className="text-xs underline text-gray-500 self-end pb-2"
                >
                  Limpiar filtros
                </button>
              )}
              <div className="ml-auto self-end">
                <button
                  onClick={exportarExcel}
                  disabled={!filtradas.length}
                  className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-80 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 transition-[opacity,transform] duration-150"
                  style={{ background: "#10b981", color: "#0A1A32" }}
                >
                  Exportar Excel
                </button>
              </div>
            </div>

            {/* Radar organizacional */}
            {radarData && (
              <div className="card-in bg-white rounded-2xl p-6" style={{ boxShadow: CARD_SHADOW, border: CARD_BORDER }}>
                <h2 className="text-base font-bold mb-4" style={{ color: "#0A1A32" }}>
                  Perfil Organizacional — Promedio de la muestra ({filtradas.length} evaluados)
                </h2>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#0A1A32" }} />
                    <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 9 }} />
                    <Radar name="Org." dataKey="value" stroke="#0A1A32" fill="#10b981" fillOpacity={0.55} />
                    <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabla de evaluados */}
            <div className="card-in bg-white rounded-2xl p-6" style={{ boxShadow: CARD_SHADOW, border: CARD_BORDER }}>
              <h2 className="text-base font-bold mb-4" style={{ color: "#0A1A32" }}>
                Listado de Evaluados{filtradas.length !== evaluacionesEmpresa.length && ` (${filtradas.length} de ${evaluacionesEmpresa.length})`}
              </h2>

              {cargando ? (
                <div className="text-center py-14">
                  <div className="w-7 h-7 border-[3px] rounded-full animate-spin mx-auto" style={{ borderColor: "#e5e7eb", borderTopColor: "#10b981" }} />
                  <p className="text-gray-400 text-sm mt-3">Cargando evaluaciones…</p>
                </div>
              ) : filtradas.length === 0 ? (
                <div className="text-center py-14">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#f0f4f8" }}>
                    <svg width="22" height="22" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" strokeWidth={1.6}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-sm font-medium">
                    {evaluaciones.length === 0 ? "Aún no hay evaluaciones registradas" : "Ningún evaluado coincide con los filtros"}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {evaluaciones.length === 0 ? "Genera un link de evaluación desde “Programar evaluaciones”." : "Prueba a limpiar los filtros de área o cargo."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#0A1A32" }}>
                        {["Fecha", "Nombre", "Cargo", "Área", "Global", "Nivel", "Implicación", "Consistencia", "Adaptabilidad", "Misión", ""].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap uppercase" style={{ color: "#10b981", letterSpacing: "0.04em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtradas.map((e, i) => {
                        const s = e.scores as ScoringResult;
                        return (
                          <tr key={e.id} className={`${i % 2 === 0 ? "bg-gray-50/60" : "bg-white"} hover:bg-emerald-50/40 transition-colors duration-150`}>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                              {new Date(e.created_at).toLocaleDateString("es-EC")}
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{e.nombre}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{e.cargo}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{e.area}</td>
                            <td className="px-3 py-2 font-bold tabular-nums" style={{ color: getLevelColor(e.nivel ?? "") }}>
                              {(e.score_global ?? 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span
                                className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: `${getLevelColor(e.nivel ?? "")}18`, color: getLevelColor(e.nivel ?? "") }}
                              >
                                {e.nivel}
                              </span>
                            </td>
                            {s.dimensions.map((d) => (
                              <td key={d.code} className="px-3 py-2 text-center tabular-nums" style={{ color: getLevelColor(d.level) }}>
                                {d.mean.toFixed(2)}
                              </td>
                            ))}
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-3">
                                <a
                                  href={`/resultados?id=${e.id}`}
                                  className="text-xs underline whitespace-nowrap"
                                  style={{ color: "#0A1A32" }}
                                >
                                  Ver informe
                                </a>
                                <button
                                  onClick={() => setConfirmDelete({ tipo: "docs", id: e.id, nombre: e.nombre })}
                                  className="text-xs text-red-500 hover:text-red-700 whitespace-nowrap transition-colors"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════ TAB: CLIMA LABORAL ══════════════════════════════ */}
        {activeTab === "clima" && (
          <>
            {errorClima && <p className="text-red-600 bg-red-50 rounded-lg px-4 py-3 text-sm">{errorClima}</p>}

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Evaluados (muestra)", value: climaFiltrada.length.toString() },
                { label: "Total en BD",         value: climaDataEmpresa.length.toString() },
                { label: "Promedio Global",     value: globalClima },
                { label: "Último ingreso",      value: climaDataEmpresa[0] ? new Date(climaDataEmpresa[0].created_at).toLocaleDateString("es-EC") : "-" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="card-in bg-white rounded-2xl p-5 flex items-center gap-4"
                  style={{ boxShadow: CARD_SHADOW, border: CARD_BORDER }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.1)" }}>
                    <svg width="18" height="18" fill="none" stroke="#059669" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={KPI_ICONS[label]} />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold leading-tight" style={{ color: "#0A1A32", fontVariantNumeric: "tabular-nums" }}>{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Filtros */}
            <div className="card-in bg-white rounded-2xl p-5 flex flex-wrap gap-4 items-end" style={{ boxShadow: CARD_SHADOW, border: CARD_BORDER }}>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Filtrar por Área</label>
                <select
                  value={filtroAreaClima}
                  onChange={(e) => setFiltroAreaClima(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/15 transition-[border-color,box-shadow] duration-200 text-gray-900"
                  style={{ colorScheme: "light" }}
                >
                  <option value="">Todas las áreas</option>
                  {areasClima.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Filtrar por Cargo</label>
                <select
                  value={filtroCargoClima}
                  onChange={(e) => setFiltroCargoClima(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/15 transition-[border-color,box-shadow] duration-200 text-gray-900"
                  style={{ colorScheme: "light" }}
                >
                  <option value="">Todos los cargos</option>
                  {cargosClima.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {(filtroAreaClima || filtroCargoClima) && (
                <button
                  onClick={() => { setFiltroAreaClima(""); setFiltroCargoClima(""); }}
                  className="text-xs underline text-gray-500 self-end pb-2"
                >
                  Limpiar filtros
                </button>
              )}
              <div className="ml-auto self-end">
                <button
                  onClick={exportarExcelClima}
                  disabled={!climaFiltrada.length}
                  className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-80 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 transition-[opacity,transform] duration-150"
                  style={{ background: "#10b981", color: "#0A1A32" }}
                >
                  Exportar Excel
                </button>
              </div>
            </div>

            {/* Radar clima */}
            {radarDataClima && (
              <div className="card-in bg-white rounded-2xl p-6" style={{ boxShadow: CARD_SHADOW, border: CARD_BORDER }}>
                <h2 className="text-base font-bold mb-4" style={{ color: "#0A1A32" }}>
                  Perfil de Clima Laboral — Promedio organizacional ({climaFiltrada.length} respuestas)
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarDataClima}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#0A1A32" }} />
                    <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 9 }} />
                    <Radar name="Clima" dataKey="value" stroke="#0A1A32" fill="#10b981" fillOpacity={0.55} />
                    <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabla evaluados clima */}
            <div className="card-in bg-white rounded-2xl p-6" style={{ boxShadow: CARD_SHADOW, border: CARD_BORDER }}>
              <h2 className="text-base font-bold mb-4" style={{ color: "#0A1A32" }}>
                Listado de Evaluados{climaFiltrada.length !== climaDataEmpresa.length && ` (${climaFiltrada.length} de ${climaDataEmpresa.length})`}
              </h2>

              {cargandoClima ? (
                <div className="text-center py-14">
                  <div className="w-7 h-7 border-[3px] rounded-full animate-spin mx-auto" style={{ borderColor: "#e5e7eb", borderTopColor: "#10b981" }} />
                  <p className="text-gray-400 text-sm mt-3">Cargando respuestas…</p>
                </div>
              ) : climaFiltrada.length === 0 ? (
                <div className="text-center py-14">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#f0f4f8" }}>
                    <svg width="22" height="22" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" strokeWidth={1.6}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-sm font-medium">
                    {climaData.length === 0 ? "Aún no hay respuestas de clima registradas" : "Ningún evaluado coincide con los filtros"}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {climaData.length === 0 ? "Genera un link de encuesta desde “Programar evaluaciones”." : "Prueba a limpiar los filtros de área o cargo."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#0A1A32" }}>
                        {["Fecha", "Nombre", "Cargo", "Área", "Global", "Nivel", "Liderazgo", "Comunicación", "Trabajo en Equipo", "Reconocimiento", "Condiciones", "Desarrollo", ""].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap uppercase" style={{ color: "#10b981", letterSpacing: "0.04em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {climaFiltrada.map((r, i) => {
                        const s = r.scores as ClimaResult;
                        return (
                          <tr key={r.id} className={`${i % 2 === 0 ? "bg-gray-50/60" : "bg-white"} hover:bg-emerald-50/40 transition-colors duration-150`}>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                              {new Date(r.created_at).toLocaleDateString("es-EC")}
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{r.nombre ?? "—"}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.cargo ?? "—"}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.area ?? "—"}</td>
                            <td className="px-3 py-2 font-bold tabular-nums" style={{ color: getClimaLevelColor(r.nivel ?? "") }}>
                              {(r.score_global ?? 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span
                                className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: `${getClimaLevelColor(r.nivel ?? "")}18`, color: getClimaLevelColor(r.nivel ?? "") }}
                              >
                                {r.nivel}
                              </span>
                            </td>
                            {s.dimensions.map((d) => (
                              <td key={d.code} className="px-3 py-2 text-center tabular-nums" style={{ color: getClimaLevelColor(d.level) }}>
                                {d.mean.toFixed(2)}
                              </td>
                            ))}
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-3">
                                <a
                                  href={`/resultados-clima?id=${r.id}`}
                                  className="text-xs underline whitespace-nowrap"
                                  style={{ color: "#0A1A32" }}
                                >
                                  Ver informe
                                </a>
                                <button
                                  onClick={() => setConfirmDelete({ tipo: "clima", id: r.id, nombre: r.nombre ?? "este registro" })}
                                  className="text-xs text-red-500 hover:text-red-700 whitespace-nowrap transition-colors"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════ TAB: SALUD ORGANIZACIONAL ═══════════════════════ */}
        {activeTab === "salud" && (
          <SaludOrganizacionalTab evaluaciones={evaluacionesEmpresa} climaData={climaDataEmpresa} />
        )}

        {/* ══════════════════ TAB: RADAR DE RIESGO ════════════════════════════ */}
        {activeTab === "alertas" && (
          <RadarRiesgoTab evaluaciones={evaluacionesEmpresa} climaData={climaDataEmpresa} />
        )}

        {/* ══════════════════ TAB: EVALUACIÓN 360° ════════════════════════════ */}
        {activeTab === "eval360" && <Eval360DashboardPreview empresaId={nuevaEmpresaId || undefined} />}

        {/* ══════════════════ TAB: PROGRAMAR EVALUACIONES ═════════════════════ */}
        {activeTab === "sesiones" && (
          <>
            {/* Crear nueva sesión */}
            <div className="card-in bg-white rounded-2xl p-6" style={{ boxShadow: CARD_SHADOW, border: CARD_BORDER }}>
              <h2 className="text-base font-bold mb-4" style={{ color: "#0A1A32" }}>Nueva sesión de evaluación</h2>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                  <select
                    value={nuevaTipo}
                    onChange={(e) => setNuevaTipo(e.target.value as 'cultura' | 'clima' | '360')}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/15 transition-[border-color,box-shadow] duration-200 text-gray-900"
                    style={{ colorScheme: "light" }}
                  >
                    <option value="cultura">Cultura DOCS</option>
                    <option value="clima">Clima Laboral</option>
                    <option value="360">Evaluación 360°</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Empresa</label>
                  <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 w-56 bg-gray-50">
                    {nombreEmpresaSeleccionada ?? "Sin empresa (elige arriba)"}
                  </div>
                </div>

                {nuevaTipo === "360" && (
                  <div className="flex items-center gap-2">
                    {(["individual", "masivo"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setModo360(m)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                        style={{
                          background: modo360 === m ? "#0A1A32" : "#f0f4f8",
                          color: modo360 === m ? "#10b981" : "#6b7280",
                        }}
                      >
                        {m === "individual" ? "Uno por uno" : "Carga masiva"}
                      </button>
                    ))}
                  </div>
                )}

                {nuevaTipo === "360" && modo360 === "individual" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Evaluado *</label>
                      <select
                        value={personaId}
                        onChange={(e) => handleSeleccionarPersona(e.target.value)}
                        disabled={!nuevaEmpresaId}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/15 transition-[border-color,box-shadow] duration-200 w-56 text-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
                        style={{ colorScheme: "light" }}
                      >
                        <option value="">
                          {!nuevaEmpresaId
                            ? "Elige una empresa arriba"
                            : personasEmpresa.length
                            ? "Selecciona de la nómina..."
                            : "Sin nómina cargada"}
                        </option>
                        {personasEmpresa.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}{p.cargo ? ` — ${p.cargo}` : ""}{p.cargoExterno ? " (externo)" : ""}
                          </option>
                        ))}
                        <option value="manual">+ Escribir manualmente</option>
                      </select>
                    </div>
                    {personaId === "manual" && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre completo *</label>
                        <input
                          type="text"
                          value={datos360.nombre}
                          onChange={(e) => setDatos360((p) => ({ ...p, nombre: e.target.value }))}
                          placeholder="Nombre completo"
                          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/15 transition-[border-color,box-shadow] duration-200 w-48 text-gray-900"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Cargo *</label>
                      <input
                        type="text"
                        value={datos360.cargo}
                        onChange={(e) => setDatos360((p) => ({ ...p, cargo: e.target.value }))}
                        placeholder="Cargo"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/15 transition-[border-color,box-shadow] duration-200 w-40 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Departamento *</label>
                      <input
                        type="text"
                        value={datos360.departamento}
                        onChange={(e) => setDatos360((p) => ({ ...p, departamento: e.target.value }))}
                        placeholder="Departamento"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/15 transition-[border-color,box-shadow] duration-200 w-40 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Jefe directo</label>
                      <input
                        type="text"
                        value={datos360.jefe}
                        onChange={(e) => setDatos360((p) => ({ ...p, jefe: e.target.value }))}
                        placeholder="Opcional"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/15 transition-[border-color,box-shadow] duration-200 w-36 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Período *</label>
                      <PeriodoSelect
                        value={datos360.periodo}
                        onChange={(v) => setDatos360((p) => ({ ...p, periodo: v }))}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/15 transition-[border-color,box-shadow] duration-200 w-32 text-gray-900"
                      />
                    </div>
                  </>
                )}

                {nuevaTipo === "360" && modo360 === "masivo" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Período *</label>
                    <PeriodoSelect
                      value={datos360.periodo}
                      onChange={(v) => setDatos360((p) => ({ ...p, periodo: v }))}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/15 transition-[border-color,box-shadow] duration-200 w-32 text-gray-900"
                    />
                  </div>
                )}

                {nuevaTipo !== "360" || modo360 === "individual" ? (
                  <button
                    onClick={handleCrearSesion}
                    disabled={creandoSesion}
                    className="px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-80 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 transition-[opacity,transform] duration-150"
                    style={{ background: "#0A1A32", color: "#10b981" }}
                  >
                    {cargandoOrganigrama ? "Resolviendo organigrama…" : creandoSesion ? "Creando..." : "Generar link"}
                  </button>
                ) : null}
              </div>

              {nuevaTipo === "360" && modo360 === "masivo" && (
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Pega la lista — una persona por línea: Nombre, Cargo, Departamento, Jefe (opcional)
                  </label>
                  <textarea
                    value={textoMasivo360}
                    onChange={(e) => setTextoMasivo360(e.target.value)}
                    rows={6}
                    placeholder={"Juan Pérez, Supervisor, Ventas, María López\nAna Torres, Analista, Finanzas, Carlos Ruiz"}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/15 transition-[border-color,box-shadow] duration-200 text-gray-900 font-mono"
                  />
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={handleGenerarMasivo360}
                      disabled={creandoSesion}
                      className="px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-80 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 transition-[opacity,transform] duration-150"
                      style={{ background: "#0A1A32", color: "#10b981" }}
                    >
                      {progresoMasivo360 ? `Generando ${progresoMasivo360.hecho}/${progresoMasivo360.total}…` : "Generar todos los links"}
                    </button>
                    {textoMasivo360.trim() && (
                      <span className="text-xs text-gray-400">
                        {textoMasivo360.split("\n").filter((l) => l.trim()).length} persona(s) detectadas
                      </span>
                    )}
                  </div>
                </div>
              )}

              {nuevaTipo === "360" && error360 && (
                <p className="text-xs text-red-600 mt-3">{error360}</p>
              )}
              {nuevaTipo === "360" && modo360 === "individual" && personaId && personaId !== "manual" ? (
                <div className="mt-4">
                  {cargandoOrganigrama && (
                    <p className="text-xs text-gray-500">Resolviendo el organigrama del Manual de Puestos con IA…</p>
                  )}
                  {errorOrganigrama && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      {errorOrganigrama} Se generará un enlace por fuente aplicable y tendrás que decidir a mano a quién enviarlo.
                    </p>
                  )}
                  {sugerencia && !cargandoOrganigrama && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <p className="text-xs font-bold" style={{ color: "#0A1A32" }}>
                          ¿A quién se le envía cada formulario?
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          El organigrama del Manual está en texto libre, así que la IA propone y tú confirmas. Se genera un enlace por cada persona marcada.
                        </p>
                      </div>
                      <div className="px-4 py-3 space-y-3">
                        {FUENTES_FIJAS.map((fuente) => {
                          const lista = sugerencia.destinatarios[fuente] ?? [];
                          const pendiente = sugerencia.sin_resolver.find((x) => x.fuente === fuente);
                          if (lista.length === 0 && !pendiente) return null;
                          return (
                            <div key={fuente}>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                                {FUENTE_LABELS[fuente]}
                              </p>
                              {lista.map((d) => {
                                const marcado = seleccionados.has(`${fuente}:${d.persona_id}`);
                                return (
                                  <label
                                    key={d.persona_id}
                                    className="flex items-start gap-2 py-1 cursor-pointer group"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={marcado}
                                      onChange={() => alternarDestinatario(fuente, d.persona_id)}
                                      className="mt-0.5 accent-[#10b981]"
                                    />
                                    <span className="min-w-0">
                                      <span className="text-xs font-semibold text-gray-800">{d.nombre}</span>
                                      {d.email && <span className="text-xs text-gray-500"> · {d.email}</span>}
                                      <span
                                        className="text-[10px] font-bold ml-2 px-1.5 py-0.5 rounded-full align-middle"
                                        style={
                                          d.confianza === "alta"
                                            ? { background: "#dcfce7", color: "#166534" }
                                            : d.confianza === "media"
                                            ? { background: "#fef9c3", color: "#854d0e" }
                                            : { background: "#fee2e2", color: "#991b1b" }
                                        }
                                      >
                                        {d.confianza === "alta" ? "confirmado" : d.confianza === "media" ? "revisar" : "dudoso"}
                                      </span>
                                      <span className="block text-[11px] text-gray-400 leading-snug">{d.motivo}</span>
                                    </span>
                                  </label>
                                );
                              })}
                              {pendiente && (
                                <p className="text-[11px] text-amber-700 leading-snug">
                                  Sin destinatario: {pendiente.motivo}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="px-4 py-2.5 border-t border-gray-200 flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-gray-500">Agregar a mano:</span>
                        <select
                          value={nuevoDestinatario.fuente}
                          onChange={(e) => setNuevoDestinatario((p) => ({ ...p, fuente: e.target.value as FuenteEvaluacion }))}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-[11px] text-gray-900"
                          style={{ colorScheme: "light" }}
                        >
                          {FUENTES_FIJAS.filter((f) => f !== "autoevaluacion").map((f) => (
                            <option key={f} value={f}>{FUENTE_LABELS[f]}</option>
                          ))}
                        </select>
                        <select
                          value={nuevoDestinatario.personaId}
                          onChange={(e) => setNuevoDestinatario((p) => ({ ...p, personaId: e.target.value }))}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-[11px] text-gray-900 max-w-[15rem]"
                          style={{ colorScheme: "light" }}
                        >
                          <option value="">Elegir persona…</option>
                          {personasDisponiblesParaAgregar().map((p) => (
                            <option key={p.id} value={p.id}>{p.nombre}{p.cargo ? ` — ${p.cargo}` : ""}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={agregarDestinatarioManual}
                          disabled={!nuevoDestinatario.personaId}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg disabled:opacity-40"
                          style={{ background: "#f0f4f8", color: "#0A1A32" }}
                        >
                          Agregar
                        </button>
                      </div>
                      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
                        <p className="text-[11px] text-gray-600">
                          Se generarán <strong>{enviosSeleccionados().length}</strong> enlace(s) para {datos360.nombre || "esta persona"}.
                          {enviosSeleccionados().length === 0 && " Marca al menos a una persona."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : nuevaTipo === "360" ? (
                <p className="text-xs text-gray-400 mt-3">
                  Se generará un link por cada rol aplicable (autoevaluación, jefe, par, colaborador, cliente interno) para que cada evaluador responda sin ver las respuestas de los demás. Al elegir a alguien de la nómina, el sistema ajusta automáticamente cuáles aplican según su puesto.
                </p>
              ) : null}
            </div>

            {/* Evaluaciones 360° generadas */}
            {evaluados360.length > 0 && (
              <div className="card-in bg-white rounded-2xl p-6" style={{ boxShadow: CARD_SHADOW, border: CARD_BORDER }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold" style={{ color: "#0A1A32" }}>
                    Evaluaciones 360° generadas ({evaluados360.length})
                  </h2>
                  <button
                    onClick={exportarLinks360Excel}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: "#f0f4f8", color: "#0A1A32" }}
                  >
                    Exportar todos los links a Excel
                  </button>
                </div>
                <div className="space-y-3">
                  {evaluados360.map(({ evaluado, empresa, links }) => (
                    <div key={evaluado.id} className="border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandido360(expandido360 === evaluado.id ? null : evaluado.id)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                      >
                        <div>
                          <span className="font-semibold text-sm" style={{ color: "#0A1A32" }}>{evaluado.nombre}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {evaluado.cargo} · {evaluado.departamento}{empresa ? ` · ${empresa}` : ""}
                          </span>
                        </div>
                        <span className="text-gray-400 text-xs">{expandido360 === evaluado.id ? "▲" : "▼ ver 5 links"}</span>
                      </button>
                      {expandido360 === evaluado.id && (
                        <div className="border-t border-gray-200 px-4 py-3 space-y-2 bg-gray-50">
                          {links.map((l) => (
                            <div key={l.fuente} className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-gray-700">{FUENTE_LABELS[l.fuente]}</span>
                                {l.destinatario && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    → {l.destinatario.nombre}
                                    {l.destinatario.email ? ` · ${l.destinatario.email}` : ""}
                                  </span>
                                )}
                                <p className="text-xs text-gray-400 truncate max-w-md">{l.url}</p>
                              </div>
                              <button
                                onClick={() => copiarLink360(l.url)}
                                className="text-xs font-semibold whitespace-nowrap px-2 py-1 rounded transition-colors shrink-0"
                                style={{ background: linkCopiado === l.url ? "#10b981" : "#fff", color: "#0A1A32", border: "1px solid #e5e7eb" }}
                              >
                                {linkCopiado === l.url ? "Copiado" : "Copiar"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Listado de sesiones */}
            <div className="card-in bg-white rounded-2xl p-6" style={{ boxShadow: CARD_SHADOW, border: CARD_BORDER }}>
              <h2 className="text-base font-bold mb-4" style={{ color: "#0A1A32" }}>
                Sesiones creadas ({sesiones.length})
              </h2>
              {sesiones.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#f0f4f8" }}>
                    <svg width="20" height="20" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" strokeWidth={1.6}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-sm font-medium">No hay sesiones creadas aún</p>
                  <p className="text-gray-400 text-xs mt-1">Usa el formulario de arriba para generar el primer link.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#0A1A32" }}>
                        {["Fecha", "Tipo", "Empresa", "Estado", "Link de participante", ""].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap uppercase" style={{ color: "#10b981", letterSpacing: "0.04em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sesiones.map((s, i) => (
                        <tr key={s.id} className={`${i % 2 === 0 ? "bg-gray-50/60" : "bg-white"} hover:bg-emerald-50/40 transition-colors duration-150`}>
                          <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                            {new Date(s.created_at).toLocaleDateString("es-EC")}
                          </td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "#0A1A32" }}>
                            {s.tipo === "cultura" ? "Cultura DOCS" : s.tipo === "clima" ? "Clima Laboral" : "Salud"}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{s.empresa ?? "—"}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.estado === "completada" ? "bg-[#10b981]/10 text-[#047857]" : "bg-yellow-100 text-yellow-700"}`}>
                              {s.estado === "completada" ? "Completada" : "Pendiente"}
                            </span>
                          </td>
                          <td className="px-3 py-2 max-w-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 truncate">{getLinkSesion(s)}</span>
                              <button
                                onClick={() => copiarLink(s)}
                                className="text-xs font-semibold whitespace-nowrap px-2 py-1 rounded transition-colors"
                                style={{ background: linkCopiado === s.id ? "#10b981" : "#f0f4f8", color: "#0A1A32" }}
                              >
                                {linkCopiado === s.id ? "Copiado" : "Copiar"}
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => handleEliminarSesion(s.id)}
                              className="text-xs text-red-500 hover:text-red-700 transition-colors"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

      </main>

      {/* ── Modal de confirmación de eliminación ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm px-4">
          <div className="card-in bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-base font-bold mb-2" style={{ color: "#0A1A32" }}>
              ¿Eliminar registro?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Vas a eliminar el registro de <span className="font-semibold text-gray-800">{confirmDelete.nombre}</span>.
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={eliminando}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminar}
                disabled={eliminando}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: "#dc2626" }}
              >
                {eliminando ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

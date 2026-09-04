import type { FuenteEvaluacion } from "@/lib/360-types";

/**
 * Destinatario propuesto para un enlace 360°.
 *
 * `confianza` es parte del dato, no un adorno: el organigrama del Manual de
 * Puestos es texto libre ("Representante Legal" cuando el puesto real se llama
 * "Presidenta y Representante Legal"), así que una propuesta puede ser una
 * lectura razonable y no un hecho. Quien programa la evaluación decide con esa
 * señal a la vista; el sistema nunca da por cerrado un match dudoso.
 */
export interface DestinatarioSugerido {
  persona_id: string;
  nombre: string;
  email: string | null;
  confianza: "alta" | "media" | "baja";
  motivo: string;
}

export type DestinatariosPorFuente = Partial<Record<FuenteEvaluacion, DestinatarioSugerido[]>>;

/** Fuente que aplica al puesto pero para la que no hay a quién enviarle el enlace. */
export interface FuenteSinResolver {
  fuente: FuenteEvaluacion;
  motivo: string;
}

export interface SugerenciaDestinatarios {
  destinatarios: DestinatariosPorFuente;
  sin_resolver: FuenteSinResolver[];
  /** false cuando la IA falló y solo se devolvió lo deducible sin ella. */
  con_ia: boolean;
}

export function normalizarTextoOrganigrama(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

const SENTINELS_SIN_VALOR = new Set(["", "ninguno", "ninguna", "n/a", "no aplica", "no tiene", "-"]);

export function tieneValorOrganigrama(s: string | null | undefined): boolean {
  return !SENTINELS_SIN_VALOR.has(normalizarTextoOrganigrama(s));
}

/** Jefe directo concreto de una persona, resuelto sobre la nómina real. */
export interface Jefatura {
  persona_id: string;
  /** null = nadie de la nómina ocupa ese puesto superior (asamblea, directorio, vacante). */
  jefe_persona_id: string | null;
  confianza: DestinatarioSugerido["confianza"];
  motivo: string;
}

export interface MapaJefaturas {
  jefaturas: Jefatura[];
  /** false cuando la IA falló: la UI avisa en vez de fingir que resolvió. */
  con_ia: boolean;
}

interface PersonaMinima {
  id: string;
  nombre: string;
  email: string | null;
  clienteInternoId?: string | null;
}

/**
 * Deriva a quién enviarle cada enlace a partir de la línea de mando ya resuelta.
 *
 * Solo la jefatura se interpreta (la resuelve la IA sobre el texto libre del
 * Manual); pares y colaboradores salen de ahí por construcción, y por eso son
 * consistentes entre sí: si A es par de B, B es par de A. Resolver cada fuente
 * por separado con la IA producía conjuntos asimétricos.
 */
export function derivarDestinatarios(
  personaId: string,
  roster: PersonaMinima[],
  mapa: MapaJefaturas,
): SugerenciaDestinatarios {
  const porId = new Map(roster.map((p) => [p.id, p]));
  const evaluado = porId.get(personaId);
  const destinatarios: DestinatariosPorFuente = {};
  const sinResolver: FuenteSinResolver[] = [];
  if (!evaluado) return { destinatarios, sin_resolver: sinResolver, con_ia: mapa.con_ia };

  const jefaturaPorPersona = new Map(mapa.jefaturas.map((j) => [j.persona_id, j]));
  const aSugerido = (p: PersonaMinima, confianza: DestinatarioSugerido["confianza"], motivo: string): DestinatarioSugerido => ({
    persona_id: p.id,
    nombre: p.nombre,
    email: p.email,
    confianza,
    motivo,
  });

  destinatarios.autoevaluacion = [aSugerido(evaluado, "alta", "Es la persona evaluada.")];

  const ci = evaluado.clienteInternoId ? porId.get(evaluado.clienteInternoId) : undefined;
  if (ci) {
    destinatarios.cliente_interno = [
      aSugerido(ci, "alta", "Designado como cliente interno en la nómina que entregó la organización."),
    ];
  }

  const miJefatura = jefaturaPorPersona.get(personaId);
  const jefe = miJefatura?.jefe_persona_id ? porId.get(miJefatura.jefe_persona_id) : undefined;

  if (jefe && miJefatura) {
    destinatarios.jefe = [aSugerido(jefe, miJefatura.confianza, miJefatura.motivo)];

    const pares = roster.filter(
      (p) => p.id !== personaId && jefaturaPorPersona.get(p.id)?.jefe_persona_id === jefe.id,
    );
    if (pares.length > 0) {
      destinatarios.par = pares.map((p) =>
        aSugerido(p, miJefatura.confianza, `Reporta al mismo jefe directo (${jefe.nombre}).`),
      );
    } else {
      sinResolver.push({ fuente: "par", motivo: `Nadie más de la nómina reporta a ${jefe.nombre}.` });
    }
  } else {
    const motivo = miJefatura?.motivo || "No se pudo determinar el jefe directo dentro de la nómina.";
    sinResolver.push({ fuente: "jefe", motivo });
    sinResolver.push({ fuente: "par", motivo: "Sin jefe resuelto no se pueden identificar los pares." });
  }

  const colaboradores = roster.filter((p) => jefaturaPorPersona.get(p.id)?.jefe_persona_id === personaId);
  if (colaboradores.length > 0) {
    destinatarios.colaborador = colaboradores.map((p) =>
      aSugerido(p, jefaturaPorPersona.get(p.id)?.confianza ?? "media", `Reporta directamente a ${evaluado.nombre}.`),
    );
  } else {
    sinResolver.push({ fuente: "colaborador", motivo: "Nadie de la nómina le reporta directamente." });
  }

  return { destinatarios, sin_resolver: sinResolver, con_ia: mapa.con_ia };
}

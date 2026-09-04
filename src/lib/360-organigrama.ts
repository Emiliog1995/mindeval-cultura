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

const ROL_LABEL: Record<FuenteEvaluacion, string> = {
  autoevaluacion: "autoevaluación",
  jefe: "jefe directo",
  par: "par",
  colaborador: "colaborador",
  cliente_interno: "cliente interno",
};

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
  puesto_id?: string | null;
  clienteInternoId?: string | null;
}

/**
 * Deriva a quién enviarle cada enlace a partir de la línea de mando ya resuelta.
 *
 * Dos reglas de la metodología mandan acá:
 *
 * 1. **Par = quien ocupa el mismo puesto**, no quien comparte jefe. Compartir
 *    jefe no hace pares a un Contador General y un Evaluador de Programas: son
 *    funciones distintas que no se pueden calificar entre sí con el mismo
 *    criterio. Un puesto con un solo ocupante simplemente no tiene pares.
 *
 * 2. **Una persona ocupa un solo rol frente a cada evaluado.** Si el Contador
 *    ya es colaborador de la Presidenta, no puede además llegarle el formulario
 *    de cliente interno de la misma persona: contaría dos veces, con dos pesos
 *    distintos, y le duplica el trabajo. Cuando hay choque gana el vínculo más
 *    directo, en este orden: jefe > colaborador > cliente interno > par.
 *
 * Solo la jefatura se interpreta (la resuelve la IA sobre el texto libre del
 * Manual); todo lo demás sale de ahí y del puesto, y por eso es simétrico: si
 * A es par de B, B es par de A.
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

  // Un rol por persona: quien ya quedó asignado no vuelve a aparecer más abajo.
  const yaAsignado = new Set<string>([personaId]);
  const rolPrevio = new Map<string, FuenteEvaluacion>();
  const asignar = (fuente: FuenteEvaluacion, personas: PersonaMinima[], confianza: DestinatarioSugerido["confianza"], motivo: (p: PersonaMinima) => string) => {
    const libres = personas.filter((p) => !yaAsignado.has(p.id));
    for (const p of libres) {
      yaAsignado.add(p.id);
      rolPrevio.set(p.id, fuente);
    }
    if (libres.length > 0) destinatarios[fuente] = libres.map((p) => aSugerido(p, confianza, motivo(p)));
    return libres;
  };

  destinatarios.autoevaluacion = [aSugerido(evaluado, "alta", "Es la persona evaluada.")];

  const miJefatura = jefaturaPorPersona.get(personaId);
  const jefe = miJefatura?.jefe_persona_id ? porId.get(miJefatura.jefe_persona_id) : undefined;

  if (jefe && miJefatura) {
    asignar("jefe", [jefe], miJefatura.confianza, () => miJefatura.motivo);
  } else {
    sinResolver.push({
      fuente: "jefe",
      motivo: miJefatura?.motivo || "No se pudo determinar el jefe directo dentro de la nómina.",
    });
  }

  const colaboradores = roster.filter((p) => jefaturaPorPersona.get(p.id)?.jefe_persona_id === personaId);
  if (colaboradores.length > 0) {
    asignar("colaborador", colaboradores, "alta", () => `Reporta directamente a ${evaluado.nombre}.`);
  } else {
    sinResolver.push({ fuente: "colaborador", motivo: "Nadie de la nómina le reporta directamente." });
  }

  const ci = evaluado.clienteInternoId ? porId.get(evaluado.clienteInternoId) : undefined;
  if (ci) {
    const asignados = asignar("cliente_interno", [ci], "alta", () => "Designado como cliente interno en la nómina que entregó la organización.");
    if (asignados.length === 0) {
      sinResolver.push({
        fuente: "cliente_interno",
        motivo: `La nómina designa a ${ci.nombre} como cliente interno, pero ya lo evalúa como ${ROL_LABEL[rolPrevio.get(ci.id) ?? "par"]}. Una persona ocupa un solo rol.`,
      });
    }
  }

  // Pares: mismo puesto. Un puesto con un solo ocupante no tiene pares.
  const pares = evaluado.puesto_id
    ? roster.filter((p) => p.id !== personaId && p.puesto_id && p.puesto_id === evaluado.puesto_id)
    : [];
  if (pares.length > 0) {
    asignar("par", pares, "alta", () => "Ocupa el mismo puesto que la persona evaluada.");
  } else {
    sinResolver.push({
      fuente: "par",
      motivo: evaluado.puesto_id
        ? "Es la única persona en su puesto, así que no tiene pares."
        : "No tiene puesto asignado, no se pueden identificar pares.",
    });
  }

  return { destinatarios, sin_resolver: sinResolver, con_ia: mapa.con_ia };
}

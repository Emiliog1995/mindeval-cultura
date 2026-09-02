export type EtapaCandidato =
  | "postulado" | "filtro_cv" | "verificacion_titulo" | "psicometricas"
  | "tecnica" | "assessment" | "informe_final" | "entrevista" | "finalista" | "contratado" | "descartado";

// Orden real del proceso (confirmado con el reclutador): el filtro de CV pasa
// primero, luego psicométricas y técnica (agendadas con enlace al candidato),
// y SENESCYT se verifica solo a quienes ya aprobaron esas dos — no antes.
// "informe_final" va ANTES de "entrevista" a propósito: el Informe Ejecutivo
// se genera con SENESCYT + psicométricas + técnica + assessment para decidir
// a quién entrevistar — la entrevista misma queda fuera del informe, es
// decisión humana del panel, no evidencia que la IA deba consolidar.
export const ETAPAS: { key: EtapaCandidato; label: string; orden: number }[] = [
  // Se rotulaba "Manual de Puestos", que es un paso del trabajo del
  // reclutador, no un estado del candidato -- el número de esa columna del
  // embudo no lo entendía nadie (auditoría 2026-09, I-13).
  { key: "postulado",           label: "Postulados",            orden: 1 },
  { key: "filtro_cv",           label: "Filtro de CVs con IA",  orden: 2 },
  { key: "psicometricas",       label: "Pruebas Psicométricas", orden: 3 },
  { key: "tecnica",             label: "Pruebas Técnicas",      orden: 4 },
  { key: "verificacion_titulo", label: "Verificación SENESCYT", orden: 5 },
  { key: "assessment",          label: "Assessment Center",     orden: 6 },
  { key: "informe_final",       label: "Informe Final",         orden: 7 },
  { key: "entrevista",          label: "Entrevista Virtual",    orden: 8 },
];

/**
 * Desenlaces del proceso. Van aparte de ETAPAS —que define el recorrido— pero
 * el embudo sí tiene que mostrarlos: antes los candidatos desaparecían del
 * conteo justo al llegar al final, que es lo que el cliente más quiere ver
 * (auditoría 2026-09, I-13).
 */
export const DESENLACES: { key: EtapaCandidato; label: string }[] = [
  { key: "finalista",  label: "Finalistas" },
  { key: "contratado", label: "Contratados" },
  { key: "descartado", label: "Descartados" },
];

export function labelEtapa(key: EtapaCandidato): string {
  // Antes solo miraba ETAPAS, así que un candidato en un desenlace mostraba
  // la clave cruda ("descartado") en vez de una etiqueta.
  return ETAPAS.find((e) => e.key === key)?.label ?? DESENLACES.find((d) => d.key === key)?.label ?? key;
}

export interface CompetenciaDura {
  nombre: string;
  peso: number;
  excluyente: boolean;
}

export interface CompetenciaBlanda {
  nombre: string;
  nivel_esperado: number;
}

export interface PerfilCargoManual {
  mision: string;
  area: string;
  reporta_a?: string;
  banda_salarial?: string;
  modalidad?: string;
  competencias_duras: CompetenciaDura[];
  competencias_blandas: CompetenciaBlanda[];
}

export interface Vacante {
  id: string;
  puesto_id?: string | null;
  perfil_cargo_manual?: PerfilCargoManual | null;
  titulo: string;
  empresa: string;
  empresa_id?: string | null;
  codigo_proceso?: string | null;
  estado: "abierta" | "pausada" | "cerrada";
  fecha_limite_postulacion?: string | null;
  corte_match_cv: number;
  corte_sten: number;
  corte_tecnica: number;
  modo_tecnica: "caso_abierto" | "banco";
  tests_psicometricos: ("16pf5" | "kostick" | "disc" | "valanti")[];
  // Caso especial: opciones de sede y filtro de salario en el formulario
  // público. Nulos en la gran mayoría de vacantes — solo se configuran a
  // mano (vía SQL) cuando un cliente puntual lo pide, como Fundación
  // Unbound Ecuador (dos sedes con vacantes separadas y un tope salarial).
  sedes?: string[] | null;
  salario_pregunta?: { monto: number } | null;
  created_at: string;
  // Responsable del proceso — ver supabase/mindeval-vacante-contacto.sql.
  contacto_nombre?: string | null;
  contacto_email?: string | null;
}

// Cierre por fecha límite sin necesitar un cron: se evalúa en el momento en
// que llega cada solicitud (postulación pública, formulario de postulación,
// vista del embudo) comparando contra la hora actual del servidor/cliente.
export function vacanteAceptaPostulaciones(vacante: Pick<Vacante, "estado" | "fecha_limite_postulacion">): boolean {
  if (vacante.estado !== "abierta") return false;
  if (!vacante.fecha_limite_postulacion) return true;
  return new Date() <= new Date(vacante.fecha_limite_postulacion);
}

export interface Candidato {
  id: string;
  vacante_id: string;
  nombre_completo: string;
  cedula?: string | null;
  email?: string | null;
  telefono?: string | null;
  ciudad?: string | null;
  anios_experiencia?: number | null;
  educacion?: string | null;
  cv_texto?: string | null;
  cv_url?: string | null;
  sede?: string | null;
  salario_acuerdo?: boolean | null;
  etapa_actual: EtapaCandidato;
  estado: "activo" | "descartado" | "contratado";
  motivo_descarte?: string | null;
  // Momento en que se le envió el correo de "no seleccionado". NULL/ausente =
  // nunca se le envió. Ver supabase/mindeval-rechazo-enviado.sql.
  rechazo_enviado_en?: string | null;
  created_at: string;
}

export interface CvMatch {
  id: string;
  candidato_id: string;
  match_pct: number;
  razones: { criterio: string; cumple: boolean; detalle: string }[];
  generado_en: string;
}

export interface VerificacionTitulo {
  id: string;
  candidato_id: string;
  titulo_declarado?: string | null;
  institucion?: string | null;
  anio?: number | null;
  estado: "pendiente" | "registrado" | "sin_registro";
  verificado_por?: string | null;
  verificado_en?: string | null;
  comprobante_url?: string | null;
  // resultado que encontró webservices.ec en una consulta automática — solo
  // informativo mientras estado siga en 'pendiente', nunca se trata como el
  // resultado final (ver /candidato/[id]/verificacion y el ranking).
  resultado_automatico?: "registrado" | "sin_registro" | null;
  consultado_automaticamente_en?: string | null;
  created_at: string;
}

export interface PruebaPsicometrica {
  id: string;
  candidato_id: string;
  bateria: string;
  sten: number | null;
  // Puntaje estándar (media 50/DE 10) de VALANTI -- no cabe en `sten`
  // (acotado 0-10 por CHECK, pensado para 16PF-5/KOSTICK/DISC). Ver
  // mindeval-valanti-puntaje-estandar.sql.
  puntaje_estandar?: number | null;
  percentil: number | null;
  aplicada_en: string;
}

export interface OpcionPregunta {
  id: string;
  texto: string;
}

export interface PreguntaBanco {
  id: string;
  vacante_id: string;
  enunciado: string;
  opciones: OpcionPregunta[];
  respuesta_correcta: string;
  puntos: number;
  origen: "ia" | "manual";
  estado: "borrador" | "activa";
  orden: number;
  created_at: string;
}

export interface RespuestaBancoDetalle {
  pregunta_id: string;
  opcion_elegida: string;
  respuesta_correcta: string;
  correcta: boolean;
  puntos_obtenidos: number;
}

export interface PruebaTecnica {
  id: string;
  candidato_id: string;
  modo: "caso_abierto" | "banco";
  caso_generado?: string | null;
  criterios?: { analisis: number; estrategia: number; kpis: number; claridad: number } | null;
  respuesta_candidato?: string | null;
  puntaje_analisis?: number | null;
  puntaje_estrategia?: number | null;
  puntaje_kpis?: number | null;
  puntaje_claridad?: number | null;
  preguntas_snapshot?: PreguntaBanco[] | null;
  respuestas_banco?: RespuestaBancoDetalle[] | null;
  puntaje_objetivo?: number | null;
  puntaje_total?: number | null;
  corregido_por: "ia" | "reclutador";
  created_at: string;
}

export interface AssessmentEvaluacion {
  id: string;
  candidato_id: string;
  ejercicio: string;
  competencia: string;
  puntaje: number;
  evaluador?: string | null;
  notas?: string | null;
  sesion_id?: string | null;
}

export interface EjercicioBanco {
  id: string;
  vacante_id: string;
  competencia: string;
  enunciado: string;
  criterios_evaluacion: string;
  origen: "ia" | "manual";
  estado: "borrador" | "activa";
  orden: number;
  created_at: string;
}

export interface Entrevista {
  id: string;
  candidato_id: string;
  fecha?: string | null;
  entrevistadores?: string | null;
  resultado?: "avanza" | "no_avanza" | "oferta" | "contratado" | null;
  notas?: string | null;
}

export type SeveridadAlerta = "bajo" | "medio" | "alto" | "critico";

export interface AlertaFraude {
  id: string;
  candidato_id: string;
  sesion_tipo: string;
  tipo_alerta: string;
  severidad: SeveridadAlerta;
  detalle?: string | null;
  creado_en: string;
}

export type TipoSesionPrueba = "psicometrica" | "tecnica" | "assessment";
export type EstadoSesionPrueba = "programada" | "en_curso" | "completada" | "expirada";

export interface SesionPrueba {
  id: string;
  candidato_id: string;
  vacante_id: string;
  tipo: TipoSesionPrueba;
  token: string;
  fecha_programada: string;
  estado: EstadoSesionPrueba;
  completada_en?: string | null;
  // Momento real en que el candidato desbloqueó el contenido (primera vez
  // que la sesión pasa a 'en_curso') — ancla el cronómetro del portal para
  // que una recarga no le regale tiempo extra. Ver
  // mindeval-sesion-iniciada-en.sql.
  iniciada_en?: string | null;
  ejercicios_snapshot?: EjercicioBanco[] | null;
  created_at: string;
}

export interface InformeIA {
  id: string;
  candidato_id: string;
  tipo: "perfil" | "finalista";
  contenido: string;
  generado_en: string;
}

export interface ResultadoConsolidadoMindEval {
  candidato: Candidato;
  matchCv?: number;
  stenPromedio?: number;
  tecnicaTotal?: number;
  assessmentPromedio?: number;
  idoneidadGlobal: number | null;
  indiceIntegridad: number;
  alertas: AlertaFraude[];
}

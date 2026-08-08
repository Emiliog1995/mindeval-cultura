export type EtapaCandidato =
  | "postulado" | "filtro_cv" | "verificacion_titulo" | "psicometricas"
  | "tecnica" | "assessment" | "entrevista" | "finalista" | "contratado" | "descartado";

// Orden real del proceso (confirmado con el reclutador): el filtro de CV pasa
// primero, luego psicométricas y técnica (agendadas con enlace al candidato),
// y SENESCYT se verifica solo a quienes ya aprobaron esas dos — no antes.
export const ETAPAS: { key: EtapaCandidato; label: string; orden: number }[] = [
  { key: "postulado",           label: "Manual de Puestos",     orden: 1 },
  { key: "filtro_cv",           label: "Filtro de CVs con IA",  orden: 2 },
  { key: "psicometricas",       label: "Pruebas Psicométricas", orden: 3 },
  { key: "tecnica",             label: "Pruebas Técnicas",      orden: 4 },
  { key: "verificacion_titulo", label: "Verificación SENESCYT", orden: 5 },
  { key: "assessment",          label: "Assessment Center",     orden: 6 },
  { key: "entrevista",          label: "Entrevista Virtual",    orden: 7 },
];

export function labelEtapa(key: EtapaCandidato): string {
  return ETAPAS.find((e) => e.key === key)?.label ?? key;
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
  codigo_proceso?: string | null;
  estado: "abierta" | "pausada" | "cerrada";
  corte_match_cv: number;
  corte_sten: number;
  corte_tecnica: number;
  created_at: string;
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
  etapa_actual: EtapaCandidato;
  estado: "activo" | "descartado" | "contratado";
  motivo_descarte?: string | null;
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
}

export interface PruebaPsicometrica {
  id: string;
  candidato_id: string;
  bateria: string;
  sten: number | null;
  percentil: number | null;
  aplicada_en: string;
}

export interface PruebaTecnica {
  id: string;
  candidato_id: string;
  caso_generado: string;
  criterios: { analisis: number; estrategia: number; kpis: number; claridad: number };
  respuesta_candidato?: string | null;
  puntaje_analisis?: number | null;
  puntaje_estrategia?: number | null;
  puntaje_kpis?: number | null;
  puntaje_claridad?: number | null;
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

export type TipoSesionPrueba = "psicometrica" | "tecnica";
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

export type ClimaDimension = "A" | "B" | "C" | "D" | "E" | "F";

export interface ClimaItem {
  id: number;
  text: string;
  dimension: ClimaDimension;
  inverse: boolean;
}

export const CLIMA_DIMENSIONS: Record<ClimaDimension, string> = {
  A: "Liderazgo",
  B: "Comunicación",
  C: "Trabajo en Equipo",
  D: "Reconocimiento y Motivación",
  E: "Condiciones y Recursos",
  F: "Desarrollo Profesional",
};

// 6 ítems inversos: 5, 9, 15, 20, 25, 30 → fórmula: 6 − original
export const CLIMA_ITEMS: ClimaItem[] = [
  // Dimensión A: Liderazgo
  { id: 1,  text: "Mi jefe inmediato me da retroalimentación oportuna sobre mi desempeño.", dimension: "A", inverse: false },
  { id: 2,  text: "Mi jefe me da autonomía para tomar decisiones en mi trabajo.", dimension: "A", inverse: false },
  { id: 3,  text: "La alta dirección comunica con claridad el rumbo de la empresa.", dimension: "A", inverse: false },
  { id: 4,  text: "Siento que mi jefe confía en mí y en mi criterio profesional.", dimension: "A", inverse: false },
  { id: 5,  text: "Mi jefe rara vez reconoce los logros del equipo.", dimension: "A", inverse: true },
  // Dimensión B: Comunicación
  { id: 6,  text: "Recibo la información necesaria para desempeñar bien mis funciones.", dimension: "B", inverse: false },
  { id: 7,  text: "Existe comunicación abierta entre los distintos departamentos.", dimension: "B", inverse: false },
  { id: 8,  text: "Los cambios importantes en la empresa se comunican con anticipación.", dimension: "B", inverse: false },
  { id: 9,  text: "Hay demasiados rumores e información informal que generan confusión.", dimension: "B", inverse: true },
  { id: 10, text: "Puedo expresar mis ideas y opiniones sin temor a represalias.", dimension: "B", inverse: false },
  // Dimensión C: Trabajo en Equipo
  { id: 11, text: "Mi equipo colabora activamente para alcanzar los objetivos comunes.", dimension: "C", inverse: false },
  { id: 12, text: "Existe un ambiente de confianza y respeto entre los compañeros.", dimension: "C", inverse: false },
  { id: 13, text: "Podemos resolver los conflictos internos de forma constructiva.", dimension: "C", inverse: false },
  { id: 14, text: "En mi equipo se valoran las distintas perspectivas y habilidades.", dimension: "C", inverse: false },
  { id: 15, text: "En mi equipo hay competencia negativa que dificulta la colaboración.", dimension: "C", inverse: true },
  // Dimensión D: Reconocimiento y Motivación
  { id: 16, text: "Mi esfuerzo y contribución son reconocidos de manera justa.", dimension: "D", inverse: false },
  { id: 17, text: "La remuneración que recibo es equitativa respecto a mis funciones.", dimension: "D", inverse: false },
  { id: 18, text: "Siento orgullo de trabajar en esta organización.", dimension: "D", inverse: false },
  { id: 19, text: "Estoy motivado/a para dar lo mejor de mí cada día.", dimension: "D", inverse: false },
  { id: 20, text: "Los reconocimientos dentro de la empresa no siempre son justos.", dimension: "D", inverse: true },
  // Dimensión E: Condiciones y Recursos
  { id: 21, text: "Cuento con los recursos y herramientas necesarios para realizar mi trabajo.", dimension: "E", inverse: false },
  { id: 22, text: "Mi espacio de trabajo es adecuado y seguro.", dimension: "E", inverse: false },
  { id: 23, text: "La carga de trabajo que tengo es manejable y equitativa.", dimension: "E", inverse: false },
  { id: 24, text: "Las políticas y procesos de la empresa facilitan mi trabajo diario.", dimension: "E", inverse: false },
  { id: 25, text: "Frecuentemente tengo que trabajar en condiciones inadecuadas.", dimension: "E", inverse: true },
  // Dimensión F: Desarrollo Profesional
  { id: 26, text: "La empresa me brinda oportunidades de aprendizaje y crecimiento.", dimension: "F", inverse: false },
  { id: 27, text: "Tengo claridad sobre las posibilidades de ascenso en la organización.", dimension: "F", inverse: false },
  { id: 28, text: "La empresa invierte en la capacitación y formación de sus colaboradores.", dimension: "F", inverse: false },
  { id: 29, text: "Puedo aplicar mis habilidades y talentos en el cargo que ocupo.", dimension: "F", inverse: false },
  { id: 30, text: "Siento que mis posibilidades de crecimiento en esta empresa son limitadas.", dimension: "F", inverse: true },
];

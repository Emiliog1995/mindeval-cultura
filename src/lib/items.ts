export type Dimension = "I" | "II" | "III" | "IV";
export type Subscale = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

export interface Item {
  id: number;
  text: string;
  dimension: Dimension;
  subscale: Subscale;
  inverse: boolean;
}

export const DIMENSIONS: Record<Dimension, string> = {
  I: "Implicación",
  II: "Consistencia",
  III: "Adaptabilidad",
  IV: "Misión",
};

export const SUBSCALES: Record<Subscale, { label: string; dimension: Dimension }> = {
  A: { label: "Empowerment", dimension: "I" },
  B: { label: "Trabajo en equipo", dimension: "I" },
  C: { label: "Desarrollo de capacidades", dimension: "I" },
  D: { label: "Valores centrales", dimension: "II" },
  E: { label: "Acuerdo", dimension: "II" },
  F: { label: "Coordinación e integración", dimension: "II" },
  G: { label: "Orientación al cambio", dimension: "III" },
  H: { label: "Orientación al cliente", dimension: "III" },
  I: { label: "Aprendizaje organizacional", dimension: "III" },
  J: { label: "Dirección estratégica", dimension: "IV" },
  K: { label: "Metas y objetivos", dimension: "IV" },
  L: { label: "Visión", dimension: "IV" },
};

export const ITEMS: Item[] = [
  // DIMENSIÓN I: IMPLICACIÓN — Subescala A: Empowerment
  { id: 1,  text: "La mayoría de los empleados tienen un alto grado de implicación en su trabajo.", dimension: "I", subscale: "A", inverse: false },
  { id: 2,  text: "Las decisiones con frecuencia se toman en el nivel donde se dispone de la información más adecuada.", dimension: "I", subscale: "A", inverse: false },
  { id: 3,  text: "La información se comparte ampliamente para que todo el que la necesite pueda tener acceso a ella.", dimension: "I", subscale: "A", inverse: false },
  { id: 4,  text: "Cada persona cree que puede tener un impacto positivo en el trabajo del grupo.", dimension: "I", subscale: "A", inverse: false },
  { id: 5,  text: "La planificación del trabajo es continua e implica a todo el mundo en algún grado.", dimension: "I", subscale: "A", inverse: false },
  // Subescala B: Trabajo en equipo
  { id: 6,  text: "Se fomenta activamente la cooperación entre los diferentes grupos de esta organización.", dimension: "I", subscale: "B", inverse: false },
  { id: 7,  text: "Trabajar en este lugar es como ser parte de un equipo.", dimension: "I", subscale: "B", inverse: false },
  { id: 8,  text: "Acostumbramos a planificar proyectos en equipo.", dimension: "I", subscale: "B", inverse: false },
  { id: 9,  text: "Los grupos de trabajo son el bloque fundamental de construcción de esta organización.", dimension: "I", subscale: "B", inverse: false },
  { id: 10, text: "El trabajo se organiza de modo que cada persona pueda ver la relación entre su actividad y las metas de la organización.", dimension: "I", subscale: "B", inverse: false },
  // Subescala C: Desarrollo de capacidades
  { id: 11, text: "La autoridad se delega de modo que las personas puedan actuar por sí mismas.", dimension: "I", subscale: "C", inverse: false },
  { id: 12, text: "Las capacidades del personal se ven como una fuente importante de ventaja competitiva.", dimension: "I", subscale: "C", inverse: false },
  { id: 13, text: "La organización invierte continuamente en el desarrollo de las capacidades de sus empleados.", dimension: "I", subscale: "C", inverse: false },
  { id: 14, text: "El talento humano es visto como un factor diferenciador clave en la organización.", dimension: "I", subscale: "C", inverse: false },
  { id: 15, text: "A menudo surgen problemas porque no disponemos de las habilidades necesarias para hacer el trabajo.", dimension: "I", subscale: "C", inverse: true },
  // DIMENSIÓN II: CONSISTENCIA — Subescala D: Valores centrales
  { id: 16, text: "Los líderes y directivos practican lo que pregonan.", dimension: "II", subscale: "D", inverse: false },
  { id: 17, text: "Existe un estilo de dirección característico con un conjunto específico de prácticas de gestión.", dimension: "II", subscale: "D", inverse: false },
  { id: 18, text: "Existe un conjunto de valores claro y consistente que rige la forma en que nos conducimos.", dimension: "II", subscale: "D", inverse: false },
  { id: 19, text: "Ignorar los valores esenciales de este grupo te ocasionará problemas.", dimension: "II", subscale: "D", inverse: false },
  { id: 20, text: "Existe un código ético que guía nuestro comportamiento y nos indica lo que debemos y no debemos hacer.", dimension: "II", subscale: "D", inverse: false },
  // Subescala E: Acuerdo
  { id: 21, text: "Cuando existen desacuerdos, trabajamos intensamente para encontrar soluciones donde todos ganen.", dimension: "II", subscale: "E", inverse: false },
  { id: 22, text: "Este grupo tiene una cultura fuerte.", dimension: "II", subscale: "E", inverse: false },
  { id: 23, text: "Nos resulta fácil lograr el consenso, aun en temas difíciles.", dimension: "II", subscale: "E", inverse: false },
  { id: 24, text: "A menudo tenemos dificultades para alcanzar acuerdos en temas clave.", dimension: "II", subscale: "E", inverse: true },
  { id: 25, text: "Existe un claro acuerdo acerca de la forma correcta e incorrecta de hacer las cosas.", dimension: "II", subscale: "E", inverse: false },
  // Subescala F: Coordinación e integración
  { id: 26, text: "Nuestra manera de trabajar es consistente y predecible.", dimension: "II", subscale: "F", inverse: false },
  { id: 27, text: "Las personas de diferentes grupos de esta organización tienen una perspectiva común.", dimension: "II", subscale: "F", inverse: false },
  { id: 28, text: "Es sencillo coordinar proyectos entre los diferentes grupos de esta organización.", dimension: "II", subscale: "F", inverse: false },
  { id: 29, text: "Trabajar con alguien de otro grupo de esta organización es como trabajar con alguien de otra organización.", dimension: "II", subscale: "F", inverse: true },
  { id: 30, text: "Existe una buena alineación de objetivos entre los distintos niveles jerárquicos.", dimension: "II", subscale: "F", inverse: false },
  // DIMENSIÓN III: ADAPTABILIDAD — Subescala G: Orientación al cambio
  { id: 31, text: "La forma en que hacemos las cosas es muy flexible y fácil de cambiar.", dimension: "III", subscale: "G", inverse: false },
  { id: 32, text: "Respondemos bien a los cambios del entorno.", dimension: "III", subscale: "G", inverse: false },
  { id: 33, text: "Adoptamos continuamente métodos nuevos y mejores para realizar el trabajo.", dimension: "III", subscale: "G", inverse: false },
  { id: 34, text: "Generalmente existe resistencia a las iniciativas que suponen cambios significativos.", dimension: "III", subscale: "G", inverse: true },
  { id: 35, text: "Los diferentes grupos de esta organización cooperan a menudo para introducir cambios.", dimension: "III", subscale: "G", inverse: false },
  // Subescala H: Orientación al cliente
  { id: 36, text: "Los comentarios y recomendaciones de nuestros clientes a menudo producen cambios.", dimension: "III", subscale: "H", inverse: false },
  { id: 37, text: "La información sobre nuestros clientes influye en nuestras decisiones.", dimension: "III", subscale: "H", inverse: false },
  { id: 38, text: "Todos tenemos una comprensión profunda de los deseos y necesidades de nuestro entorno.", dimension: "III", subscale: "H", inverse: false },
  { id: 39, text: "Nuestras decisiones con frecuencia ignoran los intereses de los clientes.", dimension: "III", subscale: "H", inverse: true },
  { id: 40, text: "Fomentamos el contacto directo de nuestra gente con los clientes.", dimension: "III", subscale: "H", inverse: false },
  // Subescala I: Aprendizaje organizacional
  { id: 41, text: "Consideramos el fracaso como una oportunidad para aprender y mejorar.", dimension: "III", subscale: "I", inverse: false },
  { id: 42, text: "Tomar riesgos e innovar son fomentados y recompensados.", dimension: "III", subscale: "I", inverse: false },
  { id: 43, text: "Muchas veces no se aprende de los errores pasados, repitiéndose los mismos problemas.", dimension: "III", subscale: "I", inverse: true },
  { id: 44, text: "El aprendizaje es un objetivo importante en nuestro trabajo cotidiano.", dimension: "III", subscale: "I", inverse: false },
  { id: 45, text: "Nos aseguramos de que la perspectiva del conjunto esté coordinada con las perspectivas de los detalles.", dimension: "III", subscale: "I", inverse: false },
  // DIMENSIÓN IV: MISIÓN — Subescala J: Dirección estratégica
  { id: 46, text: "Esta organización tiene un proyecto y una orientación a largo plazo.", dimension: "IV", subscale: "J", inverse: false },
  { id: 47, text: "Nuestra estrategia sirve de ejemplo a otras organizaciones.", dimension: "IV", subscale: "J", inverse: false },
  { id: 48, text: "Esta organización tiene una misión clara que le otorga significado y rumbo a nuestro trabajo.", dimension: "IV", subscale: "J", inverse: false },
  { id: 49, text: "Esta organización tiene una clara estrategia de cara al futuro.", dimension: "IV", subscale: "J", inverse: false },
  { id: 50, text: "La orientación estratégica de esta organización no me resulta clara.", dimension: "IV", subscale: "J", inverse: true },
  // Subescala K: Metas y objetivos
  { id: 51, text: "Existe un amplio acuerdo sobre las metas a conseguir.", dimension: "IV", subscale: "K", inverse: false },
  { id: 52, text: "Los líderes y directivos fijan metas ambiciosas pero realistas.", dimension: "IV", subscale: "K", inverse: false },
  { id: 53, text: "La dirección nos conduce hacia los objetivos que tratamos de conseguir.", dimension: "IV", subscale: "K", inverse: false },
  { id: 54, text: "Comparamos continuamente nuestro progreso con los objetivos fijados.", dimension: "IV", subscale: "K", inverse: false },
  { id: 55, text: "Las personas de esta organización comprenden lo que hay que hacer para tener éxito a largo plazo.", dimension: "IV", subscale: "K", inverse: false },
  // Subescala L: Visión
  { id: 56, text: "Tenemos una visión compartida de cómo será esta organización en el futuro.", dimension: "IV", subscale: "L", inverse: false },
  { id: 57, text: "Los líderes y directivos tienen una perspectiva a largo plazo.", dimension: "IV", subscale: "L", inverse: false },
  { id: 58, text: "El pensamiento a corto plazo compromete con frecuencia nuestra visión a largo plazo.", dimension: "IV", subscale: "L", inverse: true },
  { id: 59, text: "Nuestra visión genera entusiasmo y motivación entre nosotros.", dimension: "IV", subscale: "L", inverse: false },
  { id: 60, text: "Podemos satisfacer las demandas a corto plazo sin comprometer nuestra visión a largo plazo.", dimension: "IV", subscale: "L", inverse: false },
];

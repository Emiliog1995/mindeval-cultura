export interface Bateria {
  key: string;
  nombre: string;
  descripcion: string;
  reactivos_ejemplo: number; // cantidad orientativa de la versión de ejemplo, no el banco real
}

// ⚠️ PLACEHOLDER — reemplazar por el diccionario real del kit de baterías
// psicométricas (banco de reactivos + normas/baremo por batería) cuando
// exista. Mientras tanto, sirve para probar el flujo de la Etapa 4
// (Pruebas Psicométricas) de punta a punta con datos de ejemplo.
//
// Para integrar el banco real: copiar su diccionario a este archivo (o a uno
// nuevo) y actualizar este único import donde se use BATERIAS_EJEMPLO — el
// resto del módulo no depende de esta lista.
export const BATERIAS_EJEMPLO: Bateria[] = [
  {
    key: "razonamiento_numerico",
    nombre: "Razonamiento numérico",
    descripcion: "Series numéricas, porcentajes, interpretación de datos",
    reactivos_ejemplo: 20,
  },
  {
    key: "razonamiento_verbal",
    nombre: "Razonamiento verbal",
    descripcion: "Analogías, comprensión lectora, vocabulario técnico",
    reactivos_ejemplo: 20,
  },
  {
    key: "personalidad_16pf",
    nombre: "Personalidad 16PF · Dominancia",
    descripcion: "Rasgos de personalidad relevantes al cargo (16 factores de Cattell)",
    reactivos_ejemplo: 40,
  },
  {
    key: "estabilidad_emocional",
    nombre: "Estabilidad emocional",
    descripcion: "Tolerancia a la frustración y manejo de presión",
    reactivos_ejemplo: 15,
  },
  {
    key: "integridad_laboral",
    nombre: "Integridad laboral",
    descripcion: "Honestidad, cumplimiento de normas, riesgo de conducta contraproducente",
    reactivos_ejemplo: 15,
  },
];

// ⚠️ PLACEHOLDER — 3 reactivos de ejemplo (escala Likert 1-5) por batería,
// solo para que el candidato pueda rendir una prueba de punta a punta desde
// /seleccion/prueba/[token] mientras no exista el banco real. No son
// reactivos psicométricos validados — reemplazar junto con BATERIAS_EJEMPLO.
export const ITEMS_EJEMPLO: Record<string, string[]> = {
  razonamiento_numerico: [
    "Interpreto con facilidad tablas y gráficos con datos numéricos.",
    "Puedo calcular porcentajes y proporciones sin apoyo de calculadora.",
    "Identifico rápidamente patrones en series de números.",
  ],
  razonamiento_verbal: [
    "Entiendo con facilidad textos técnicos extensos.",
    "Puedo identificar la idea principal de un párrafo complejo rápidamente.",
    "Tengo un vocabulario amplio para mi área profesional.",
  ],
  personalidad_16pf: [
    "Prefiero tomar la iniciativa en situaciones grupales.",
    "Me siento cómodo expresando desacuerdo con una decisión.",
    "Disfruto asumir posiciones de liderazgo informal.",
  ],
  estabilidad_emocional: [
    "Mantengo la calma bajo presión de tiempo.",
    "No me afectan demasiado las críticas a mi trabajo.",
    "Me recupero rápido después de un contratiempo laboral.",
  ],
  integridad_laboral: [
    "Reportaría un error propio aunque nadie lo hubiera notado.",
    "Sigo las normas de la empresa incluso cuando nadie supervisa.",
    "Considero que la honestidad es más importante que el resultado.",
  ],
};

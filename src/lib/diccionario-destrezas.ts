export type TipoDestreza = 'D' | 'P' | 'C'

export interface Destreza {
  codigo: string
  nombre: string
  tipo: TipoDestreza
  descripcion: string
}

export const DESTREZAS: Destreza[] = [
  // D — Datos
  { codigo: 'D1',  tipo: 'D', nombre: 'Lectura comprensiva',          descripcion: 'Leer y entender información escrita en documentos de trabajo.' },
  { codigo: 'D2',  tipo: 'D', nombre: 'Escritura',                    descripcion: 'Comunicar información por escrito de forma clara y efectiva.' },
  { codigo: 'D3',  tipo: 'D', nombre: 'Pensamiento analítico',        descripcion: 'Analizar y descomponer información en partes para entender causas y efectos.' },
  { codigo: 'D4',  tipo: 'D', nombre: 'Pensamiento conceptual',       descripcion: 'Identificar patrones y conexiones entre situaciones que no son evidentes.' },
  { codigo: 'D5',  tipo: 'D', nombre: 'Pensamiento crítico',          descripcion: 'Evaluar alternativas e información de forma objetiva para tomar decisiones.' },
  { codigo: 'D6',  tipo: 'D', nombre: 'Recopilación de información',  descripcion: 'Identificar y obtener datos necesarios para realizar una actividad.' },
  { codigo: 'D7',  tipo: 'D', nombre: 'Organización de información',  descripcion: 'Encontrar formas de estructurar y clasificar datos.' },
  { codigo: 'D8',  tipo: 'D', nombre: 'Síntesis / resumen',           descripcion: 'Resumir información de diversas fuentes en conclusiones claras.' },
  { codigo: 'D9',  tipo: 'D', nombre: 'Detección de problemas',       descripcion: 'Identificar la naturaleza de los problemas antes de tomar acción.' },
  { codigo: 'D10', tipo: 'D', nombre: 'Identificación de causas',     descripcion: 'Reconocer la causa raíz que origina un problema.' },
  { codigo: 'D11', tipo: 'D', nombre: 'Generación de soluciones',     descripcion: 'Proponer alternativas creativas para resolver problemas.' },
  { codigo: 'D12', tipo: 'D', nombre: 'Evaluación de alternativas',   descripcion: 'Analizar los pros y contras de cada opción antes de decidir.' },
  { codigo: 'D13', tipo: 'D', nombre: 'Planificación y gestión',      descripcion: 'Determinar metas, prioridades y acciones para cumplir un plan.' },
  { codigo: 'D14', tipo: 'D', nombre: 'Priorización',                 descripcion: 'Ordenar actividades según su importancia y urgencia.' },
  { codigo: 'D15', tipo: 'D', nombre: 'Cálculo',                      descripcion: 'Realizar operaciones matemáticas para producir resultados.' },
  { codigo: 'D16', tipo: 'D', nombre: 'Estadística',                  descripcion: 'Analizar datos usando métodos estadísticos descriptivos e inferenciales.' },
  { codigo: 'D17', tipo: 'D', nombre: 'Auditoría',                    descripcion: 'Evaluar y verificar procesos, registros o sistemas.' },
  { codigo: 'D18', tipo: 'D', nombre: 'Control de presupuesto',       descripcion: 'Gestionar y monitorear gastos e ingresos frente a lo planificado.' },
  // P — Personas
  { codigo: 'P1',  tipo: 'P', nombre: 'Atención al usuario',          descripcion: 'Identificar y satisfacer las necesidades de clientes internos o externos.' },
  { codigo: 'P2',  tipo: 'P', nombre: 'Comunicación oral',            descripcion: 'Transmitir ideas claramente de forma verbal.' },
  { codigo: 'P3',  tipo: 'P', nombre: 'Persuasión',                   descripcion: 'Influir en otros para cambiar su opinión o comportamiento.' },
  { codigo: 'P4',  tipo: 'P', nombre: 'Negociación',                  descripcion: 'Llegar a acuerdos aceptables entre partes con intereses distintos.' },
  { codigo: 'P5',  tipo: 'P', nombre: 'Instrucción',                  descripcion: 'Enseñar o entrenar a otras personas en métodos y procedimientos.' },
  { codigo: 'P6',  tipo: 'P', nombre: 'Supervisión',                  descripcion: 'Guiar y controlar el trabajo de otras personas.' },
  { codigo: 'P7',  tipo: 'P', nombre: 'Liderazgo',                    descripcion: 'Inspirar, motivar y dirigir a otros hacia el logro de objetivos.' },
  { codigo: 'P8',  tipo: 'P', nombre: 'Trabajo en equipo',            descripcion: 'Cooperar efectivamente con otros para alcanzar metas comunes.' },
  { codigo: 'P9',  tipo: 'P', nombre: 'Manejo de conflictos',         descripcion: 'Resolver desacuerdos de forma constructiva.' },
  { codigo: 'P10', tipo: 'P', nombre: 'Relaciones públicas',          descripcion: 'Construir y mantener relaciones positivas con actores externos.' },
  { codigo: 'P11', tipo: 'P', nombre: 'Gestión del desempeño',        descripcion: 'Evaluar y retroalimentar el rendimiento de colaboradores.' },
  { codigo: 'P12', tipo: 'P', nombre: 'Consejería',                   descripcion: 'Brindar orientación y apoyo emocional o profesional a otros.' },
  { codigo: 'P13', tipo: 'P', nombre: 'Entrevista',                   descripcion: 'Obtener información relevante de personas mediante preguntas.' },
  { codigo: 'P14', tipo: 'P', nombre: 'Presentación',                 descripcion: 'Exponer ideas o resultados ante grupos de forma estructurada.' },
  { codigo: 'P15', tipo: 'P', nombre: 'Empatía',                      descripcion: 'Comprender y compartir los sentimientos y perspectivas de otros.' },
  { codigo: 'P16', tipo: 'P', nombre: 'Coaching',                     descripcion: 'Acompañar el desarrollo de competencias de otras personas.' },
  { codigo: 'P17', tipo: 'P', nombre: 'Asistencia humanitaria',       descripcion: 'Atender necesidades básicas de personas en situación de vulnerabilidad.' },
  // C — Cosas
  { codigo: 'C1',  tipo: 'C', nombre: 'Operación de equipos',         descripcion: 'Operar y controlar máquinas, herramientas o vehículos.' },
  { codigo: 'C2',  tipo: 'C', nombre: 'Mantenimiento preventivo',     descripcion: 'Realizar tareas de mantenimiento regular para prevenir fallas.' },
  { codigo: 'C3',  tipo: 'C', nombre: 'Mantenimiento correctivo',     descripcion: 'Reparar equipos o instalaciones cuando presentan fallas.' },
  { codigo: 'C4',  tipo: 'C', nombre: 'Instalación',                  descripcion: 'Montar y poner en funcionamiento equipos o sistemas.' },
  { codigo: 'C5',  tipo: 'C', nombre: 'Diseño',                       descripcion: 'Crear planos, esquemas o prototipos de productos o sistemas.' },
  { codigo: 'C6',  tipo: 'C', nombre: 'Inspección de calidad',        descripcion: 'Verificar que productos o servicios cumplan estándares establecidos.' },
  { codigo: 'C7',  tipo: 'C', nombre: 'Producción',                   descripcion: 'Transformar materias primas en productos terminados.' },
  { codigo: 'C8',  tipo: 'C', nombre: 'Manejo de materiales',         descripcion: 'Almacenar, transportar y distribuir materiales o productos.' },
  { codigo: 'C9',  tipo: 'C', nombre: 'Programación',                 descripcion: 'Escribir código para desarrollar software o automatizar procesos.' },
  { codigo: 'C10', tipo: 'C', nombre: 'Manejo de vehículos',          descripcion: 'Conducir vehículos terrestres, acuáticos o aéreos.' },
  { codigo: 'C11', tipo: 'C', nombre: 'Construcción',                 descripcion: 'Edificar o instalar estructuras físicas.' },
  { codigo: 'C12', tipo: 'C', nombre: 'Instrumentación',              descripcion: 'Calibrar y operar instrumentos de medición o control.' },
  { codigo: 'C13', tipo: 'C', nombre: 'Elaboración de alimentos',     descripcion: 'Preparar y producir alimentos según estándares de calidad.' },
  { codigo: 'C14', tipo: 'C', nombre: 'Trabajo con animales',         descripcion: 'Cuidar, entrenar o atender animales.' },
  { codigo: 'C15', tipo: 'C', nombre: 'Trabajo agrícola',             descripcion: 'Cultivar, cosechar y gestionar producción agrícola.' },
  { codigo: 'C16', tipo: 'C', nombre: 'Trabajo artístico',            descripcion: 'Crear obras o productos con valor estético o artístico.' },
  { codigo: 'C17', tipo: 'C', nombre: 'Aplicación de procedimientos', descripcion: 'Seguir protocolos establecidos para ejecutar tareas estandarizadas.' },
]

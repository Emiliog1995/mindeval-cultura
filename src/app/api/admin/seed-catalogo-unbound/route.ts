import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const NOMBRE_EMPRESA = "FUNDACIÓN UNBOUND ECUADOR";

const CATALOGO = [
  {
    nombre_puesto: "Presidenta y Representante Legal",
    area: "Nacional — Unidad Coordinadora, sucursales y subproyectos",
    supervisado_por: "Asamblea General de Miembros",
    supervisa_a: "Personal técnico, administrativo y operativo de la Unidad Coordinadora y sucursales",
    orden: 1,
    actividades: [
      "Ejercer la representación legal, judicial y extrajudicial de la Fundación en todos los actos públicos, privados y ante los entes de control",
      "Suscribir convenios, contratos y compromisos interinstitucionales orientados a la consecución de los fines de la Fundación",
      "Planificar, convocar y presidir Asambleas Ordinarias y Extraordinarias de la Junta Directiva, y elaborar el informe anual de rendición de cuentas",
      "Elaborar objetivos estratégicos anuales y liderar la construcción, coordinación y supervisión del Plan Operativo Anual (POA) a nivel nacional",
      "Revisar y aprobar la distribución del presupuesto mensual y anual, y las solicitudes de ejecución presupuestaria de todos los fondos",
      "Autorizar transferencias bancarias para liquidación de obligaciones con proveedores, roles, viáticos y reembolsos justificados",
      "Revisar y aprobar transferencias económicas directas a cuentas de familias apadrinadas y jóvenes becados",
      "Liderar los procesos de reclutamiento, contratación formal, evaluación periódica del desempeño y programa anual de SST",
      "Planificar brigadas en territorio para ingreso a nuevas comunidades e inscripción de personas en situación de vulnerabilidad",
      "Revisar y aprobar el cumplimiento de obligaciones tributarias (SRI), patronales (IESS) y municipales en cada localidad",
    ],
  },
  {
    nombre_puesto: "Responsable de Programas Sociales",
    area: "Unidad Coordinadora",
    supervisado_por: "Representante Legal",
    supervisa_a: "Coordinadores de Subproyecto",
    orden: 2,
    actividades: [
      "Crear formatos y controles que faciliten la operatividad de las actividades del programa de apadrinamiento",
      "Desarrollar estrategias operativas para el cumplimiento de los objetivos del programa y difundir la misión de Unbound",
      "Actuar como agente oficial de protección del menor y del adulto mayor, diseñando y aplicando el manual de políticas internas",
      "Gestionar alianzas estratégicas de servicios para las familias apadrinadas, los becados y el equipo",
      "Elaborar el plan operativo anual y la planificación mensual con su respectivo informe de gestión del área social",
      "Realizar giras de trabajo para verificar, monitorear y evaluar la implementación de los procesos en campo",
      "Establecer comunicación efectiva con el Representante Legal y la Unidad Coordinadora para tramitar procesos con familias",
      "Velar por el buen funcionamiento del proyecto en todos los campos del desarrollo social según las 9 características del programa",
    ],
  },
  {
    nombre_puesto: "Evaluador de Programas",
    area: "Comunidades y oficinas a nivel nacional",
    supervisado_por: "Representante Legal",
    supervisa_a: "Ninguno",
    orden: 3,
    actividades: [
      "Identificar programas a evaluar, seleccionar la metodología y diseñar instrumentos y estándares de medición",
      "Diseñar y aplicar dos procesos de evaluación de programas al año que reflejen el impacto en apadrinados, familias y becados",
      "Evaluar la selección y participación de apadrinados, el uso de beneficios y el avance educativo por subproyecto",
      "Visitar como mínimo dos subproyectos al mes para monitorear, evaluar e implementar los procesos en campo",
      "Administrar la base de datos de resultados del programa como insumo para la toma de decisiones",
      "Elaborar informes parciales, totales y de visitas a cada subproyecto, y enviarlos al Representante Legal",
      "Validar procesos de evaluación con el especialista/AT de Sede Unbound y participar en la red de evaluación",
      "Planificar, coordinar y dar seguimiento a talleres formativos del equipo de becados junto con la Encargada de Becas",
    ],
  },
  {
    nombre_puesto: "Especialista de Correspondencia Nacional",
    area: "Unidad Coordinadora / Sede Nacional",
    supervisado_por: "Representante Legal",
    supervisa_a: "Asistente de Correspondencia (supervisión técnico-funcional)",
    orden: 4,
    actividades: [
      "Planificar, coordinar y organizar las actividades de cumplimiento de la correspondencia con alcance mensual, semestral y anual",
      "Gestionar correos nacionales e internacionales con Sede Unbound y canalizar requerimientos a los subproyectos",
      "Revisar y validar cartas y videos cargados al portal asegurando estándares de calidad y protección de datos antes de su aprobación final",
      "Controlar y asegurar el cumplimiento de las 2 cartas regulares obligatorias al año por cada persona apadrinada",
      "Coordinar y supervisar el ciclo fotográfico anual de los apadrinados y fichas disponibles en cada subproyecto",
      "Administrar el portal y el módulo de traducciones, revisar fichas sociales y realizar seguimiento semanal a traductores",
      "Dirigir brigadas de inscripción de nuevos interesados, visitas a comunidades y presentaciones de socialización del programa",
      "Capacitar al equipo de especialistas de correspondencia de subproyectos y brindar mentoría continua a la Asistente de Correspondencia",
    ],
  },
  {
    nombre_puesto: "Contador General",
    area: "Unidad Coordinadora / Contabilidad",
    supervisado_por: "Representante Legal",
    supervisa_a: "Contadora Tesorera y Auxiliar Contable",
    orden: 5,
    actividades: [
      "Recibir, registrar y distribuir las donaciones mensuales de Sede Unbound en el sistema Abila y elaborar la planilla de transferencias a apadrinados",
      "Registrar en Abila débitos bancarios, facturas de gastos operativos, compra de activos fijos, becas y fondos especiales",
      "Elaborar reportes y cuadre de cuentas asignadas, y aplicar el check list contable en cada cierre mensual",
      "Elaborar y enviar a Sede Unbound reportes financieros mensuales: balance general, estado de resultados, conciliaciones y KPI presupuestal",
      "Elaborar y presentar declaraciones tributarias (formularios 101, 103 y 104), validar ATS y mantener el cumplimiento ante el SRI",
      "Elaborar el rol de pagos general, gestionar IESS, SUT del MDT, fondos de reserva, décimos y liquidaciones de personal",
      "Registrar depreciaciones y conciliar el módulo de activos fijos contra el balance de comprobación",
      "Elaborar políticas contables y financieras alineadas con el Manual Financiero de Sede Unbound y las NIIF",
    ],
  },
  {
    nombre_puesto: "Contadora Tesorera",
    area: "Unidad Coordinadora / Contabilidad — Tesorería",
    supervisado_por: "Contador General",
    supervisa_a: "Ninguno",
    orden: 6,
    actividades: [
      "Ejecutar transferencias bancarias para el pago a proveedores, empleados, becarios y apadrinados conforme a la programación de pagos",
      "Controlar los saldos de las cuentas bancarias del proyecto y gestionar la actualización de cuentas para transferencias",
      "Elaborar conciliaciones bancarias mensuales del proyecto y administrar el cuadre mensual de caja chica en Abila",
      "Registrar en Abila las transacciones de débitos bancarios, pagos, facturas y comprobantes de gastos del área de tesorería",
      "Apoyar en la revisión del SRI, emisión del ATS mensual, gestión del IESS, SUT del MDT y registro del rol de pagos",
      "Apoyar la elaboración de los reportes financieros mensuales para Sede Unbound y el presupuesto anual",
      "Apoyar la toma física de activos fijos para inventarios y cubrir ausencias temporales del Contador General y el Auxiliar Contable",
      "Elaborar el plan operativo anual y la planificación mensual del cargo",
    ],
  },
  {
    nombre_puesto: "Auxiliar Contable",
    area: "Unidad Coordinadora / Contabilidad",
    supervisado_por: "Contador General",
    supervisa_a: "Ninguno",
    orden: 7,
    actividades: [
      "Revisar y registrar en Marylink y Abila las facturas de gastos de los subproyectos, comprobantes de diario y retenciones",
      "Revisar y registrar en Marylink y Abila los fondos especiales 51 y 53, y las becas de los subproyectos (Fondo 30)",
      "Revisar, registrar y liquidar las cajas chicas de los subproyectos y la Unidad Coordinadora con sus comprobantes en Marylink y Abila",
      "Revisar, registrar y cerrar adelantos y depósitos de empleados para visitas a apadrinados o traslados de local",
      "Alimentar el Anexo Transaccional Simplificado (ATS) y mantener actualizados los códigos de becados (SPE), proveedores (VE) y empleados (EGU)",
      "Realizar compras de suministros de oficina, controlar pagos a instituciones públicas (SRI, IESS, municipios) y recibir la valija de oficinas",
      "Organizar, clasificar y resguardar la documentación física y digital de soporte que respalda las transacciones procesadas",
      "Participar en la elaboración del presupuesto anual y en el levantamiento físico y etiquetado de activos fijos",
    ],
  },
  {
    nombre_puesto: "Coordinador de Subproyecto",
    area: "Subproyecto y Comunidades / Coordinación Territorial",
    supervisado_por: "Responsable de Programas de la Fundación",
    supervisa_a: "Especialista y Promotora del subproyecto (si aplica en la sucursal); becarios-voluntarios",
    orden: 8,
    actividades: [
      "Elaborar convenios de apadrinamiento con beneficiarios nuevos y aplicar autoevaluaciones del semáforo de orientación de objetivos",
      "Organizar los objetivos del POA y diseñar la agenda mensual de actividades del subproyecto",
      "Planificar y desarrollar talleres formativos, recreativos y lúdicos para familias apadrinadas, jóvenes becados y adultos mayores",
      "Realizar visitas domiciliarias y seguimiento directo a familias en situaciones críticas para la entrega de ayudas especiales",
      "Llenar la ficha social, verificar la información de las familias y organizar expedientes de apadrinados",
      "Elaborar el presupuesto mensual y gestionar solicitudes de fondos específicos (Fondos 10 y 15, intención de padrino y talleres)",
      "Seleccionar proveedores para compras del subproyecto menores a $1.000 y guiar el comité de compras de padres de familia",
      "Preparar reuniones mensuales con líderes comunitarios y elaborar informes periódicos de actividades y ejecución de fondos al responsable de área",
    ],
  },
  {
    nombre_puesto: "Especialista de Correspondencia",
    area: "Subproyecto PCM y comunidades",
    supervisado_por: "Coordinador del Subproyecto o sucursal / Especialista de Correspondencia Nacional",
    supervisa_a: "Ninguno",
    orden: 9,
    actividades: [
      "Revisar la correspondencia y su traducción para el envío digital a los apadrinados del subproyecto",
      "Editar fotografías al formato establecido y verificar que cumplan los requerimientos del manual de correspondencia",
      "Capacitar a apadrinados y familias en elaboración de cartas de presentación, mensajes regulares, cartas de contestación y fotografía anual",
      "Alimentar la base de datos interna de cumplimiento de correspondencia y elaborar los listados de actividades mensuales",
      "Actualizar fichas sociales y datos en el portal por visitas o cambios de información de la familia",
      "Realizar visitas a familias por acompañamiento, inscripciones, solicitudes de información y visita anual",
      "Elaborar la planificación mensual y el informe mensual de actividades del cargo",
      "Gestionar el archivo con toda la información de cada apadrinado y ser responsable de la caja chica del subproyecto",
    ],
  },
  {
    nombre_puesto: "Especialista de Subproyecto",
    area: "Subproyecto (oficina y comunidades)",
    supervisado_por: "Coordinador de Subproyecto / Responsable de Programas Sociales",
    supervisa_a: "Ninguno",
    orden: 10,
    actividades: [
      "Mantener activa la comunicación del apadrinado con su patrocinador mediante el cumplimiento de carta, foto y solicitudes de información",
      "Dar contestación ágil a las solicitudes de información y notas rápidas de cada mes",
      "Capacitar a las familias en la elaboración de correspondencia y la toma de fotografías, y guiarlas en la elaboración de cartas",
      "Visitar a las familias apadrinadas (presencial o virtual) y a las familias candidatas al apadrinamiento",
      "Entregar las e-cartas con su respectiva traducción y gestionar el cumplimiento del envío de la fotografía anual",
      "Elaborar fichas sociales, actualizar datos en el portal y conservar el archivo individual de cada apadrinado",
      "Administrar, registrar y reportar los gastos de caja chica del subproyecto",
      "Elaborar el plan operativo anual y la planificación mensual del cargo",
    ],
  },
  {
    nombre_puesto: "Asistente de Correspondencia",
    area: "Unidad Coordinadora",
    supervisado_por: "Especialista de Correspondencia Nacional / Representante Legal",
    supervisa_a: "Ninguno",
    orden: 11,
    actividades: [
      "Traducir cartas de agradecimiento mensuales, cartas urgentes (presentación, despedida, graduación) y fichas de reemplazo o crecimiento",
      "Editar fotografías al formato 480×640, aprobarlas en el portal y notificar incumplimientos de fechas a los subproyectos",
      "Revisar cartas cargadas al portal y verificar tiempos de registro para evitar retiros por incumplimiento",
      "Llevar la base de tiempos de @cartas por subproyecto y notificar las no enviadas y las no contestadas",
      "Elaborar e imprimir listados de nuevos beneficiados, retirados y @cartas recibidas, y elaborar reportes operativos del área",
      "Acompañar talleres anuales de fotografía de los subproyectos y dar seguimiento a especialistas en cumplimiento de tiempos",
      "Realizar visitas a familias para acompañamiento, inscripciones, solicitudes de información u otras circunstancias",
      "Elaborar el plan operativo anual y la planificación mensual del cargo",
    ],
  },
  {
    nombre_puesto: "Promotora Social",
    area: "Subproyecto (oficina y comunidades)",
    supervisado_por: "Coordinador de Subproyecto",
    supervisa_a: "Ninguno",
    orden: 12,
    actividades: [
      "Apoyar la vinculación y comunicación entre el apadrinado y su padrino mediante el seguimiento de cartas y fotografías",
      "Realizar visitas domiciliarias a familias apadrinadas y candidatas para acompañamiento e inscripción",
      "Apoyar en la capacitación a familias en los procesos de correspondencia y en la elaboración de material didáctico",
      "Colaborar en talleres formativos, recreativos y lúdicos organizados por el subproyecto",
      "Apoyar en la actualización de fichas sociales y datos en el portal del subproyecto",
      "Apoyar en la administración de suministros y en el control de caja chica bajo supervisión del Coordinador",
      "Elaborar informes y reportes de actividades requeridos por el Coordinador del Subproyecto",
      "Participar en reuniones, capacitaciones y planes de seguridad y salud en el trabajo convocados por Unbound",
    ],
  },
];

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SEED_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: empresa, error: empError } = await supabaseAdmin
    .from("empresas_mdt")
    .select("id")
    .ilike("nombre", `%UNBOUND%`)
    .maybeSingle();

  if (empError || !empresa) {
    return NextResponse.json({ error: "Empresa UNBOUND no encontrada en empresas_mdt" }, { status: 404 });
  }

  // Eliminar catálogo previo si existe
  await supabaseAdmin.from("catalogo_puestos").delete().eq("empresa_id", empresa.id);

  const rows = CATALOGO.map((p) => ({
    empresa_id: empresa.id,
    nombre_puesto: p.nombre_puesto,
    area: p.area,
    supervisado_por: p.supervisado_por,
    supervisa_a: p.supervisa_a,
    actividades: p.actividades,
    orden: p.orden,
  }));

  const { error: insertError } = await supabaseAdmin.from("catalogo_puestos").insert(rows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, empresa: NOMBRE_EMPRESA, puestos: rows.length });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const NOMBRE_EMPRESA = "FUNDACIÓN UNBOUND ECUADOR";

const CATALOGO = [
  {
    nombre_puesto: "Presidenta y Representante Legal",
    area: "Nacional — Unidad Coordinadora y sucursales",
    supervisado_por: "Asamblea General de Miembros",
    supervisa_a: "Personal técnico, administrativo y operativo de la UC y sucursales",
    orden: 1,
    actividades: [
      "Ejercer la representación legal, judicial y extrajudicial de la Fundación ante entes públicos, privados y de control",
      "Planificar, convocar y presidir Asambleas Ordinarias y Extraordinarias de la Junta Directiva y rendir cuentas",
      "Elaborar objetivos estratégicos anuales y liderar la construcción del Plan Operativo Anual (POA) general",
      "Revisar y aprobar la distribución del presupuesto mensual y anual, y las solicitudes de ejecución presupuestaria",
      "Autorizar transferencias bancarias para pago de obligaciones, roles, viáticos y reembolsos",
      "Liderar procesos de reclutamiento, contratación formal y evaluación periódica del desempeño del personal",
      "Planificar brigadas en territorio para ingreso a nuevas comunidades e inscripción de familias vulnerables",
      "Revisar y aprobar el cumplimiento de obligaciones tributarias (SRI), patronales (IESS) y municipales",
      "Supervisar compras de bienes y contrataciones, y validar procesos de los Comités de Compras",
      "Validar mediante auditorías de campo que las familias reciban efectivamente el beneficio económico",
    ],
  },
  {
    nombre_puesto: "Responsable de Programas Sociales",
    area: "Unidad Coordinadora",
    supervisado_por: "Coordinador General",
    supervisa_a: "Ninguno",
    orden: 2,
    actividades: [
      "Crear formatos y controles que faciliten la operatividad de las actividades del programa de apadrinamiento",
      "Desarrollar estrategias operativas para el cumplimiento de los objetivos del programa",
      "Actuar como agente oficial de protección del menor y del adulto mayor, diseñando y aplicando el manual de políticas internas",
      "Gestionar alianzas estratégicas de servicios para las familias apadrinadas, los becados y el equipo",
      "Elaborar el plan operativo anual y la planificación mensual con su respectivo informe de gestión",
      "Realizar giras de trabajo para verificar, monitorear y evaluar la implementación de los procesos en campo",
      "Establecer comunicación efectiva con la Coordinación General y la Unidad Coordinadora para tramitar procesos",
      "Velar por el buen funcionamiento del proyecto en todos los campos del desarrollo social según las 9 características",
    ],
  },
  {
    nombre_puesto: "Evaluador de Programas",
    area: "Comunidades y oficinas a nivel nacional",
    supervisado_por: "Coordinadora General",
    supervisa_a: "Ninguno",
    orden: 3,
    actividades: [
      "Identificar programas a evaluar, seleccionar la metodología y diseñar instrumentos de medición",
      "Diseñar y aplicar dos procesos de evaluación de programas al año que reflejen el impacto en apadrinados y familias",
      "Evaluar la selección y participación de apadrinados, y el uso de beneficios orientados al sueño del apadrinado",
      "Visitar como mínimo dos subproyectos al mes para monitorear e implementar los procesos",
      "Administrar la base de datos de resultados del programa como insumo para la toma de decisiones",
      "Elaborar informes parciales y totales de resultados, e informes de visitas a cada subproyecto",
      "Validar procesos de evaluación con el especialista de Kansas y participar en la red de evaluación",
      "Planificar y dar seguimiento a talleres formativos del equipo de becados junto con la Encargada de Becas",
    ],
  },
  {
    nombre_puesto: "Especialista de Correspondencia Nacional",
    area: "Unidad Coordinadora / Sede Nacional",
    supervisado_por: "Coordinador General",
    supervisa_a: "Asistente de Correspondencia y Especialistas de Correspondencia de los subproyectos",
    orden: 4,
    actividades: [
      "Planificar, coordinar y organizar las actividades de cumplimiento de la correspondencia con alcance mensual, semestral y anual",
      "Gestionar correos nacionales e internacionales y canalizar requerimientos a los subproyectos",
      "Revisar y validar cartas y videos de subproyectos asegurando estándares de calidad y protección de datos antes de su aprobación",
      "Controlar el cumplimiento de las 2 cartas regulares obligatorias al año por cada persona apadrinada",
      "Coordinar y supervisar el ciclo fotográfico anual de los apadrinados en cada subproyecto",
      "Administrar el portal y el módulo de traducciones, verificando que todas las cartas sean liberadas",
      "Dirigir brigadas de inscripción de nuevos interesados y visitas a comunidades en proceso de apertura",
      "Capacitar al equipo de especialistas de correspondencia de los subproyectos y brindar mentoría a la Asistente",
    ],
  },
  {
    nombre_puesto: "Contador General",
    area: "Unidad Coordinadora",
    supervisado_por: "Coordinador General",
    supervisa_a: "Contadora Tesorera y Auxiliar Contable",
    orden: 5,
    actividades: [
      "Recibir, registrar y distribuir las donaciones mensuales de Unbound Kansas y elaborar la planilla de transferencias a apadrinados",
      "Revisar y registrar en Abila transacciones de débitos bancarios, facturas de gastos, compra de activos y becas",
      "Elaborar reportes y cuadre de cuentas asignadas para la conciliación y cierre contable mensual",
      "Elaborar y revisar reportes financieros mensuales para Kansas: balance general, estado de resultados y conciliaciones",
      "Validar y emitir ATS mensuales, y declarar impuestos en formularios 101, 103 y 104",
      "Elaborar el rol de pagos general, gestionar IESS, fondos de reserva, décimos y liquidaciones de personal",
      "Registrar depreciaciones y conciliar el módulo de activos fijos contra el balance de comprobación",
      "Elaborar políticas contables y financieras alineadas al manual de Kansas y las NIIF",
    ],
  },
  {
    nombre_puesto: "Auxiliar Contable",
    area: "Unidad Coordinadora",
    supervisado_por: "Contador General",
    supervisa_a: "Ninguno",
    orden: 6,
    actividades: [
      "Revisar y registrar en Marylink facturas de gastos, comprobantes de diario y retenciones de los subproyectos",
      "Revisar y registrar en Marylink los fondos especiales 51 y 53, y las becas (Fondo 30)",
      "Revisar, registrar y liquidar las cajas chicas de los subproyectos y la unidad coordinadora",
      "Revisar, registrar y cerrar adelantos y depósitos de empleados para visitas a apadrinados",
      "Alimentar el Anexo Transaccional Simplificado (ATS) para su declaración mensual",
      "Realizar compras de suministros, controlar pagos a instituciones públicas y archivar documentos originales",
      "Mantener actualizados los códigos de becados (SPE), proveedores (VE) y empleados (EGU) en Excel",
      "Participar en la elaboración del presupuesto anual junto con el equipo de trabajo",
    ],
  },
  {
    nombre_puesto: "Coordinador de Subproyecto",
    area: "Subproyecto MRA y Comunidades / Coordinación Territorial",
    supervisado_por: "Responsable de Programas de la Fundación",
    supervisa_a: "Especialista, Promotora del subproyecto y becarios-voluntarios",
    orden: 7,
    actividades: [
      "Organizar los objetivos del POA y diseñar la agenda mensual de actividades del subproyecto",
      "Planificar y desarrollar talleres formativos, recreativos y lúdicos para familias apadrinadas, jóvenes becados y adultos mayores",
      "Realizar visitas domiciliarias y seguimiento directo a familias en situaciones críticas",
      "Elaborar el presupuesto mensual y gestionar solicitudes de fondos específicos (Fondos 10, 15 y talleres)",
      "Coordinar la compra y entrega de beneficios personalizados y gestionar la actualización de cuentas bancarias",
      "Seleccionar proveedores para compras menores a $1.000 y guiar el comité de compras de padres de familia",
      "Preparar reuniones mensuales con líderes comunitarios y elaborar informes periódicos al responsable de área",
      "Llenar fichas sociales, verificar información de familias y organizar expedientes de apadrinados",
    ],
  },
  {
    nombre_puesto: "Especialista de Correspondencia",
    area: "Subproyecto PCM y comunidades",
    supervisado_por: "Coordinador del subproyecto o sucursal",
    supervisa_a: "Ninguno",
    orden: 8,
    actividades: [
      "Revisar la correspondencia y su traducción para el envío digital a los apadrinados",
      "Editar fotografías y verificar que cumplan los requerimientos del manual de correspondencia",
      "Capacitar a apadrinados y familias en elaboración de cartas de presentación, mensajes regulares y fotografía anual",
      "Alimentar la base de datos interna de cumplimiento de correspondencia de los apadrinados",
      "Actualizar fichas y datos en el portal por visitas o cambios de información de la familia",
      "Realizar visitas a familias por acompañamiento, inscripciones, solicitudes de información y visita anual",
      "Elaborar la planificación mensual y el informe de actividades del mes",
      "Gestionar el archivo con información de cada apadrinado y administrar la caja chica del subproyecto",
    ],
  },
  {
    nombre_puesto: "Promotor Social / Especialista de Subproyecto",
    area: "Subproyecto (oficina y comunidades)",
    supervisado_por: "Responsable de Programas Sociales",
    supervisa_a: "Ninguno",
    orden: 9,
    actividades: [
      "Mantener activa la comunicación del apadrinado con su patrocinador mediante carta, foto y solicitudes de información",
      "Capacitar a las familias en la elaboración de correspondencia y la toma de fotografías",
      "Visitar a las familias apadrinadas (presencial o virtual) y a las familias candidatas al apadrinamiento",
      "Entregar la correspondencia con su traducción a los apadrinados o madres líderes de grupos de apoyo",
      "Elaborar fichas sociales, actualizar datos en el portal y conservar el archivo individual de cada apadrinado",
      "Administrar, registrar y reportar los gastos de caja chica del subproyecto",
      "Elaborar reportes, informes y actualizaciones de información de los apadrinados del subproyecto",
      "Elaborar el plan operativo anual y la planificación mensual del cargo",
    ],
  },
  {
    nombre_puesto: "Asistente de Correspondencia",
    area: "Unidad Coordinadora",
    supervisado_por: "Coordinador General",
    supervisa_a: "Ninguno",
    orden: 10,
    actividades: [
      "Traducir cartas de agradecimiento mensuales, cartas urgentes y fichas de reemplazo o crecimiento del proyecto",
      "Editar fotografías al formato 480×640, aprobarlas en el portal y notificar incumplimientos de fechas",
      "Revisar cartas cargadas al portal y verificar tiempos de registro para evitar retiros por incumplimiento",
      "Llevar la base de tiempos de @cartas por subproyecto y notificar las no enviadas o no contestadas",
      "Elaborar e imprimir listados de nuevos beneficiados, retirados y @cartas recibidas",
      "Acompañar talleres de subproyectos y dar seguimiento a especialistas en cumplimiento de tiempos",
      "Realizar visitas a familias para acompañamiento, inscripciones o solicitudes de información",
      "Elaborar el plan operativo anual y la planificación mensual del cargo",
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

// Banco real del VALANTI (Test de los 5 Valores Humanos — Verdad, Rectitud,
// Paz, Amor, No violencia; © 1997/2001 Ps. Octavio Escobar & PSICOLOGIACIENTIFICA.COM
// / Universidad Sergio Arboleda) — 30 ítems de elección forzada, extraídos de
// las fórmulas reales del Excel fuente ("HOJA DE CALIFICACION VALANTI.xlsx",
// hojas "HOJA DE CALIFICACION" y ".") y del texto real del cuestionario
// ("HOJA DE RESPUESTAS VALANTI (1).doc"), no adivinados.
//
// Cada ítem presenta 2 frases (fraseA / fraseB) y el candidato reparte 3
// puntos entre ambas — las únicas combinaciones válidas son 3-0, 2-1, 1-2,
// 0-3 (regla explícita del cuestionario original). El puntaje de fraseA es
// el valor "directo" que se registra; el de fraseB es siempre su complemento
// (3 - fraseA). Cada ítem carga sobre 2 de las 5 escalas a la vez: fraseA
// suma directo a escalaFraseA, fraseB suma directo a escalaFraseB — extraído
// literalmente de qué celda (B/F = directo, C/G = 3-directo) entra en cada
// fórmula de suma por escala (J4:N4 de "HOJA DE CALIFICACION"). Validado
// end-to-end: con las respuestas reales del candidato ejemplo del Excel, esta
// tabla reproduce exactamente los "Puntajes directos" 18/16/15/15/26.
//
// Baremo real ("Promedio Normas nacionales" / "Desviación Standar Normas
// nacionales", celdas I2:N3): media y desviación estándar por escala, usadas
// para el puntaje estándar (tipo T, media 50 / DE 10) — NO es un decatipo
// 1-10. Ver mindeval-scoring.ts para la fórmula ROUND(((bruto-media)/de)*10+50).
//
// ⚠️ Nota de fidelidad: las fórmulas J6:N6 del Excel original (que calculan
// ese puntaje estándar) tienen un bug de copiado verificado en el XML — es
// una "shared formula" que en Verdad usa correctamente su propia media/DE,
// pero en Rectitud, Paz, Amor y No violencia las 4 reutilizan por error la
// constante de Rectitud (21.05/4.44) en vez de la suya propia. Aquí se usa el
// baremo correcto (la media/DE propia de cada escala, que sí está completa y
// correcta en I2:N3) — decisión confirmada con el usuario, no una corrección
// silenciosa. Con el bug, el candidato ejemplo del Excel obtenía Paz=36/Amor=36;
// con el baremo correcto da Paz=46/Amor=47 — diferencia real de hasta 14 puntos.
//
// Niveles de interpretación (0/24/34/44/54/64/74 → Muy bajo…Muy alto) y los 35
// textos interpretativos (5 escalas × 7 niveles) son literales de la hoja ".".
// Los mensajes de "área más/menos importante" (basados en MAX/MIN de los 5
// puntajes estándar) también son literales de las fórmulas A35/G10:K11.

export type EscalaVALANTI = "verdad" | "rectitud" | "paz" | "amor" | "no_violencia";

export interface ItemVALANTI {
  num: number;
  fraseA: string;
  fraseB: string;
  escalaFraseA: EscalaVALANTI;
  escalaFraseB: EscalaVALANTI;
}

export const ITEMS_VALANTI: ItemVALANTI[] = [
  { num: 1, fraseA: "Muestro dedicación a las personas que amo", fraseB: "Actúo con perseverancia", escalaFraseA: "amor", escalaFraseB: "rectitud" },
  { num: 2, fraseA: "Soy tolerante", fraseB: "Prefiero actuar con ética", escalaFraseA: "amor", escalaFraseB: "rectitud" },
  { num: 3, fraseA: "Al pensar, utilizo mi intuición o \"sexto sentido\"", fraseB: "Me siento una persona digna", escalaFraseA: "verdad", escalaFraseB: "paz" },
  { num: 4, fraseA: "Logro buena concentración mental", fraseB: "Perdono todas las ofensas de cualquier persona", escalaFraseA: "paz", escalaFraseB: "no_violencia" },
  { num: 5, fraseA: "Normalmente razono mucho", fraseB: "Me destaco por el liderazgo en mis acciones", escalaFraseA: "verdad", escalaFraseB: "rectitud" },
  { num: 6, fraseA: "Pienso con integridad", fraseB: "Me coloco objetivos y metas en mi vida personal", escalaFraseA: "verdad", escalaFraseB: "rectitud" },
  { num: 7, fraseA: "Soy una persona de iniciativa", fraseB: "En mi trabajo normalmente soy curioso", escalaFraseA: "rectitud", escalaFraseB: "verdad" },
  { num: 8, fraseA: "Doy amor", fraseB: "Para pensar hago síntesis de las distintas ideas", escalaFraseA: "amor", escalaFraseB: "verdad" },
  { num: 9, fraseA: "Me siento en calma", fraseB: "Pienso con veracidad", escalaFraseA: "no_violencia", escalaFraseB: "verdad" },
  { num: 10, fraseA: "Irrespetar la propiedad", fraseB: "Sentir inquietud", escalaFraseA: "no_violencia", escalaFraseB: "paz" },
  { num: 11, fraseA: "Ser irresponsable", fraseB: "Ser desconsiderado hacia cualquier persona", escalaFraseA: "rectitud", escalaFraseB: "no_violencia" },
  { num: 12, fraseA: "Caer en contradicciones al pensar", fraseB: "Sentir intolerancia", escalaFraseA: "verdad", escalaFraseB: "paz" },
  { num: 13, fraseA: "Ser violento", fraseB: "Actuar con cobardía", escalaFraseA: "no_violencia", escalaFraseB: "rectitud" },
  { num: 14, fraseA: "Sentirse presumido", fraseB: "Generar divisiones y discordia entre los seres humanos", escalaFraseA: "paz", escalaFraseB: "no_violencia" },
  { num: 15, fraseA: "Ser cruel", fraseB: "Sentir ira", escalaFraseA: "amor", escalaFraseB: "paz" },
  { num: 16, fraseA: "Pensar con confusión", fraseB: "Tener odio en el corazón", escalaFraseA: "verdad", escalaFraseB: "amor" },
  { num: 17, fraseA: "Decir blasfemias", fraseB: "Ser escandaloso", escalaFraseA: "amor", escalaFraseB: "paz" },
  { num: 18, fraseA: "Crear desigualdades entre los seres humanos", fraseB: "Apasionarse por una idea", escalaFraseA: "no_violencia", escalaFraseB: "verdad" },
  { num: 19, fraseA: "Sentirse inconstante", fraseB: "Crear rivalidad hacia otros", escalaFraseA: "paz", escalaFraseB: "amor" },
  { num: 20, fraseA: "Pensamientos irracionales", fraseB: "Traicionar a un desconocido", escalaFraseA: "verdad", escalaFraseB: "no_violencia" },
  { num: 21, fraseA: "Ostentar las riquezas materiales", fraseB: "Sentirse infeliz", escalaFraseA: "rectitud", escalaFraseB: "paz" },
  { num: 22, fraseA: "Entorpecer la cooperación entre los seres humanos", fraseB: "La maldad", escalaFraseA: "no_violencia", escalaFraseB: "amor" },
  { num: 23, fraseA: "Odiar a cualquier ser de la naturaleza", fraseB: "Hacer distinciones entre las personas", escalaFraseA: "no_violencia", escalaFraseB: "verdad" },
  { num: 24, fraseA: "Sentirse intranquilo", fraseB: "Ser infiel", escalaFraseA: "paz", escalaFraseB: "rectitud" },
  { num: 25, fraseA: "Tener la mente dispersa", fraseB: "Mostrar apatía al pensar", escalaFraseA: "paz", escalaFraseB: "verdad" },
  { num: 26, fraseA: "La injusticia", fraseB: "Sentirse angustiado", escalaFraseA: "rectitud", escalaFraseB: "paz" },
  { num: 27, fraseA: "Vengarse de los que odian a todo el mundo", fraseB: "Vengarse del que hace daño a un familiar", escalaFraseA: "no_violencia", escalaFraseB: "amor" },
  { num: 28, fraseA: "Usar abusivamente el poder", fraseB: "Distraerse", escalaFraseA: "rectitud", escalaFraseB: "paz" },
  { num: 29, fraseA: "Ser desagradecido con los que ayudan", fraseB: "Ser egoísta con todos", escalaFraseA: "rectitud", escalaFraseB: "no_violencia" },
  { num: 30, fraseA: "Cualquier forma de irrespeto", fraseB: "Odiar", escalaFraseA: "no_violencia", escalaFraseB: "amor" },
];

export const NOMBRES_ESCALA_VALANTI: Record<EscalaVALANTI, string> = {
  verdad: "Verdad",
  rectitud: "Rectitud",
  paz: "Paz",
  amor: "Amor",
  no_violencia: "No violencia",
};

// dominio asociado a cada valor, tal como lo describe el propio Excel fuente
// (parte intelectual/física/emocional/intuitiva/espiritual) — mismo modelo de
// los 5 Valores Humanos (Truth/Right Conduct/Peace/Love/Non-violence).
export const DOMINIO_ESCALA_VALANTI: Record<EscalaVALANTI, string> = {
  verdad: "Parte intelectual",
  rectitud: "Parte física",
  paz: "Parte emocional",
  amor: "Parte intuitiva",
  no_violencia: "Parte espiritual",
};

export const NORMAS_VALANTI: Record<EscalaVALANTI, { media: number; desviacion: number; estandarOrganizacional: number }> = {
  verdad: { media: 15.647945205479452, desviacion: 4.703342348004798, estandarOrganizacional: 50 },
  rectitud: { media: 21.05068493150685, desviacion: 4.444926618525877, estandarOrganizacional: 65 },
  paz: { media: 17.353424657534248, desviacion: 6.608887107851777, estandarOrganizacional: 60 },
  amor: { media: 16.682191780821917, desviacion: 5.412005717762647, estandarOrganizacional: 40 },
  no_violencia: { media: 21.224657534246575, desviacion: 7.194262704638464, estandarOrganizacional: 65 },
};

// umbrales reales de interpretación (columnas A/D/F de la hoja "."), únicos
// para las 5 escalas — no reordenar.
export const NIVELES_VALANTI: { minimo: number; etiqueta: string; asteriscos: string }[] = [
  { minimo: 0, etiqueta: "Muy bajo", asteriscos: "*" },
  { minimo: 24, etiqueta: "Bajo", asteriscos: "**" },
  { minimo: 34, etiqueta: "Promedio Bajo", asteriscos: "***" },
  { minimo: 44, etiqueta: "Promedio", asteriscos: "****" },
  { minimo: 54, etiqueta: "Promedio Alto", asteriscos: "*****" },
  { minimo: 64, etiqueta: "Alto", asteriscos: "******" },
  { minimo: 74, etiqueta: "Muy alto", asteriscos: "*******" },
];

// 35 textos interpretativos literales (5 escalas × 7 niveles, mismo orden que
// NIVELES_VALANTI), extraídos de la hoja "." (columnas G:K, filas 2-8).
export const TEXTOS_NIVEL_VALANTI: Record<EscalaVALANTI, string[]> = {
  verdad: [
    "Muy bajo predominio del valor verdad. La parte intelectual de sus valores es completamente ignorada, sin importar cualidades como veracidad, raciocinio, curiosidad y honestidad intelectual.",
    "Bajo predominio del valor verdad. La parte intelectual de sus valores es ignorada, importándole poco cualidades como veracidad, raciocinio, curiosidad y honestidad intelectual.",
    "El predominio del valor verdad no es fundamental. La parte intelectual de sus valores es puesta en segundo plano, dándole un poco menos importancia a cualidades como veracidad, raciocinio, curiosidad y honestidad intelectual.",
    "El valor verdad está dentro de la norma de la población. La parte intelectual de sus valores está equilibrada, dándole adecuada importancia a cualidades como veracidad, raciocinio, curiosidad y honestidad intelectual.",
    "Valora la verdad un poco más que el resto de la gente. Resalta la parte intelectual de sus valores, dándole buena prioridad a cualidades como veracidad, raciocinio, curiosidad y honestidad intelectual.",
    "Valora la verdad mucho más que el resto de la gente. Resalta la parte intelectual de sus valores, dándole muy buena prioridad a cualidades como veracidad, raciocinio, curiosidad y honestidad intelectual.",
    "Valora la verdad de manera extraordinaria. Resalta fuertemente la parte intelectual de sus valores, dándole total importancia a cualidades como veracidad, raciocinio, curiosidad y honestidad intelectual.",
  ],
  rectitud: [
    "Le otorga muy baja importancia al valor rectitud. La parte física de sus valores es totalmente ignorada, sin importar cualidades como compromiso, confiabilidad, deber, cumplir metas, respeto, responsabilidad, y sacrificio.",
    "Le otorga baja importancia al valor rectitud. La parte física de sus valores es negada, importándole poco cualidades como compromiso, confiabilidad, deber, cumplir metas, respeto, responsabilidad, y sacrificio.",
    "La importancia del valor rectitud no es fundamental. La parte física de sus valores es colocada en segundo plano, dándole un poco menos importancia a cualidades como compromiso, confiabilidad, deber, cumplir metas, respeto, responsabilidad y sacrificio.",
    "El valor rectitud recibe una calificación dentro de lo esperado. La parte física de sus valores se muestra equilibrada, dándole adecuada importancia a cualidades como compromiso, confiabilidad, deber, cumplir metas, respeto, responsabilidad y sacrificio.",
    "Le da un poco más de importancia a la rectitud que el resto de la población. Destaca el área física, dándole buena prioridad a cualidades como compromiso, confiabilidad, deber, cumplir metas, respeto, responsabilidad y sacrificio.",
    "La importancia que le da a la rectitud es más alta que lo normal. Destaca el área física, dándole muy buena prioridad a cualidades como compromiso, confiabilidad, deber, cumplir metas, respeto, responsabilidad, y sacrificio.",
    "Le de importancia a la rectitud de manera extraordinaria. Destaca de manera extraordinaria el área física, dándole total importancia a cualidades como compromiso, confiabilidad, deber, cumplir metas, respeto, responsabilidad, y sacrificio.",
  ],
  paz: [
    "Muy baja valoración de la paz. La parte emocional de sus valores es completamente ignorada, sin importar cualidades como calma, concentración, paciencia, reflexión, satisfacción, y silencio interior.",
    "Baja valoración de la paz. La parte emocional de sus valores es ignorada, importándole poco cualidades como calma, concentración, paciencia, reflexión, satisfacción, y silencio interior.",
    "La valoración de la paz no es tan prioritaria. La parte emocional de sus valores es puesta en segundo plano, dándole un poco menos importancia a cualidades como calma, concentración, paciencia, reflexión, satisfacción, y silencio interior.",
    "La valoración de la paz está dentro de la norma de la población. La parte emocional de sus valores está equilibrada, dándole adecuada importancia a cualidades como calma, concentración, paciencia, reflexión, satisfacción, y silencio interior.",
    "La valoración de la paz es más alta que lo normal. Resalta la parte emocional de sus valores, dándole buena prioridad a cualidades como calma, concentración, paciencia, reflexión, satisfacción, y silencio interior.",
    "La valoración de la paz es mucho más alta que lo normal. Resalta la parte emocional de sus valores, dándole muy buena prioridad a cualidades como calma, concentración, paciencia, reflexión, satisfacción, y silencio interior.",
    "Valora la paz de manera extraordinaria. Resalta fuertemente la parte emocional de sus valores, dándole total importancia a cualidades como calma, concentración, paciencia, reflexión, satisfacción, y silencio interior.",
  ],
  amor: [
    "Muy bajo impacto en su vida del valor amor. La parte intuitiva de sus valores es completamente ignorada, sin importar cualidades como amabilidad, amistad, ayuda, apoyo, compartir, compasión, cuidado, perdón, simpatía y tolerancia.",
    "Bajo impacto en su vida del valor amor. La parte intuitiva de sus valores es ignorada, importándole poco cualidades como amabilidad, amistad, ayuda, apoyo, compartir, compasión, cuidado, perdón, simpatía y tolerancia.",
    "El impacto del valor amor no es fundamental. La parte intuitiva de sus valores es puesta en segundo plano, dándole un poco menos importancia a cualidades como amabilidad, amistad, ayuda, apoyo, compartir, compasión, cuidado, perdón, simpatía y tolerancia.",
    "El valor amor le impacta dentro de la norma del grupo. La parte intuitiva de sus valores está equilibrada, dándole adecuada importancia a cualidades como amabilidad, amistad, ayuda, apoyo, compartir, compasión, cuidado, perdón, simpatía y tolerancia.",
    "Impacta en su vida el amor un poco más que al resto de la gente. Resalta la parte intuitiva de sus valores, dándole buena prioridad a cualidades como amabilidad, amistad, ayuda, apoyo, compartir, compasión, cuidado, perdón, simpatía y tolerancia.",
    "El amor impacta su vida mucho más que al resto de la gente. Resalta la parte intuitiva de sus valores, dándole muy buena prioridad a cualidades como amabilidad, amistad, ayuda, apoyo, compartir, compasión, cuidado, perdón, simpatía y tolerancia.",
    "Valora el amor de manera extraordinaria. Resalta fuertemente la parte intuitiva de sus valores, dándole total importancia a cualidades como amabilidad, amistad, ayuda, apoyo, compartir, compasión, cuidado, perdón, simpatía y tolerancia.",
  ],
  no_violencia: [
    "Muy bajo predominio del valor no violencia. La parte espiritual de sus valores es completamente ignorada, sin importar cualidades como amor universal, aprecio por las demás culturas y creencias, hermandad, justicia social y unidad humana.",
    "Bajo predominio del valor no violencia. La parte espiritual de sus valores es ignorada, importándole poco cualidades como amor universal, aprecio por las demás culturas y creencias, hermandad, justicia social y unidad humana.",
    "El valor no violencia no es básico. La parte espiritual de valores es puesta en segundo plano, dándole menos importancia a cualidades como amor universal, aprecio por las demás culturas y creencias, hermandad, justicia social y unidad humana.",
    "El valor no violencia está dentro de lo normal. La parte espiritual de sus valores está equilibrada, dándole adecuada importancia a cualidades como amor universal, aprecio por las demás culturas y creencias, hermandad, justicia social y unidad humana.",
    "Valora la no violencia un poco más que el resto de la gente. Resalta la parte espiritual de sus valores, dándole buena prioridad a cualidades como amor universal, aprecio por las demás culturas y creencias, hermandad, justicia social y unidad humana.",
    "Valora la no violencia mucho más que el resto de la gente. Resalta la parte espiritual de sus valores, dándole muy buena prioridad a cualidades como amor universal, aprecio por las demás culturas y creencias, hermandad, justicia social y unidad humana.",
    "Valora la no violencia de manera extraordinaria. Resalta fuertemente la parte espiritual de sus valores, dándole total importancia a cualidades como amor universal, aprecio por las demás culturas y creencias, hermandad, justicia social y unidad humana.",
  ],
};

// mensajes literales de la fórmula A35 ("área más importante" usa MAX de los
// 5 puntajes estándar; "área menos importante" usa MIN) — celdas G10:K11 de
// la hoja ".".
export const MENSAJE_AREA_MAS_IMPORTANTE: Record<EscalaVALANTI, (nombre: string) => string> = {
  verdad: (nombre) => `El área intelectual (Valor VERDAD) es la más importante para ${nombre}.`,
  rectitud: (nombre) => `El área física (Valor RECTITUD) es la más importante para ${nombre}.`,
  paz: (nombre) => `El área emocional (Valor PAZ) es la más importante para ${nombre}.`,
  amor: (nombre) => `El área intuitiva (Valor AMOR) es la más importante para ${nombre}.`,
  no_violencia: (nombre) => `El área espiritual (Valor NO VIOLENCIA) es la más importante para ${nombre}.`,
};

export const MENSAJE_AREA_MENOS_IMPORTANTE: Record<EscalaVALANTI, string> = {
  verdad: "El área menos importante es la intelectual (Valor VERDAD)",
  rectitud: "El área menos importante es la física (Valor RECTITUD)",
  paz: "El área menos importante es la emocional (Valor PAZ)",
  amor: "El área menos importante es la intuitiva (Valor AMOR)",
  no_violencia: "El área menos importante es la espiritual (Valor NO VIOLENCIA)",
};

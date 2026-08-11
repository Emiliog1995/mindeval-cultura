// Banco real del KOSTICK PEP-2 (Perfil de Estilo Personal) — 90 pares de
// frases de elección forzada, cada uno mapeado a los 2 factores reales (uno
// si se elige a, otro si se elige b), extraídos de las fórmulas del Excel
// fuente (Resultados-Test KOSTICK- María José Oña.xlsx, hoja CONTAR), no
// adivinados. 20 factores en total, agrupados en Necesidades / Papeles /
// Modo de Vida / Naturaleza Social / Adaptación al Trabajo.
//
// Calificación: ipsativa — cada ítem suma 1 punto al factor de la opción
// elegida. El puntaje de cada factor es simplemente cuántas veces salió
// elegido (0 a ~9, según cuántos ítems cargan a ese factor). No se encontró
// una tabla de normas bruto->decatipo para Kostick en el archivo fuente
// (el ejemplo solo mostraba el conteo interpretado directamente), así que
// por ahora se reporta el conteo crudo, no un decatipo.

export type FactorKostick = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "I" | "K" | "L" | "N" | "O" | "P" | "R" | "S" | "T" | "V" | "W" | "X" | "Z";

export interface ItemKostick {
  num: number;
  a: string;
  b: string;
  factorA: FactorKostick;
  factorB: FactorKostick;
}

export const ITEMS_KOSTICK: ItemKostick[] = [
  { num: 1, a: "Soy trabajador tenaz", b: "No soy voluble", factorA: "G", factorB: "Z" },
  { num: 2, a: "Me gusta hacer el trabajo mejor que los demás", b: "Me gusta seguir con lo que he empezado hasta terminarlo", factorA: "A", factorB: "N" },
  { num: 3, a: "Me gusta enseñar a la gente cómo hacer las cosas", b: "Me gusta hacer las cosas lo mejor posible", factorA: "P", factorB: "A" },
  { num: 4, a: "Me gusta hacer las cosas graciosas", b: "Me gusta decir a la gente lo que tiene que hacer", factorA: "X", factorB: "P" },
  { num: 5, a: "Me gusta pertenecer a grupos", b: "Me gusta sobresalir en los grupos", factorA: "B", factorB: "X" },
  { num: 6, a: "Me gusta tener un amigo íntimo", b: "En  un  grupo  me  gusta  tener varios amigos", factorA: "O", factorB: "B" },
  { num: 7, a: "Yo cambio rápidamente cuando lo creo necesario", b: "Yo intento tener amigos íntimos", factorA: "E", factorB: "O" },
  { num: 8, a: "Me gusta “pagar con la misma moneda” cuando alguien me ofende", b: "Me gusta hacer cosas nuevas y diferentes", factorA: "K", factorB: "E" },
  { num: 9, a: "Quiero que mi jefe me estime", b: "Me gusta decir a la gente cuando esta equivocada", factorA: "F", factorB: "K" },
  { num: 10, a: "Me gusta seguir las instrucciones que me dan", b: "Me gusta agradar a mis superiores", factorA: "W", factorB: "F" },
  { num: 11, a: "Me esfuerzo mucho", b: "Soy ordenado, pongo todo en su lugar", factorA: "G", factorB: "C" },
  { num: 12, a: "Yo logro que la gente haga lo que tiene que hacer", b: "No me altero fácilmente", factorA: "L", factorB: "Z" },
  { num: 13, a: "Me gusta decir al grupo lo que tiene que hacer", b: "Cuando comienzo un trabajo, no lo dejo hasta terminarlo", factorA: "P", factorB: "N" },
  { num: 14, a: "Me gusta ser animado e interesante", b: "Yo quiero ser una persona rica y famosa", factorA: "X", factorB: "A" },
  { num: 15, a: "Me gusta identificarme con grupos", b: "Me gusta ayudar a las personas a que tomen una conclusión", factorA: "B", factorB: "P" },
  { num: 16, a: "Me preocupa  cuando  alguien  no me estima", b: "Me gusta  que  la gente  note  mi presencia", factorA: "O", factorB: "X" },
  { num: 17, a: "Me gusta experimentar cosas nuevas", b: "Prefiero trabajar con otras personas que solo", factorA: "E", factorB: "B" },
  { num: 18, a: "Algunas veces culpo a otros cuando las cosas salen mal", b: "Me molesta cuando le soy antipático a alguien.", factorA: "K", factorB: "O" },
  { num: 19, a: "Me gusta complacer a mis superiores", b: "Me gusta experimentar trabajos nuevos y diferentes", factorA: "F", factorB: "E" },
  { num: 20, a: "Me gusta que me den instrucciones precisas para hacer un trabajo", b: "Me gustaría decírselo a la gente cuando me molestan", factorA: "W", factorB: "K" },
  { num: 21, a: "Siempre trabajo intensamente", b: "Me gusta hacer las cosas una por una detalladamente", factorA: "G", factorB: "D" },
  { num: 22, a: "Soy un buen dirigente", b: "Yo organizo muy bien mi trabajo", factorA: "L", factorB: "C" },
  { num: 23, a: "Me enfado con facilidad", b: "Soy lento para la toma de decisiones", factorA: "I", factorB: "Z" },
  { num: 24, a: "Me gusta trabajar en varias actividades al mismo tiempo", b: "Cuando estoy en un grupo, me gusta estar callado", factorA: "X", factorB: "N" },
  { num: 25, a: "Me gusta que me inviten", b: "Me gusta hacer las cosas mejor que los demás", factorA: "B", factorB: "A" },
  { num: 26, a: "Me gusta tener amigos íntimos", b: "Me gusta aconsejar a los demás", factorA: "O", factorB: "P" },
  { num: 27, a: "Me gusta hacer cosas nuevas y diferentes", b: "Me gusta hablar de la forma como obtengo mis éxitos", factorA: "E", factorB: "X" },
  { num: 28, a: "Cuando tengo razón me gusta luchar por ella", b: "Me gusta permanecer a un grupo", factorA: "K", factorB: "B" },
  { num: 29, a: "Evito ser diferente a los demás", b: "Intento acercarme mucho a la gente", factorA: "F", factorB: "O" },
  { num: 30, a: "Me gusta que me digan exactamente como hacer mi trabajo", b: "Me aburro fácilmente", factorA: "W", factorB: "E" },
  { num: 31, a: "Trabajo intensamente", b: "Pienso y planeo mucho", factorA: "G", factorB: "R" },
  { num: 32, a: "Yo dirijo al grupo", b: "Los pequeños detalles me interesan", factorA: "L", factorB: "D" },
  { num: 33, a: "Tomo decisiones fácil y rápidamente", b: "Tengo mis cosas limpias y ordenadas", factorA: "I", factorB: "C" },
  { num: 34, a: "Hago la cosas con rapidez", b: "Yo casi nunca me enojo ni me pongo triste", factorA: "T", factorB: "Z" },
  { num: 35, a: "Me gusta ser parte del grupo.", b: "Me gusta hacer un solo trabajo a la vez.", factorA: "B", factorB: "N" },
  { num: 36, a: "Intento hacer amigos íntimos.", b: "Yo pongo empeño en ser el mejor.", factorA: "O", factorB: "A" },
  { num: 37, a: "Me gustan los nuevos modelos en trajes y coches.", b: "Me gusta ser responsable por otros.", factorA: "E", factorB: "P" },
  { num: 38, a: "Me gusta discutir.", b: "Me gusta que me pongan atención.", factorA: "K", factorB: "X" },
  { num: 39, a: "Me gusta agradar a mis superiores.", b: "Estoy interesado en ser parte del grupo.", factorA: "F", factorB: "B" },
  { num: 40, a: "Me gusta apegarme a las reglas establecidas.", b: "Me gusta que la gente me conozca muy bien.", factorA: "W", factorB: "O" },
  { num: 41, a: "Me esfuerzo mucho.", b: "Soy muy amigable.", factorA: "G", factorB: "S" },
  { num: 42, a: "La gente piensa que soy un buen “dirigente”.", b: "Pienso las cosas con cuidado y detenidamente.", factorA: "L", factorB: "R" },
  { num: 43, a: "A menudo me arriesgo.", b: "Me gusta darle importancia a las cosas joviales.", factorA: "I", factorB: "D" },
  { num: 44, a: "La gente piensa que trabajo con rapidez.", b: "La gente piensa que tengo mis cosas limpias y ordenadas.", factorA: "T", factorB: "C" },
  { num: 45, a: "Me gusta jugar y hacer deporte.", b: "Soy muy agradable.", factorA: "V", factorB: "Z" },
  { num: 46, a: "Me gusta que la gente sea unida y sea amistosa.", b: "Siempre trato de terminar un trabajo difícil.", factorA: "O", factorB: "N" },
  { num: 47, a: "Me gusta experimentar y probar nuevas cosas.", b: "Me gusta hacer bien un trabajo difícil.", factorA: "E", factorB: "A" },
  { num: 48, a: "Me gusta que me traten justamente.", b: "Me gusta decir a los demás cómo hacer las cosas.", factorA: "K", factorB: "P" },
  { num: 49, a: "Me gusta hacer aquello que esperan de mi.", b: "Me gusta que me pongan atención.", factorA: "F", factorB: "X" },
  { num: 50, a: "Me gusta tener instrucciones precisas para hacer un trabajo.", b: "Me gusta estar con la gente.", factorA: "W", factorB: "B" },
  { num: 51, a: "Siempre trato de hacer mi trabajo perfecto.", b: "Me dicen que soy prácticamente incasable.", factorA: "G", factorB: "V" },
  { num: 52, a: "Soy el tipo “dirigente”", b: "Hago amigos fácilmente", factorA: "L", factorB: "S" },
  { num: 53, a: "Asumo riesgos", b: "Pienso mucho.", factorA: "I", factorB: "R" },
  { num: 54, a: "Trabajo a un paso rápido y constante.", b: "Disfruto trabajando con detalles", factorA: "T", factorB: "D" },
  { num: 55, a: "Tengo muchas energía para juegos y deportes.", b: "Tengo mis cosas limpias y ordenadas.", factorA: "V", factorB: "C" },
  { num: 56, a: "Me llevo bien con todo el mundo", b: "Soy de temperamento estable", factorA: "S", factorB: "Z" },
  { num: 57, a: "Quiero conocer nueva gente y hacer cosas nuevas.", b: "Siempre quiero terminar el trabajo que he empezado.", factorA: "E", factorB: "N" },
  { num: 58, a: "Normalmente sostengo mis creencias.", b: "Normalmente me gusta trabajar intensamente.", factorA: "K", factorB: "A" },
  { num: 59, a: "Me gustan las sugerencias de las personas que admiro.", b: "Me gusta tener mi cargo a otras personas.", factorA: "F", factorB: "P" },
  { num: 60, a: "Me dejo influenciar fácilmente por otras personas.", b: "Me gusta que me pongan mucha atención.", factorA: "W", factorB: "X" },
  { num: 61, a: "Normalmente trabajo intensamente.", b: "Normalmente trabajo con rapidez.", factorA: "G", factorB: "T" },
  { num: 62, a: "Cuando hablo el grupo escucha.", b: "Soy hábil con herramientas.", factorA: "L", factorB: "V" },
  { num: 63, a: "Soy lento en hacer amigos", b: "Me toma tiempo para llegar a una conclusión.", factorA: "I", factorB: "S" },
  { num: 64, a: "Normalmente como de prisa.", b: "Me gusta leer", factorA: "T", factorB: "R" },
  { num: 65, a: "Me gusta el trabajo en donde puedo moverme.", b: "Me gusta el trabajo que tiene que hacerse con cuidado.", factorA: "V", factorB: "D" },
  { num: 66, a: "Hago el mayor número posible de amigos.", b: "Encuentro lo que me he guardado.", factorA: "S", factorB: "C" },
  { num: 67, a: "Pienso las cosas con anticipación.", b: "Siempre soy agradable.", factorA: "R", factorB: "Z" },
  { num: 68, a: "Yo cuido mucho mi reputación.", b: "Yo le pongo atención a un problema hasta que se resuelve.", factorA: "K", factorB: "N" },
  { num: 69, a: "Me gusta agradar a la gente que admiro.", b: "Quiero tener éxito.", factorA: "F", factorB: "A" },
  { num: 70, a: "Me gusta que otros tomen decisiones para el grupo.", b: "A mi me gusta tomar decisiones para el grupo.", factorA: "W", factorB: "P" },
  { num: 71, a: "Siempre me esfuerzo mucho.", b: "Tomo decisiones fácil y rápidamente.", factorA: "G", factorB: "I" },
  { num: 72, a: "El grupo hace normalmente lo que yo quiero.", b: "Normalmente tengo prisa.", factorA: "L", factorB: "T" },
  { num: 73, a: "A menudo me siento cansado.", b: "Soy lento para tomar decisiones.", factorA: "I", factorB: "V" },
  { num: 74, a: "Trabajo con rapidez.", b: "Hago amigos fácilmente.", factorA: "T", factorB: "S" },
  { num: 75, a: "Soy activo y con mucho vigor.", b: "Dedico mucho tiempo a pensar.", factorA: "V", factorB: "R" },
  { num: 76, a: "Soy cordial con la gente.", b: "Me gusta el trabajo que requiere precisión.", factorA: "S", factorB: "D" },
  { num: 77, a: "Pienso y planeo mucho.", b: "Guardo cada cosa en su lugar.", factorA: "R", factorB: "C" },
  { num: 78, a: "Me gusta el trabajo que requiere detalles.", b: "Siempre termino el trabajo que he empezado.", factorA: "D", factorB: "Z" },
  { num: 79, a: "Me gusta imitar a la gente que admiro.", b: "Difícilmente me enojo.", factorA: "F", factorB: "N" },
  { num: 80, a: "Me gustan las instrucciones claras.", b: "Me gusta trabajar intensamente.", factorA: "W", factorB: "A" },
  { num: 81, a: "Yo trato de lograr lo que quiero.", b: "Soy un buen “dirigente”.", factorA: "G", factorB: "L" },
  { num: 82, a: "Hago que los demás trabajen intensamente.", b: "Soy una persona que no se preocupa por nada.", factorA: "L", factorB: "I" },
  { num: 83, a: "Yo me decido rápidamente.", b: "Yo hablo rápidamente.", factorA: "I", factorB: "T" },
  { num: 84, a: "Normalmente trabajo de prisa.", b: "Hago ejercicio con regularidad.", factorA: "T", factorB: "V" },
  { num: 85, a: "No me gusta conocer gente.", b: "Me canso en seguida.", factorA: "V", factorB: "S" },
  { num: 86, a: "Hago muchísimos amigos.", b: "Dedico mucho tiempo a pensar.", factorA: "S", factorB: "R" },
  { num: 87, a: "Me gusta trabajar con problemas teóricos.", b: "Me gusta trabajar con detalles.", factorA: "R", factorB: "D" },
  { num: 88, a: "Me gusta trabajar con detalles.", b: "Me gusta organizar mi trabajo.", factorA: "D", factorB: "C" },
  { num: 89, a: "Pongo las cosas en su lugar.", b: "Siempre soy agradable.", factorA: "C", factorB: "Z" },
  { num: 90, a: "Me gusta que me digan lo que tengo que hacer.", b: "Yo debo terminar lo que he iniciado.", factorA: "W", factorB: "N" },
];

export const NOMBRES_FACTOR_KOSTICK: Record<FactorKostick, string> = {
  A: "NECESIDAD DE REALIZAR ( INICIATIVA)",
  B: "NECESIDAD DE PERTENECER A GRUPOS.",
  C: "TIPO ORGANIZADO",
  D: "INTERESADO EN TRABAJAR CON DETALLES",
  E: "TIPO EMOCIONALMENTE CONTENIDO",
  F: "NECESIDAD DE OBEDIENCIA A LA AUTORIDAD.",
  G: "DESEMPEÑO DEL TRABAJO ARDUO Y CONCENTRADO ( RESPONSABILIDAD ).",
  I: "FACILIDAD EN LA TOMA DE DECISIONES.",
  K: "NECESIDAD DE SER DEFENSIVAMENTE AGRESIVO",
  L: "PAPEL DE LIDERAZGO.",
  N: "NECESIDAD DE COMPLETAR LA TAREA.",
  O: "NECESIDAD AFECTIVA.",
  P: "NECESIDAD DE CONTROLAR A LOS OTROS ( DOMINANCIA ).",
  R: "TIPO TEORICO ( PRACTICA )",
  S: "DISPOSICION SOCIAL",
  T: "TIPO ACTIVO-INQUIETO Y AGIL ( STRESS )",
  V: "TIPO CON VIGOR FISICO.",
  W: "NECESIDAD DE REGLAMENTO Y SUPERVISION.",
  X: "NECESIDAD DE SER CONSIDERADO",
  Z: "NECESIDAD DE CAMBIO. NECESIDAD DE IDENTIFICARSE",
};

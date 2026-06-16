const ventanas = new Map<string, { conteo: number; resetEn: number }>();

const LIMITE = 5;
const VENTANA_MS = 60_000;

export function checkRateLimit(req: Request, ruta: string): { permitido: boolean; restantes: number } {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'desconocido';
  const key = `${ruta}:${ip}`;
  const ahora = Date.now();
  const entrada = ventanas.get(key);

  if (!entrada || ahora > entrada.resetEn) {
    ventanas.set(key, { conteo: 1, resetEn: ahora + VENTANA_MS });
    return { permitido: true, restantes: LIMITE - 1 };
  }

  if (entrada.conteo >= LIMITE) {
    return { permitido: false, restantes: 0 };
  }

  entrada.conteo += 1;
  return { permitido: true, restantes: LIMITE - entrada.conteo };
}

export function rateLimitResponse() {
  return Response.json(
    { error: 'Demasiadas solicitudes. Espera un momento antes de intentar de nuevo.' },
    { status: 429 }
  );
}

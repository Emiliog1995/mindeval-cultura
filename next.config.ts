import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // frame-ancestors 'none' cubre el mismo caso que X-Frame-Options (clickjacking),
          // más object-src/base-uri. No se restringe script-src/style-src aquí: Next.js
          // usa scripts/estilos inline para hidratación y este proyecto no tiene nonces
          // configurados — bloquearlos a ciegas sin poder probar el deploy rompería
          // la app. Si se quiere endurecer eso después, hace falta un CSP con nonce
          // por request (middleware), probado contra un deploy real antes de publicar.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
      {
        // Portal del evaluado: las pruebas de instituciones (USECIPOL) graban
        // cámara + micrófono por contrato. Solo esta ruta los habilita, y solo
        // para el propio sitio (self). Va DESPUÉS de la regla general: en
        // Next.js, si dos reglas fijan la misma cabecera, gana la última.
        source: "/seleccion/prueba/:path*",
        headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" }],
      },
    ];
  },
};

export default nextConfig;

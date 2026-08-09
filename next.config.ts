import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (vía pdfjs-dist) carga su pdf.worker.mjs con una ruta relativa
  // a su propia carpeta en node_modules — si Turbopack/webpack lo empaqueta
  // dentro de .next/server/chunks esa ruta deja de existir y la extracción
  // de CVs en PDF falla en silencio. Con esto se carga directo desde
  // node_modules en runtime, sin empaquetar.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],

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
    ];
  },
};

export default nextConfig;

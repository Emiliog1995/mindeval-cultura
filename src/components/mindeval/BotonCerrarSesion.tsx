"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cerrarSesion } from "@/lib/useAuthGuard";

/** Cierra la sesión y vuelve al login ("/"). Pensado para la barra azul. */
export default function BotonCerrarSesion() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);
  return (
    <button
      onClick={async () => {
        setSaliendo(true);
        try {
          await cerrarSesion();
        } finally {
          router.replace("/");
        }
      }}
      disabled={saliendo}
      style={{ background: "transparent", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.35)", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, cursor: saliendo ? "not-allowed" : "pointer", opacity: saliendo ? 0.6 : 1 }}
    >
      {saliendo ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}

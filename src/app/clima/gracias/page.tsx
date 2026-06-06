"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { completarSesion } from "@/lib/supabase";

function GraciasContent() {
  const params   = useSearchParams();
  const sesionId = params.get("sesion");
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (sesionId) {
      completarSesion(sesionId).finally(() => setListo(true));
    } else {
      setListo(true);
    }
  }, [sesionId]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#1a2035" }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-10 text-center">
        <p className="text-xs font-bold tracking-widest mb-6" style={{ color: "#c9a84c" }}>MINDTALENT</p>

        {!listo ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-4">
            <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "#1a2035", borderTopColor: "#c9a84c" }} />
            Registrando...
          </div>
        ) : (
          <>
            <div className="text-5xl mb-4">&#10003;</div>
            <h1 className="text-2xl font-bold mb-3" style={{ color: "#1a2035" }}>
              ¡Gracias por participar!
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              Tus respuestas han sido registradas exitosamente. Los resultados serán procesados por el equipo de MINDTALENT.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function GraciasPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#1a2035" }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "#1a2035", borderTopColor: "#c9a84c" }} />
      </div>
    }>
      <GraciasContent />
    </Suspense>
  );
}

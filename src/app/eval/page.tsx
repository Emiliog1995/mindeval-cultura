"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Sesion } from "@/lib/supabase";

function EvalContent() {
  const router       = useRouter();
  const params       = useSearchParams();
  const id           = params.get("id");

  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [error, setError]   = useState("");

  useEffect(() => {
    if (!id) { setError("Link inválido. No se encontró el identificador de sesión."); return; }

    supabase
      .from("sesiones")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setError("Esta sesión no existe o ya no está disponible."); return; }
        const s = data as Sesion;
        setSesion(s);

        if (s.estado === "completada") { setError("Esta sesión ya fue completada."); return; }

        const destino = s.tipo === "clima"
          ? `/clima?sesion=${s.id}`
          : `/evaluacion?sesion=${s.id}`;

        setTimeout(() => router.replace(destino), 2000);
      });
  }, [id, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#1a2035" }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <p className="text-xs font-bold tracking-widest mb-6" style={{ color: "#c9a84c" }}>MINDTALENT</p>

        {error ? (
          <>
            <p className="text-2xl font-bold mb-3" style={{ color: "#1a2035" }}>Sesión no disponible</p>
            <p className="text-sm text-gray-500">{error}</p>
          </>
        ) : sesion ? (
          <>
            <p className="text-2xl font-bold mb-2" style={{ color: "#1a2035" }}>
              {sesion.tipo === "clima" ? "Encuesta de Clima Laboral" : "Evaluación de Cultura Organizacional"}
            </p>
            {sesion.empresa && (
              <p className="text-sm text-gray-500 mb-4">{sesion.empresa}</p>
            )}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mt-6">
              <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "#1a2035", borderTopColor: "#c9a84c" }} />
              Redirigiendo al cuestionario...
            </div>
          </>
        ) : !error ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-4">
            <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "#1a2035", borderTopColor: "#c9a84c" }} />
            Verificando sesión...
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function EvalPortal() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#1a2035" }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "#1a2035", borderTopColor: "#c9a84c" }} />
      </div>
    }>
      <EvalContent />
    </Suspense>
  );
}

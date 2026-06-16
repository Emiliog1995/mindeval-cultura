"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function useAuthGuard() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!activo) return;
      if (!data.session) {
        router.replace("/");
      } else {
        setVerificando(false);
      }
    });
    return () => {
      activo = false;
    };
  }, [router]);

  return { verificando };
}

export async function cerrarSesion() {
  await supabase.auth.signOut();
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { authHeaders } from "@/lib/auth-headers";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

const PRUEBAS = [
  { id: "16pf5", nombre: "16PF-5", desc: "Factores de personalidad · 185 ítems" },
  { id: "kostick", nombre: "KOSTICK", desc: "Estilo de trabajo · 90 ítems" },
  { id: "disc", nombre: "DISC", desc: "Comportamiento" },
  { id: "valanti", nombre: "VALANTI", desc: "Valores" },
];

const campo = { width: "100%", padding: "10px 12px", border: "1.5px solid #D5DCEB", borderRadius: 8, fontSize: 14, boxSizing: "border-box" as const, color: NAVY };

export default function NuevoProceso() {
  const router = useRouter();
  const { verificando } = useAuthGuard();
  const [rol, setRol] = useState<string | null>(null);
  const [instituciones, setInstituciones] = useState<{ id: string; nombre: string }[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tests, setTests] = useState<string[]>(["16pf5", "kostick", "disc", "valanti"]);
  const [tiempo, setTiempo] = useState(120);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (verificando) return;
    (async () => {
      const res = await fetch("/api/mindeval-usuarios?contexto=1", { headers: await authHeaders() });
      if (!res.ok) return;
      const ctx = await res.json();
      setRol(ctx.rol);
      if (ctx.rol === "super_admin") {
        const { data } = await supabase.from("empresas_mdt").select("id, nombre").eq("tipo", "institucion").order("nombre");
        setInstituciones(data ?? []);
        if (data?.length === 1) setEmpresaId(data[0].id);
      }
    })();
  }, [verificando]);

  async function crear() {
    setError("");
    setGuardando(true);
    try {
      const res = await fetch("/api/mindeval-institucion-proceso", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, tests, tiempo_limite_min: tiempo, empresa_id: empresaId || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo crear el proceso");
      router.push(`/seleccion/proceso/${d.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el proceso");
      setGuardando(false);
    }
  }

  if (verificando) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, color: "#FFFFFF", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>
          MindEval <span style={{ color: GOLD }}>Selección</span>
        </div>
        <button
          onClick={() => router.push("/seleccion")}
          style={{ marginLeft: "auto", background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}
        >
          ← Procesos
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <h1 style={{ color: NAVY, fontSize: 22, marginBottom: 4 }}>Nuevo proceso de evaluación</h1>
        <p style={{ color: "#7C89A8", fontSize: 13, marginBottom: 24 }}>
          Defines las pruebas y el tiempo. Después cargas a los evaluados y envías las invitaciones.
        </p>

        <div style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 24 }}>
          {rol === "super_admin" && (
            <>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#7C89A8" }}>INSTITUCIÓN</label>
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} style={{ ...campo, marginBottom: 18, marginTop: 6, background: "#FFFFFF" }}>
                <option value="">Elige una institución…</option>
                {instituciones.map((i) => (
                  <option key={i.id} value={i.id}>{i.nombre}</option>
                ))}
              </select>
            </>
          )}

          <label style={{ fontSize: 12, fontWeight: 700, color: "#7C89A8" }}>NOMBRE DEL PROCESO</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Evaluación psicométrica — Cohorte noviembre" style={{ ...campo, marginBottom: 18, marginTop: 6 }} />

          <label style={{ fontSize: 12, fontWeight: 700, color: "#7C89A8" }}>PRUEBAS</label>
          <div style={{ display: "grid", gap: 8, margin: "6px 0 18px" }}>
            {PRUEBAS.map((p) => (
              <label key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", border: "1.5px solid #E3E8F2", borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={tests.includes(p.id)}
                  onChange={(e) => setTests(e.target.checked ? [...tests, p.id] : tests.filter((t) => t !== p.id))}
                />
                <span style={{ fontWeight: 700, color: NAVY, fontSize: 13.5 }}>{p.nombre}</span>
                <span style={{ color: "#7C89A8", fontSize: 12 }}>{p.desc}</span>
              </label>
            ))}
          </div>

          <label style={{ fontSize: 12, fontWeight: 700, color: "#7C89A8" }}>TIEMPO LÍMITE (MINUTOS)</label>
          <input type="number" min={5} max={600} value={tiempo} onChange={(e) => setTiempo(Number(e.target.value))} style={{ ...campo, marginBottom: 6, marginTop: 6, maxWidth: 160 }} />
          <p style={{ color: "#7C89A8", fontSize: 12, marginBottom: 20 }}>Es el tiempo total que tiene cada evaluado desde que abre la prueba.</p>

          {error && <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{error}</div>}

          <button
            onClick={crear}
            disabled={guardando || titulo.trim().length < 3 || tests.length === 0 || (rol === "super_admin" && !empresaId)}
            style={{ background: GOLD, color: NAVY, border: "none", padding: "12px 22px", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: guardando || titulo.trim().length < 3 || tests.length === 0 || (rol === "super_admin" && !empresaId) ? 0.5 : 1 }}
          >
            {guardando ? "Creando…" : "Crear proceso"}
          </button>
        </div>
      </div>
    </div>
  );
}

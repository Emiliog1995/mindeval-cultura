"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { authHeaders } from "@/lib/auth-headers";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

interface Fila {
  id: string;
  cohorte: string;
  nombre: string;
  cedula: string | null;
  pruebas: string[];
  ultima_fecha: string | null;
}
interface Escala {
  code: string | null;
  name: string | null;
  raw_score: number | null;
  max_score: number | null;
  sten_score: number | null;
  percentile: number | null;
  category: string | null;
}
interface Prueba {
  prueba: string;
  tiempo_limite_min: number | null;
  tiempo_usado_seg: number | null;
  terminada_en: string | null;
  alertas: number | null;
  escalas: Escala[];
}
interface Detalle {
  id: string;
  cohorte: string;
  nombre: string;
  cedula: string | null;
  pruebas: Prueba[];
}

function minutos(seg: number | null): string {
  if (seg === null || seg === undefined) return "—";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m} min ${s.toString().padStart(2, "0")} s`;
}

export default function Historico() {
  return (
    <Suspense fallback={null}>
      <HistoricoInner />
    </Suspense>
  );
}

function HistoricoInner() {
  const router = useRouter();
  const empresa = useSearchParams().get("empresa") ?? "";
  const { verificando } = useAuthGuard();
  const [institucion, setInstitucion] = useState("");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [filtro, setFiltro] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState<Detalle | null>(null);

  const qsEmpresa = empresa ? `empresa_id=${encodeURIComponent(empresa)}` : "";

  useEffect(() => {
    if (verificando) return;
    (async () => {
      try {
        const res = await fetch(`/api/mindeval-institucion-historico${qsEmpresa ? `?${qsEmpresa}` : ""}`, { headers: await authHeaders() });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "No se pudo cargar el historial");
        setInstitucion(d.institucion);
        setFilas(d.evaluados);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar el historial");
      } finally {
        setCargando(false);
      }
    })();
  }, [verificando, qsEmpresa]);

  async function abrir(id: string) {
    setError("");
    try {
      const res = await fetch(`/api/mindeval-institucion-historico?id=${id}${qsEmpresa ? `&${qsEmpresa}` : ""}`, { headers: await authHeaders() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo cargar el registro");
      setDetalle(d.evaluado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el registro");
    }
  }

  if (verificando) return null;

  const visibles = filas.filter((f) => {
    const t = filtro.trim().toLowerCase();
    return !t || f.nombre.toLowerCase().includes(t) || (f.cedula ?? "").includes(t);
  });

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, color: "#FFFFFF", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>
          MindEval <span style={{ color: GOLD }}>Selección</span>
        </div>
        <button
          onClick={() => router.push(empresa ? `/seleccion?empresa=${empresa}` : "/seleccion")}
          style={{ marginLeft: "auto", background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}
        >
          ← Procesos
        </button>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7C89A8", letterSpacing: 1 }}>{institucion ? `INSTITUCIÓN ${institucion.toUpperCase()}` : ""}</div>
        <h1 style={{ color: NAVY, fontSize: 22, margin: "2px 0 6px" }}>Evaluaciones anteriores</h1>
        <p style={{ color: "#7C89A8", fontSize: 13, marginBottom: 20, maxWidth: 720, lineHeight: 1.6 }}>
          Resultados de las pruebas rendidas en la plataforma anterior, conservados con sus puntajes por escala tal como
          se calcularon en ese momento. Son de solo lectura.
        </p>

        {error && <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}

        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar por nombre o cédula"
          style={{ padding: "9px 12px", border: "1.5px solid #D5DCEB", borderRadius: 8, fontSize: 13.5, color: NAVY, width: 320, maxWidth: "100%", marginBottom: 14, boxSizing: "border-box" }}
        />

        <div style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F7F9FD" }}>
                {["Nombre", "Cédula", "Pruebas", "Fecha", ""].map((h) => (
                  <th key={h} style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#7C89A8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#7C89A8", fontSize: 13 }}>Cargando…</td></tr>
              )}
              {!cargando && visibles.map((f) => (
                <tr key={f.id} style={{ borderTop: "1px solid #EEF1F7" }}>
                  <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: NAVY }}>{f.nombre}</td>
                  <td style={{ padding: "10px 16px", fontSize: 12.5, color: "#41507A" }}>{f.cedula ?? "—"}</td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#41507A" }}>{f.pruebas.join(" · ")}</td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#7C89A8" }}>{f.ultima_fecha ? new Date(f.ultima_fecha).toLocaleDateString("es-EC") : "—"}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <button onClick={() => abrir(f.id)} style={{ background: GOLD, color: NAVY, border: "none", padding: "5px 12px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                      Ver resultados
                    </button>
                  </td>
                </tr>
              ))}
              {!cargando && visibles.length === 0 && !error && (
                <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#7C89A8", fontSize: 13 }}>No hay evaluaciones anteriores registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detalle && (
        <div onClick={() => setDetalle(null)} style={{ position: "fixed", inset: 0, background: "rgba(11,16,32,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 14, padding: 24, maxWidth: 820, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 800, color: NAVY, fontSize: 17 }}>{detalle.nombre}</div>
                <div style={{ fontSize: 12, color: "#7C89A8" }}>Cédula {detalle.cedula ?? "—"} · {detalle.cohorte}</div>
              </div>
              <button onClick={() => setDetalle(null)} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#7C89A8" }}>×</button>
            </div>

            {detalle.pruebas.map((p, i) => (
              <div key={`${p.prueba}-${i}`} style={{ border: "1px solid #E3E8F2", borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                <div style={{ background: "#F7F9FD", padding: "10px 14px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={{ color: NAVY, fontSize: 13.5 }}>{p.prueba}</strong>
                  <span style={{ fontSize: 12, color: "#41507A" }}>
                    Tiempo usado {minutos(p.tiempo_usado_seg)}{p.tiempo_limite_min ? ` de ${p.tiempo_limite_min} min` : ""}
                  </span>
                  <span style={{ fontSize: 12, color: "#41507A" }}>Alertas: {p.alertas ?? "—"}</span>
                  {p.terminada_en && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#7C89A8" }}>{new Date(p.terminada_en).toLocaleString("es-EC")}</span>}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Escala", "Bruto", "STEN", "Percentil", "Categoría"].map((h) => (
                        <th key={h} style={{ padding: "7px 14px", textAlign: "left", fontSize: 11, color: "#7C89A8" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.escalas.map((e, j) => (
                      <tr key={`${e.code}-${j}`} style={{ borderTop: "1px solid #EEF1F7" }}>
                        <td style={{ padding: "7px 14px", fontSize: 12.5, color: NAVY }}>{e.name ?? e.code ?? "—"}</td>
                        <td style={{ padding: "7px 14px", fontSize: 12.5, color: "#41507A" }}>
                          {e.raw_score ?? "—"}{e.max_score ? ` / ${e.max_score}` : ""}
                        </td>
                        <td style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 700, color: NAVY }}>{e.sten_score ?? "—"}</td>
                        <td style={{ padding: "7px 14px", fontSize: 12.5, color: "#41507A" }}>{e.percentile ?? "—"}</td>
                        <td style={{ padding: "7px 14px", fontSize: 12.5, color: "#41507A" }}>{e.category ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <p style={{ fontSize: 11.5, color: "#7C89A8", marginTop: 4 }}>
              Puntajes tal como los calculó la plataforma anterior. No incluye dictámenes automáticos: la valoración la hace quien revisa.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/lib/useAuthGuard";
import type { AlertaFraude, EstadoSesionPrueba, SeveridadAlerta, TipoSesionPrueba, Vacante } from "@/lib/mindeval-types";

const NAVY = "#1B2A5B";

interface SesionConCandidato {
  id: string;
  candidato_id: string;
  tipo: TipoSesionPrueba;
  fecha_programada: string;
  estado: EstadoSesionPrueba;
  nombre_completo: string;
}

interface AlertaConCandidato extends AlertaFraude {
  nombre_completo: string;
}

const badgeSesion: Record<EstadoSesionPrueba, { label: string; bg: string; color: string }> = {
  programada: { label: "Programada", bg: "#EAF0FB", color: "#2E4A96" },
  en_curso: { label: "En curso", bg: "#FFF6DE", color: "#8A6400" },
  completada: { label: "Completada", bg: "#E8F6EF", color: "#12805C" },
  expirada: { label: "Expirada", bg: "#FDEDEA", color: "#C4402F" },
};

const badgeSeveridad: Record<SeveridadAlerta, { label: string; bg: string; color: string }> = {
  bajo: { label: "Bajo", bg: "#EAF0FB", color: "#2E4A96" },
  medio: { label: "Medio", bg: "#FFF6DE", color: "#8A6400" },
  alto: { label: "Alto", bg: "#FDEDEA", color: "#C4402F" },
  critico: { label: "Crítico", bg: "#3A1420", color: "#FF8A78" },
};

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function MonitoreoVacante() {
  const params = useParams<{ vacanteId: string }>();
  const router = useRouter();
  const { verificando } = useAuthGuard();

  const [vacante, setVacante] = useState<Vacante | null>(null);
  const [sesiones, setSesiones] = useState<SesionConCandidato[]>([]);
  const [alertas, setAlertas] = useState<AlertaConCandidato[]>([]);
  const nombresRef = useRef<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [eliminando, setEliminando] = useState<string | null>(null);

  useEffect(() => {
    if (verificando) return;
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificando]);

  useEffect(() => {
    if (verificando) return;
    const channel = supabase
      .channel(`mindeval-alertas-${params.vacanteId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mindeval_alertas_fraude" },
        (payload) => {
          const nueva = payload.new as AlertaFraude;
          const nombre = nombresRef.current[nueva.candidato_id];
          if (!nombre) return;
          setAlertas((prevA) => [{ ...nueva, nombre_completo: nombre }, ...prevA].slice(0, 50));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [verificando, params.vacanteId]);

  async function cargar() {
    setLoading(true);
    const { data: v } = await supabase.from("mindeval_vacantes").select("*").eq("id", params.vacanteId).single();
    setVacante(v ?? null);

    const { data: cands } = await supabase.from("mindeval_candidatos").select("id, nombre_completo").eq("vacante_id", params.vacanteId);
    const nombres: Record<string, string> = {};
    (cands ?? []).forEach((c) => (nombres[c.id] = c.nombre_completo));
    nombresRef.current = nombres;

    const ids = (cands ?? []).map((c) => c.id);
    if (ids.length) {
      const [{ data: sess }, { data: al }] = await Promise.all([
        supabase
          .from("mindeval_sesiones_prueba")
          .select("id, candidato_id, tipo, fecha_programada, estado")
          .in("candidato_id", ids)
          .in("estado", ["programada", "en_curso"])
          .order("fecha_programada", { ascending: true }),
        supabase
          .from("mindeval_alertas_fraude")
          .select("*")
          .in("candidato_id", ids)
          .order("creado_en", { ascending: false })
          .limit(50),
      ]);
      setSesiones((sess ?? []).map((s) => ({ ...s, nombre_completo: nombres[s.candidato_id] ?? "—" })));
      setAlertas((al ?? []).map((a) => ({ ...a, nombre_completo: nombres[a.candidato_id] ?? "—" })));
    } else {
      setSesiones([]);
      setAlertas([]);
    }
    setLoading(false);
  }

  /**
   * Elimina una sesión de prueba (agendamiento) — no toca resultados ni
   * calificaciones, solo el registro de "se agendó esta prueba para tal
   * fecha". Sirve para limpiar sesiones de prueba/testing que se acumulan
   * sin dejar rastro real que auditar, a diferencia de las calificaciones.
   */
  async function eliminarSesion(id: string) {
    if (!window.confirm("¿Eliminar esta sesión agendada? El candidato ya no podrá usar ese enlace. No se puede deshacer.")) return;
    setEliminando(id);
    try {
      await supabase.from("mindeval_sesiones_prueba").delete().eq("id", id);
      setSesiones((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setEliminando(null);
    }
  }

  if (verificando || loading || !vacante) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, color: "#FFFFFF", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <button
            onClick={() => router.push(`/seleccion/${params.vacanteId}`)}
            style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.25)", padding: "6px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer", marginBottom: 8 }}
          >
            ← Volver al proceso
          </button>
          <div style={{ fontSize: 19, fontWeight: 800 }}>Monitoreo en vivo — {vacante.titulo}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#0FA85F", display: "inline-block" }} />
          <span style={{ fontSize: 12, color: "#A9B6D8" }}>Escuchando alertas en tiempo real</span>
        </div>
      </div>

      <div style={{ maxWidth: 1150, margin: "0 auto", padding: "1.75rem 1.5rem", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20 }}>
        <section style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 16, padding: "20px 22px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: NAVY }}>Sesiones activas</h2>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "#7C89A8" }}>Pruebas programadas o en curso — sin grabación de video, solo señales de comportamiento.</p>
          {sesiones.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#7C89A8" }}>No hay sesiones programadas ni en curso en este momento.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sesiones.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#F7F9FD", borderRadius: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: NAVY, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>
                    {iniciales(s.nombre_completo)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.nombre_completo}</div>
                    <div style={{ fontSize: 11, color: "#7C89A8" }}>
                      {s.tipo === "psicometrica" ? "Psicométrica" : "Técnica"} · {new Date(s.fecha_programada).toLocaleString("es-EC")}
                    </div>
                  </div>
                  <span style={{ background: badgeSesion[s.estado].bg, color: badgeSesion[s.estado].color, fontWeight: 700, fontSize: 10.5, padding: "3px 9px", borderRadius: 20, flex: "none" }}>
                    {badgeSesion[s.estado].label}
                  </span>
                  <button
                    onClick={() => router.push(`/seleccion/${params.vacanteId}/candidato/${s.candidato_id}`)}
                    style={{ background: "none", border: `1px solid ${NAVY}`, color: NAVY, fontSize: 11, padding: "5px 10px", borderRadius: 6, cursor: "pointer", flex: "none" }}
                  >
                    Ver perfil
                  </button>
                  <button
                    onClick={() => eliminarSesion(s.id)}
                    disabled={eliminando === s.id}
                    title="Eliminar esta sesión agendada"
                    style={{ background: "none", border: "1px solid #C4402F", color: "#C4402F", fontSize: 11, padding: "5px 10px", borderRadius: 6, cursor: eliminando === s.id ? "not-allowed" : "pointer", flex: "none", opacity: eliminando === s.id ? 0.5 : 1 }}
                  >
                    {eliminando === s.id ? "…" : "Eliminar"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ background: "#18244C", border: "1px solid #2C3E77", borderRadius: 16, padding: "20px 22px", color: "#FFFFFF" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800 }}>Alertas anti-fraude</h2>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "#8FA0CC" }}>Cambio de pestaña, salida de pantalla completa, copiar/pegar — se actualiza en vivo.</p>
          {alertas.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#8FA0CC" }}>Sin alertas registradas.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
              {alertas.map((a) => (
                <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{a.nombre_completo}</span>
                    <span
                      style={{ background: badgeSeveridad[a.severidad].bg, color: badgeSeveridad[a.severidad].color, fontWeight: 700, fontSize: 10, padding: "2px 8px", borderRadius: 20 }}
                    >
                      {badgeSeveridad[a.severidad].label}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#8FA0CC" }}>{new Date(a.creado_en).toLocaleTimeString("es-EC")}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#C7D0EA" }}>
                    {a.tipo_alerta} · {a.sesion_tipo}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

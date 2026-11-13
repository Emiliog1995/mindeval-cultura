"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { authHeaders } from "@/lib/auth-headers";
import type { Vacante } from "@/lib/mindeval-types";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

interface VacanteConConteo extends Vacante {
  total_candidatos: number;
}

interface Empresa {
  id: string;
  nombre: string;
  tipo?: string;
}

export default function PanelSeleccion() {
  return (
    <Suspense fallback={null}>
      <PanelSeleccionInner />
    </Suspense>
  );
}

function PanelSeleccionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verificando } = useAuthGuard();
  const [vacantes, setVacantes] = useState<VacanteConConteo[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState(searchParams.get("empresa") ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Quién soy: null mientras carga. Un cliente externo (ej. USECIPOL) tiene
  // empresaId y NO debe ver el Portal ni el selector de empresas.
  const [yo, setYo] = useState<{ rol: string | null; empresaId: string | null; empresaTipo?: string | null } | null>(null);

  useEffect(() => {
    if (verificando) return;
    (async () => {
      try {
        const res = await fetch("/api/mindeval-usuarios?contexto=1", { headers: await authHeaders() });
        if (res.ok) setYo(await res.json());
      } catch {
        /* sin contexto: se muestra la vista de staff por defecto */
      }
    })();
  }, [verificando]);

  useEffect(() => {
    if (verificando) return;
    (async () => {
      const { data: vac, error: vErr } = await supabase
        .from("mindeval_vacantes")
        .select("*")
        .order("created_at", { ascending: false });

      if (vErr || !vac) {
        setError("No se pudieron cargar las vacantes. Verifica las credenciales de Supabase.");
        setLoading(false);
        return;
      }

      const { data: cand } = await supabase.from("mindeval_candidatos").select("vacante_id");
      const conteos = new Map<string, number>();
      (cand ?? []).forEach((c: { vacante_id: string }) => {
        conteos.set(c.vacante_id, (conteos.get(c.vacante_id) ?? 0) + 1);
      });

      setVacantes(vac.map((v) => ({ ...v, total_candidatos: conteos.get(v.id) ?? 0 })));
      setLoading(false);
    })();
  }, [verificando]);

  useEffect(() => {
    if (verificando) return;
    supabase.from("empresas_mdt").select("id, nombre, tipo").order("nombre").then(({ data }) => setEmpresas(data ?? []));
  }, [verificando]);

  // Una vacante es "proceso de institución" si su empresa es tipo institución.
  const esProceso = (v: Vacante) =>
    v.empresa_id && v.empresa_id === yo?.empresaId
      ? yo?.empresaTipo === "institucion"
      : empresas.find((e) => e.id === v.empresa_id)?.tipo === "institucion";
  // Vista de institución: la cuenta es de una institución, o el super_admin
  // tiene elegida una en el filtro. En esa vista no hay "vacantes" ni CV.
  const soloInstitucion =
    yo?.empresaTipo === "institucion" || (!!empresaId && empresas.find((e) => e.id === empresaId)?.tipo === "institucion");
  const hayInstituciones = soloInstitucion || empresas.some((e) => e.tipo === "institucion");

  const vacantesFiltradas = empresaId ? vacantes.filter((v) => v.empresa_id === empresaId) : vacantes;

  if (verificando) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, color: "#FFFFFF", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>
            MindEval <span style={{ color: GOLD }}>Selección</span>
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1.2, color: "#8FA0CC", marginTop: 2 }}>
            {soloInstitucion ? "BY MINDTALENT · PRUEBAS PSICOMÉTRICAS" : "BY MINDTALENT · 7 ETAPAS + IA"}
          </div>
        </div>
        <div style={{ marginLeft: "auto" }} />
        {(yo?.rol === "super_admin" || yo?.rol === "administrador") && (
          <button
            onClick={() => router.push("/seleccion/usuarios")}
            style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}
          >
            Gestión de usuarios
          </button>
        )}
        {yo && !yo.empresaId && (
          <button
            onClick={() => router.push("/portal")}
            style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}
          >
            ← Portal
          </button>
        )}
        {hayInstituciones && (yo?.rol === "super_admin" || yo?.rol === "administrador") && (
          <button
            onClick={() => router.push("/seleccion/proceso/nuevo")}
            style={{ background: GOLD, color: NAVY, border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
          >
            + Nuevo proceso
          </button>
        )}
        {!soloInstitucion && (
          <button
            onClick={() => router.push("/seleccion/nueva")}
            style={{ background: hayInstituciones && yo?.rol === "super_admin" ? "rgba(255,255,255,0.08)" : GOLD, color: hayInstituciones && yo?.rol === "super_admin" ? "#FFFFFF" : NAVY, border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
          >
            + Nueva vacante
          </button>
        )}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {error && (
          <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
            {error}
          </div>
        )}

        {(!yo || !yo.empresaId) && (
        <div style={{ marginBottom: 16 }}>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            style={{ padding: "9px 12px", border: "1.5px solid #D5DCEB", borderRadius: 8, fontSize: 13, color: NAVY, background: "#FFFFFF" }}
          >
            <option value="">Todas las empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#7C89A8" }}>{soloInstitucion ? "PROCESOS ABIERTOS" : "VACANTES ABIERTAS"}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: NAVY }}>{vacantesFiltradas.filter((v) => v.estado === "abierta").length}</div>
          </div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#7C89A8" }}>{soloInstitucion ? "TOTAL PROCESOS" : "TOTAL VACANTES"}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: NAVY }}>{vacantesFiltradas.length}</div>
          </div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#7C89A8" }}>{soloInstitucion ? "EVALUADOS TOTALES" : "CANDIDATOS TOTALES"}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: NAVY }}>
              {vacantesFiltradas.reduce((s, v) => s + v.total_candidatos, 0)}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#7C89A8" }}>Cargando…</div>
        ) : (
          <div style={{ background: "#FFFFFF", borderRadius: 14, overflow: "hidden", border: "1px solid #E3E8F2" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F7F9FD" }}>
                  {[soloInstitucion ? "Proceso" : "Vacante", soloInstitucion ? "Institución" : "Empresa", "Estado", soloInstitucion ? "Evaluados" : "Candidatos", "Creada", "Acciones"].map((h) => (
                    <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#7C89A8", letterSpacing: 0.5 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vacantesFiltradas.map((v) => (
                  <tr key={v.id} style={{ borderTop: "1px solid #EEF1F7" }}>
                    <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 700, color: NAVY }}>{v.titulo}</td>
                    <td style={{ padding: "12px 20px", fontSize: 12.5, color: "#41507A" }}>{v.empresa}</td>
                    <td style={{ padding: "12px 20px" }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: "4px 10px",
                          borderRadius: 20,
                          background: v.estado === "abierta" ? "#E8F6EF" : v.estado === "pausada" ? "#FFF6DE" : "#F1F3F9",
                          color: v.estado === "abierta" ? "#12805C" : v.estado === "pausada" ? "#8A6400" : "#5A6785",
                        }}
                      >
                        {v.estado}
                      </span>
                    </td>
                    <td style={{ padding: "12px 20px", fontSize: 12.5, color: "#41507A" }}>{v.total_candidatos}</td>
                    <td style={{ padding: "12px 20px", fontSize: 12, color: "#7C89A8" }}>
                      {new Date(v.created_at).toLocaleDateString("es-EC")}
                    </td>
                    <td style={{ padding: "12px 20px" }}>
                      <button
                        onClick={() => router.push(esProceso(v) ? `/seleccion/proceso/${v.id}` : `/seleccion/${v.id}`)}
                        style={{ background: NAVY, color: "#FFFFFF", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 11.5, cursor: "pointer" }}
                      >
                        Ver proceso
                      </button>
                    </td>
                  </tr>
                ))}
                {vacantesFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#7C89A8", fontSize: 13 }}>
                      {soloInstitucion ? "No hay procesos registrados." : "No hay vacantes registradas."}{" "}
                      <button
                        onClick={() => router.push(soloInstitucion ? "/seleccion/proceso/nuevo" : "/seleccion/nueva")}
                        style={{ color: NAVY, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontWeight: 600 }}
                      >
                        {soloInstitucion ? "Crear el primero" : "Crear la primera"}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

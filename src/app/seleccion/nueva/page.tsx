"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/lib/useAuthGuard";
import type { CompetenciaBlanda, CompetenciaDura } from "@/lib/mindeval-types";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

interface Puesto {
  id: string;
  nombre_puesto: string;
  area: string;
  mision?: string | null;
  empresas_mdt?: { nombre: string } | null;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1.5px solid #D5DCEB",
  borderRadius: 8,
  fontSize: 13,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 5, display: "block" };

export default function NuevaVacante() {
  const router = useRouter();
  const { verificando } = useAuthGuard();

  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [origenPerfil, setOrigenPerfil] = useState<"puesto" | "manual">("puesto");
  const [puestoId, setPuestoId] = useState("");
  const [verTodasLasEmpresas, setVerTodasLasEmpresas] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [codigoProceso, setCodigoProceso] = useState("");
  const [fechaLimitePostulacion, setFechaLimitePostulacion] = useState("");
  const [corteMatchCv, setCorteMatchCv] = useState(72);
  const [corteSten, setCorteSten] = useState(6);
  const [corteTecnica, setCorteTecnica] = useState(70);
  const [testsPsicometricos, setTestsPsicometricos] = useState<("16pf5" | "kostick" | "disc" | "valanti")[]>([]);

  const [mision, setMision] = useState("");
  const [area, setArea] = useState("");
  const [duras, setDuras] = useState<CompetenciaDura[]>([{ nombre: "", peso: 20, excluyente: true }]);
  const [blandas, setBlandas] = useState<CompetenciaBlanda[]>([{ nombre: "", nivel_esperado: 7 }]);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [confirmarOtraEmpresa, setConfirmarOtraEmpresa] = useState(false);

  useEffect(() => {
    if (verificando) return;
    supabase
      .from("puestos")
      .select("id, nombre_puesto, area, mision, empresas_mdt(nombre)")
      .order("nombre_puesto")
      .then(({ data }) => setPuestos((data as unknown as Puesto[]) ?? []));
  }, [verificando]);

  const puestoSeleccionado = puestos.find((p) => p.id === puestoId);

  function mismaEmpresa(nombrePuesto?: string | null): boolean {
    const a = empresa.trim().toLowerCase();
    const b = (nombrePuesto ?? "").trim().toLowerCase();
    if (!a || !b) return false;
    return a.includes(b) || b.includes(a);
  }

  const puestosDeLaEmpresa = puestos.filter((p) => mismaEmpresa(p.empresas_mdt?.nombre));
  const puestosMostrados = verTodasLasEmpresas || !empresa.trim() || puestosDeLaEmpresa.length === 0 ? puestos : puestosDeLaEmpresa;
  const puestoDeOtraEmpresa = origenPerfil === "puesto" && !!puestoSeleccionado && !!empresa.trim() && !mismaEmpresa(puestoSeleccionado.empresas_mdt?.nombre);

  async function guardar() {
    setError("");
    if (!titulo.trim() || !empresa.trim()) {
      setError("Completa al menos el título de la vacante y la empresa.");
      return;
    }
    if (origenPerfil === "puesto" && !puestoId) {
      setError("Selecciona un puesto del Manual de Puestos, o cambia a perfil manual.");
      return;
    }
    if (puestoDeOtraEmpresa && !confirmarOtraEmpresa) {
      setError("El puesto seleccionado pertenece a otra empresa. Confirma abajo que quieres usarlo igual, o elige un puesto de esta empresa.");
      return;
    }

    setGuardando(true);
    try {
      const payload: Record<string, unknown> = {
        titulo,
        empresa,
        codigo_proceso: codigoProceso || null,
        fecha_limite_postulacion: fechaLimitePostulacion ? new Date(fechaLimitePostulacion).toISOString() : null,
        corte_match_cv: corteMatchCv,
        corte_sten: corteSten,
        corte_tecnica: corteTecnica,
        tests_psicometricos: testsPsicometricos,
      };

      if (origenPerfil === "puesto") {
        payload.puesto_id = puestoId;
        payload.perfil_cargo_manual = null;
      } else {
        payload.puesto_id = null;
        payload.perfil_cargo_manual = {
          mision,
          area,
          competencias_duras: duras.filter((d) => d.nombre.trim()),
          competencias_blandas: blandas.filter((b) => b.nombre.trim()),
        };
      }

      const { data, error: iErr } = await supabase.from("mindeval_vacantes").insert(payload).select().single();
      if (iErr || !data) throw new Error(iErr?.message ?? "No se pudo crear la vacante");

      router.push(`/seleccion/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar la vacante");
    } finally {
      setGuardando(false);
    }
  }

  if (verificando) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, color: "#FFFFFF", padding: "1rem 1.5rem" }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>
          MindEval <span style={{ color: GOLD }}>Selección</span> — Nueva vacante
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {error && (
          <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
            {error}
          </div>
        )}

        <section style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 16, color: NAVY }}>Datos de la vacante</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Título de la vacante *</label>
              <input style={inputStyle} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Analista de Ventas Senior" />
            </div>
            <div>
              <label style={labelStyle}>Empresa *</label>
              <input style={inputStyle} value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Corporación Andina S.A." />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Código de proceso (opcional)</label>
              <input style={inputStyle} value={codigoProceso} onChange={(e) => setCodigoProceso(e.target.value)} placeholder="EC-2026-041" />
            </div>
            <div>
              <label style={labelStyle}>Fecha límite de postulación (opcional)</label>
              <input type="datetime-local" style={inputStyle} value={fechaLimitePostulacion} onChange={(e) => setFechaLimitePostulacion(e.target.value)} />
              <div style={{ fontSize: 10.5, color: "#7C89A8", marginTop: 4 }}>Pasada esta fecha, el link de postulación deja de aceptar CVs solo.</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Corte match CV (%)</label>
              <input type="number" style={inputStyle} value={corteMatchCv} onChange={(e) => setCorteMatchCv(Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle}>Corte STEN</label>
              <input type="number" min={1} max={10} style={inputStyle} value={corteSten} onChange={(e) => setCorteSten(Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle}>Corte técnica (/100)</label>
              <input type="number" style={inputStyle} value={corteTecnica} onChange={(e) => setCorteTecnica(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Pruebas psicométricas de este proceso</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(["16pf5", "kostick", "disc", "valanti"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setTestsPsicometricos((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
                  }
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: testsPsicometricos.includes(t) ? `1.5px solid ${GOLD}` : "1.5px solid #D5DCEB",
                    background: testsPsicometricos.includes(t) ? "#FFFBEF" : "#FFFFFF",
                    color: NAVY,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {testsPsicometricos.includes(t) ? "✓ " : ""}
                  {t === "16pf5" ? "16PF-5" : t === "kostick" ? "KOSTICK" : t === "disc" ? "DISC" : "VALANTI"}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: "#7C89A8", marginTop: 4 }}>
              {testsPsicometricos.length > 0
                ? "El candidato responderá esto desde su link de prueba, con calificación automática."
                : "Sin ninguna seleccionada, se usa la batería de ejemplo (registro manual del STEN). Puedes cambiar esto después desde la ficha de cualquier candidato."}
            </div>
          </div>
        </section>

        <section style={{ background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 24 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 16, color: NAVY }}>Etapa 1 — Manual de Puestos</h2>
          <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#7C89A8" }}>
            El resto de las etapas mide a los candidatos contra este perfil de referencia.
          </p>

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button
              onClick={() => setOrigenPerfil("puesto")}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 8,
                border: origenPerfil === "puesto" ? `2px solid ${NAVY}` : "1.5px solid #D5DCEB",
                background: origenPerfil === "puesto" ? "#F0F3FA" : "#FFFFFF",
                color: NAVY,
                fontWeight: 700,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              Usar puesto del Manual de Puestos
            </button>
            <button
              onClick={() => setOrigenPerfil("manual")}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 8,
                border: origenPerfil === "manual" ? `2px solid ${NAVY}` : "1.5px solid #D5DCEB",
                background: origenPerfil === "manual" ? "#F0F3FA" : "#FFFFFF",
                color: NAVY,
                fontWeight: 700,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              Definir perfil manualmente
            </button>
          </div>

          {origenPerfil === "puesto" ? (
            <div>
              {puestos.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#7C89A8" }}>
                  No hay puestos registrados en el Manual de Puestos todavía.{" "}
                  <Link href="/manual-puestos/nuevo" style={{ color: NAVY, fontWeight: 700 }}>
                    Crear uno →
                  </Link>{" "}
                  o cambia a &quot;perfil manual&quot; arriba.
                </div>
              ) : (
                <>
                  {empresa.trim() && puestosDeLaEmpresa.length === 0 && !verTodasLasEmpresas ? (
                    <div style={{ fontSize: 12.5, color: "#7C89A8", marginBottom: 8 }}>
                      No hay puestos de &quot;{empresa}&quot; en el Manual de Puestos.{" "}
                      <button type="button" onClick={() => setVerTodasLasEmpresas(true)} style={{ color: NAVY, fontWeight: 700, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontSize: 12.5 }}>
                        Ver puestos de otras empresas
                      </button>{" "}
                      o cambia a &quot;perfil manual&quot; arriba.
                    </div>
                  ) : null}
                  <select
                    style={inputStyle}
                    value={puestoId}
                    onChange={(e) => {
                      setPuestoId(e.target.value);
                      setConfirmarOtraEmpresa(false);
                    }}
                  >
                    <option value="">Selecciona un puesto…</option>
                    {puestosMostrados.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre_puesto} — {p.area} {p.empresas_mdt?.nombre ? `(${p.empresas_mdt.nombre})` : ""}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {puestoSeleccionado?.mision && (
                <div style={{ marginTop: 12, padding: 12, background: "#F7F9FD", borderRadius: 8, fontSize: 12.5, color: "#41507A" }}>
                  <strong>Misión:</strong> {puestoSeleccionado.mision}
                </div>
              )}
              {puestoDeOtraEmpresa && (
                <div style={{ marginTop: 12, padding: 12, background: "#FDEDEA", border: "1px solid #F3C2B8", borderRadius: 8, fontSize: 12.5, color: "#C4402F" }}>
                  <div style={{ marginBottom: 8 }}>
                    ⚠️ Este puesto pertenece a <strong>{puestoSeleccionado?.empresas_mdt?.nombre}</strong>, no a &quot;{empresa}&quot;. Comparar el CV contra los requisitos de otra empresa dará un % de match sin sentido.
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer" }}>
                    <input type="checkbox" checked={confirmarOtraEmpresa} onChange={(e) => setConfirmarOtraEmpresa(e.target.checked)} />
                    Sé lo que hago, usar este puesto igual
                  </label>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Misión del cargo</label>
                <textarea style={{ ...inputStyle, minHeight: 60 }} value={mision} onChange={(e) => setMision(e.target.value)} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Área</label>
                <input style={inputStyle} value={area} onChange={(e) => setArea(e.target.value)} />
              </div>

              <label style={labelStyle}>Competencias duras (excluyentes marcadas con ✓)</label>
              {duras.map((d, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <input
                    style={{ ...inputStyle, flex: 2 }}
                    placeholder="Ej. Experiencia en ventas B2B ≥ 3 años"
                    value={d.nombre}
                    onChange={(e) => setDuras((prev) => prev.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                  />
                  <input
                    type="number"
                    style={{ ...inputStyle, width: 70 }}
                    value={d.peso}
                    onChange={(e) => setDuras((prev) => prev.map((x, j) => (j === i ? { ...x, peso: Number(e.target.value) } : x)))}
                  />
                  <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="checkbox"
                      checked={d.excluyente}
                      onChange={(e) => setDuras((prev) => prev.map((x, j) => (j === i ? { ...x, excluyente: e.target.checked } : x)))}
                    />
                    Excluyente
                  </label>
                </div>
              ))}
              <button
                onClick={() => setDuras((prev) => [...prev, { nombre: "", peso: 10, excluyente: false }])}
                style={{ background: "none", border: "none", color: NAVY, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}
              >
                + Agregar competencia dura
              </button>

              <label style={labelStyle}>Competencias blandas (nivel esperado 1–10)</label>
              {blandas.map((b, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    style={{ ...inputStyle, flex: 2 }}
                    placeholder="Ej. Negociación"
                    value={b.nombre}
                    onChange={(e) => setBlandas((prev) => prev.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                  />
                  <input
                    type="number"
                    min={1}
                    max={10}
                    style={{ ...inputStyle, width: 70 }}
                    value={b.nivel_esperado}
                    onChange={(e) => setBlandas((prev) => prev.map((x, j) => (j === i ? { ...x, nivel_esperado: Number(e.target.value) } : x)))}
                  />
                </div>
              ))}
              <button
                onClick={() => setBlandas((prev) => [...prev, { nombre: "", nivel_esperado: 7 }])}
                style={{ background: "none", border: "none", color: NAVY, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                + Agregar competencia blanda
              </button>
            </div>
          )}
        </section>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button
            onClick={() => router.push("/seleccion")}
            style={{ background: "#FFFFFF", border: "1px solid #D5DCEB", color: NAVY, padding: "10px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            style={{ background: GOLD, border: "none", color: NAVY, padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: guardando ? 0.6 : 1 }}
          >
            {guardando ? "Guardando…" : "Crear vacante"}
          </button>
        </div>
      </div>
    </div>
  );
}

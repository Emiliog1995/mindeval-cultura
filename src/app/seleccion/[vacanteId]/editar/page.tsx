"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { authHeaders } from "@/lib/auth-headers";
import type { Vacante } from "@/lib/mindeval-types";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

const card: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #E3E8F2", borderRadius: 14, padding: 22, marginBottom: 18 };
const inputStyle: React.CSSProperties = { padding: "9px 11px", border: "1.5px solid #D5DCEB", borderRadius: 8, fontSize: 13, boxSizing: "border-box", width: "100%" };
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 5 };
const ayuda: React.CSSProperties = { fontSize: 11, color: "#7C89A8", marginTop: 4, lineHeight: 1.5 };

const NOMBRE_TEST: Record<"16pf5" | "kostick" | "disc" | "valanti", string> = {
  "16pf5": "16PF-5",
  kostick: "KOSTICK",
  disc: "DISC",
  valanti: "VALANTI",
};

interface Resumen {
  reactivados: number;
  descartados: number;
  avanzados: number;
  nombres_reactivados: string[];
  nombres_descartados: string[];
}

/**
 * Edición de los parámetros de una vacante en curso. Solo expone los campos
 * que YA existen en mindeval_vacantes y que de verdad influyen en el filtrado
 * o en el ranking -- el perfil del cargo (competencias y pesos) se sigue
 * editando donde siempre, en el Manual de Puestos.
 *
 * Al guardar, /api/mindeval-actualizar-vacante recalcula el embudo si los
 * cortes cambiaron. Ninguna evaluación ya rendida se borra ni se recalcula:
 * lo único que se mueve es la etapa/estado de los candidatos frente a los
 * nuevos cortes.
 */
export default function EditarVacantePage() {
  const params = useParams<{ vacanteId: string }>();
  const router = useRouter();
  const { verificando } = useAuthGuard();

  const [vacante, setVacante] = useState<Vacante | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [resumen, setResumen] = useState<Resumen | null>(null);

  const [titulo, setTitulo] = useState("");
  const [codigoProceso, setCodigoProceso] = useState("");
  const [estado, setEstado] = useState<"abierta" | "pausada" | "cerrada">("abierta");
  const [fechaLimite, setFechaLimite] = useState("");
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoEmail, setContactoEmail] = useState("");
  const [corteMatchCv, setCorteMatchCv] = useState(72);
  const [corteSten, setCorteSten] = useState(6);
  const [corteTecnica, setCorteTecnica] = useState(70);
  const [modoTecnica, setModoTecnica] = useState<"caso_abierto" | "banco">("caso_abierto");
  const [tests, setTests] = useState<("16pf5" | "kostick" | "disc" | "valanti")[]>([]);

  useEffect(() => {
    if (verificando) return;
    (async () => {
      const { data, error: vErr } = await supabase.from("mindeval_vacantes").select("*").eq("id", params.vacanteId).single();
      if (vErr || !data) {
        setError("No se encontró la vacante.");
        setCargando(false);
        return;
      }
      const v = data as Vacante;
      setVacante(v);
      setTitulo(v.titulo);
      setCodigoProceso(v.codigo_proceso ?? "");
      setEstado(v.estado);
      // datetime-local necesita YYYY-MM-DDTHH:mm en hora local del navegador
      if (v.fecha_limite_postulacion) {
        const d = new Date(v.fecha_limite_postulacion);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
        setFechaLimite(local.toISOString().slice(0, 16));
      }
      setContactoNombre(v.contacto_nombre ?? "");
      setContactoEmail(v.contacto_email ?? "");
      setCorteMatchCv(Number(v.corte_match_cv));
      setCorteSten(Number(v.corte_sten));
      setCorteTecnica(Number(v.corte_tecnica));
      setModoTecnica(v.modo_tecnica ?? "caso_abierto");
      setTests(v.tests_psicometricos ?? []);
      setCargando(false);
    })();
  }, [verificando, params.vacanteId]);

  function toggleTest(t: "16pf5" | "kostick" | "disc" | "valanti") {
    setTests((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function validar(): string | null {
    if (!titulo.trim()) return "El título de la vacante no puede quedar vacío.";
    if (!Number.isFinite(corteMatchCv) || corteMatchCv < 0 || corteMatchCv > 100) return "El corte de match de CV debe estar entre 0 y 100.";
    if (!Number.isFinite(corteSten) || corteSten < 1 || corteSten > 10) return "El corte STEN debe estar entre 1 y 10.";
    if (!Number.isFinite(corteTecnica) || corteTecnica < 0 || corteTecnica > 100) return "El corte de prueba técnica debe estar entre 0 y 100.";
    return null;
  }

  async function guardar() {
    const problema = validar();
    if (problema) {
      setError(problema);
      setResumen(null);
      return;
    }
    setError("");
    setResumen(null);
    setGuardando(true);
    try {
      const res = await fetch("/api/mindeval-actualizar-vacante", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          vacante_id: params.vacanteId,
          titulo,
          codigo_proceso: codigoProceso,
          estado,
          fecha_limite_postulacion: fechaLimite ? new Date(fechaLimite).toISOString() : null,
          contacto_nombre: contactoNombre,
          contacto_email: contactoEmail,
          corte_match_cv: corteMatchCv,
          corte_sten: corteSten,
          corte_tecnica: corteTecnica,
          modo_tecnica: modoTecnica,
          tests_psicometricos: tests,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResumen(data.resumen as Resumen);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la vacante.");
    } finally {
      setGuardando(false);
    }
  }

  if (verificando || cargando) return null;
  if (!vacante) {
    return <div style={{ padding: 40, textAlign: "center", color: "#C4402F" }}>{error || "No se encontró la vacante."}</div>;
  }

  const corteCvCambio = Number(vacante.corte_match_cv) !== corteMatchCv;
  const cortesPruebasCambiaron = Number(vacante.corte_sten) !== corteSten || Number(vacante.corte_tecnica) !== corteTecnica;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <div style={{ background: NAVY, color: "#FFFFFF", padding: "1rem 1.5rem" }}>
        <button
          onClick={() => router.push(`/seleccion/${params.vacanteId}`)}
          style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.25)", padding: "6px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer", marginBottom: 10 }}
        >
          ← Volver al proceso
        </button>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: "#8FA0CC" }}>{vacante.empresa.toUpperCase()}</div>
        <div style={{ fontSize: 19, fontWeight: 800 }}>Editar vacante</div>
        <div style={{ fontSize: 12, color: "#8FA0CC", marginTop: 4 }}>
          Criterios de evaluación y filtrado de esta vacante
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "1.75rem 1.5rem" }}>
        {error && (
          <div style={{ background: "#FDEDEA", color: "#C4402F", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>
        )}

        {resumen && (
          <div style={{ background: "#E8F6EF", border: "1px solid #12805C", color: "#0E6E4F", padding: "14px 16px", borderRadius: 10, marginBottom: 18, fontSize: 13 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Cambios guardados</div>
            {resumen.reactivados === 0 && resumen.descartados === 0 && resumen.avanzados === 0 ? (
              <div>Ningún candidato cambió de etapa con los nuevos criterios.</div>
            ) : (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
                {resumen.reactivados > 0 && (
                  <li>
                    <strong>{resumen.reactivados}</strong> candidato{resumen.reactivados > 1 ? "s" : ""} reactivado
                    {resumen.reactivados > 1 ? "s" : ""} al filtro de CV: {resumen.nombres_reactivados.join(", ")}
                  </li>
                )}
                {resumen.descartados > 0 && (
                  <li>
                    <strong>{resumen.descartados}</strong> candidato{resumen.descartados > 1 ? "s" : ""} descartado
                    {resumen.descartados > 1 ? "s" : ""} por el nuevo corte: {resumen.nombres_descartados.join(", ")}
                  </li>
                )}
                {resumen.avanzados > 0 && (
                  <li>
                    <strong>{resumen.avanzados}</strong> candidato{resumen.avanzados > 1 ? "s" : ""} avanzó a Verificación SENESCYT
                  </li>
                )}
              </ul>
            )}
            <button
              onClick={() => router.push(`/seleccion/${params.vacanteId}`)}
              style={{ marginTop: 12, background: NAVY, color: "#FFFFFF", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              Ver el ranking actualizado
            </button>
          </div>
        )}

        <section style={card}>
          <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: NAVY }}>Datos del proceso</h2>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={label}>Título de la vacante *</label>
              <input style={inputStyle} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div>
              <label style={label}>Código del proceso</label>
              <input style={inputStyle} value={codigoProceso} onChange={(e) => setCodigoProceso(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={label}>Estado</label>
              <select style={inputStyle} value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
                <option value="abierta">Abierta — recibe postulaciones</option>
                <option value="pausada">Pausada — no recibe postulaciones</option>
                <option value="cerrada">Cerrada — proceso terminado</option>
              </select>
            </div>
            <div>
              <label style={label}>Recibe CVs hasta</label>
              <input type="datetime-local" style={inputStyle} value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
              <div style={ayuda}>Vacío = sin fecha límite.</div>
            </div>
            <div>
              <label style={label}>Responsable del proceso</label>
              <input style={inputStyle} value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} placeholder="Nombre de quien atiende esta vacante" />
            </div>
            <div>
              <label style={label}>Correo del responsable</label>
              <input style={inputStyle} value={contactoEmail} onChange={(e) => setContactoEmail(e.target.value)} placeholder="nombre@empresa.com" />
              <div style={ayuda}>
                Recibe un aviso cada vez que un candidato completa una prueba, y aparece como contacto en los correos
                al candidato. Vacío = sin avisos.
              </div>
            </div>
          </div>
        </section>

        <section style={{ ...card, border: `1px solid ${GOLD}` }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, color: NAVY }}>Criterios de filtrado y ranking</h2>
          <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "#7C89A8", lineHeight: 1.6 }}>
            Estos son los cortes con los que MindEval decide quién avanza y quién se descarta. Al guardar, los
            candidatos de esta vacante se vuelven a evaluar contra los nuevos valores — sin borrar ninguna
            evaluación ya rendida.
          </p>

          <div style={{ marginBottom: 18 }}>
            <label style={label}>Corte de match de CV: {corteMatchCv}%</label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={corteMatchCv}
              onChange={(e) => setCorteMatchCv(Number(e.target.value))}
              style={{ width: "100%", accentColor: GOLD }}
            />
            <input
              type="number"
              min={0}
              max={100}
              value={corteMatchCv}
              onChange={(e) => setCorteMatchCv(Number(e.target.value))}
              style={{ ...inputStyle, width: 90, marginTop: 6 }}
            />
            <div style={ayuda}>
              Porcentaje mínimo de coincidencia entre el CV y el perfil del cargo. Un candidato por debajo se
              descarta automáticamente al postular. <strong>Bajar este valor reactiva</strong> a quienes fueron
              descartados solo por no alcanzarlo.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div>
              <label style={label}>Corte STEN psicométrico: {corteSten}</label>
              <input
                type="number"
                min={1}
                max={10}
                step={0.5}
                value={corteSten}
                onChange={(e) => setCorteSten(Number(e.target.value))}
                style={inputStyle}
              />
              <div style={ayuda}>
                Promedio mínimo de decatipo (escala 1 a 10) para avanzar a Verificación SENESCYT. Solo cuenta el
                16PF-5; KOSTICK, DISC y VALANTI no son escalas normadas y quedan fuera del promedio.
              </div>
            </div>
            <div>
              <label style={label}>Corte de prueba técnica: {corteTecnica}</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={corteTecnica}
                onChange={(e) => setCorteTecnica(Number(e.target.value))}
                style={inputStyle}
              />
              <div style={ayuda}>Puntaje mínimo sobre 100 en la prueba técnica para avanzar a Verificación SENESCYT.</div>
            </div>
          </div>
        </section>

        <section style={card}>
          <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, color: NAVY }}>Pruebas que rendirá el candidato</h2>
          <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#7C89A8", lineHeight: 1.6 }}>
            Cambiar esto afecta solo a las pruebas que se agenden de aquí en adelante. Las ya rendidas conservan
            su contenido y su calificación.
          </p>

          <label style={label}>Batería psicométrica</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {(["16pf5", "kostick", "disc", "valanti"] as const).map((t) => (
              <button
                key={t}
                onClick={() => toggleTest(t)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: tests.includes(t) ? `2px solid ${GOLD}` : "1.5px solid #D5DCEB",
                  background: tests.includes(t) ? "#FFFBEF" : "#FFFFFF",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: NAVY,
                  cursor: "pointer",
                }}
              >
                {NOMBRE_TEST[t]}
              </button>
            ))}
          </div>
          <div style={ayuda}>Sin ninguna seleccionada se usa la batería de ejemplo genérica.</div>

          <label style={{ ...label, marginTop: 16 }}>Modalidad de la prueba técnica</label>
          <select style={inputStyle} value={modoTecnica} onChange={(e) => setModoTecnica(e.target.value as typeof modoTecnica)}>
            <option value="caso_abierto">Caso práctico abierto — lo califica la IA</option>
            <option value="banco">Banco de preguntas — opción múltiple con respuesta correcta</option>
          </select>
          <div style={ayuda}>
            El modo banco requiere tener preguntas activas en el banco de esta vacante.
          </div>
        </section>

        {(corteCvCambio || cortesPruebasCambiaron) && (
          <div style={{ background: "#FFFBEF", border: "1px solid #F3E0AE", color: "#8A6400", padding: "12px 16px", borderRadius: 10, marginBottom: 18, fontSize: 12.5, lineHeight: 1.6 }}>
            <strong>Vas a cambiar un criterio que afecta el embudo.</strong> Al guardar:
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {corteCvCambio && (
                <li>
                  Los candidatos descartados solo por no alcanzar el corte de CV se reevalúan con el nuevo valor
                  ({vacante.corte_match_cv}% → {corteMatchCv}%). Quienes ya avanzaron a pruebas no se tocan.
                </li>
              )}
              {cortesPruebasCambiaron && <li>Se revisa si alguien que ya rindió sus pruebas ahora califica para avanzar a SENESCYT.</li>}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={guardar}
            disabled={guardando}
            style={{ background: GOLD, color: NAVY, border: "none", padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: guardando ? "not-allowed" : "pointer", opacity: guardando ? 0.6 : 1 }}
          >
            {guardando ? "Guardando y recalculando…" : "Guardar cambios"}
          </button>
          <button
            onClick={() => router.push(`/seleccion/${params.vacanteId}`)}
            style={{ background: "none", border: "1px solid #D5DCEB", padding: "12px 22px", borderRadius: 8, fontSize: 13.5, cursor: "pointer", color: NAVY }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

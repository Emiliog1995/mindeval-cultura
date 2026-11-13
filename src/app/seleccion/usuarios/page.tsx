"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { authHeaders } from "@/lib/auth-headers";

const NAVY = "#1B2A5B";
const GOLD = "#F5B800";

interface UsuarioFila {
  email: string;
  nombre: string | null;
  rol: string | null;
  empresa_id: string | null;
  activo: boolean;
  created_at: string;
}
interface Empresa {
  id: string;
  nombre: string;
  tipo: string;
}

const ETIQUETA_ROL: Record<string, string> = {
  super_admin: "Súper administrador",
  administrador: "Administrador",
  evaluador: "Evaluador",
};

export default function GestionUsuariosPage() {
  const { verificando } = useAuthGuard();
  const [cargando, setCargando] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [miRol, setMiRol] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioFila[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  // Formulario de alta
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<"administrador" | "evaluador">("evaluador");
  const [empresaId, setEmpresaId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/mindeval-usuarios", { headers: await authHeaders() });
      if (res.status === 403) {
        setSinPermiso(true);
        return;
      }
      const data = await res.json();
      setMiRol(data.rol ?? null);
      setUsuarios(data.usuarios ?? []);
      setEmpresas(data.empresas ?? []);
    } catch {
      setError("No se pudieron cargar los usuarios.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!verificando) cargar();
  }, [verificando, cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (miRol === "super_admin" && !empresaId) {
      setError("Elige la empresa del usuario.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/mindeval-usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          nombre,
          email,
          password,
          rol,
          empresa_id: miRol === "super_admin" ? empresaId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear el usuario.");
        return;
      }
      setOk(`Usuario ${email} creado. Entrégale su correo y contraseña para que ingrese.`);
      setNombre("");
      setEmail("");
      setPassword("");
      setRol("evaluador");
      setEmpresaId("");
      cargar();
    } catch {
      setError("No se pudo crear el usuario.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternarActivo(u: UsuarioFila) {
    setError("");
    try {
      const res = await fetch("/api/mindeval-usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ email: u.email, activo: !u.activo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo actualizar.");
        return;
      }
      cargar();
    } catch {
      setError("No se pudo actualizar.");
    }
  }

  if (verificando) return null;

  if (sinPermiso) {
    return (
      <div style={{ maxWidth: 560, margin: "80px auto", padding: 24, textAlign: "center", color: "#64748B" }}>
        <p style={{ fontSize: 15 }}>No tienes permiso para gestionar usuarios.</p>
        <Link href="/seleccion" style={{ color: NAVY, fontWeight: 700 }}>← Volver al panel</Link>
      </div>
    );
  }

  const input: React.CSSProperties = {
    width: "100%", border: "1px solid #CBD5E1", borderRadius: 8, padding: "9px 12px", fontSize: 14, color: "#0F172A",
  };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 5, display: "block" };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: 0 }}>Gestión de usuarios</h1>
        <Link href="/seleccion" style={{ color: NAVY, fontWeight: 700, fontSize: 13 }}>← Panel</Link>
      </div>
      <p style={{ color: "#64748B", fontSize: 13, marginTop: 0, marginBottom: 22 }}>
        Crea accesos para administradores y evaluadores. Cada uno entra con su correo y la contraseña que definas aquí.
      </p>

      {/* Alta */}
      <form onSubmit={crear} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 20, marginBottom: 26 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginTop: 0, marginBottom: 14 }}>Nuevo usuario</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={label}>Nombre completo</label>
            <input style={input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Tnte. Ana Pérez" />
          </div>
          <div>
            <label style={label}>Correo *</label>
            <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@institucion.gob.ec" />
          </div>
          <div>
            <label style={label}>Contraseña inicial *</label>
            <input style={input} type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 8 caracteres" />
          </div>
          <div>
            <label style={label}>Rol *</label>
            <select style={input} value={rol} onChange={(e) => setRol(e.target.value as "administrador" | "evaluador")}>
              <option value="evaluador">Evaluador</option>
              <option value="administrador">Administrador</option>
            </select>
          </div>
          {miRol === "super_admin" && (
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={label}>Empresa / Institución *</label>
              <select style={input} value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
                <option value="">— Elige la empresa o institución —</option>
                {empresas.map((em) => (
                  <option key={em.id} value={em.id}>
                    {em.nombre}{em.tipo === "institucion" ? "  ·  Institución" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {error && <p style={{ color: "#DC2626", fontSize: 13, marginTop: 14, marginBottom: 0 }}>{error}</p>}
        {ok && <p style={{ color: "#059669", fontSize: 13, marginTop: 14, marginBottom: 0 }}>{ok}</p>}
        <button
          type="submit"
          disabled={guardando}
          style={{ marginTop: 16, background: NAVY, color: GOLD, border: "none", borderRadius: 9, padding: "10px 20px", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: guardando ? 0.5 : 1 }}
        >
          {guardando ? "Creando…" : "Crear usuario"}
        </button>
      </form>

      {/* Listado */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid #E2E8F0", fontWeight: 800, color: NAVY, fontSize: 14 }}>
          Usuarios {cargando ? "" : `(${usuarios.length})`}
        </div>
        {cargando ? (
          <div style={{ padding: 24, color: "#94A3B8", fontSize: 13 }}>Cargando…</div>
        ) : usuarios.length === 0 ? (
          <div style={{ padding: 24, color: "#94A3B8", fontSize: 13 }}>Aún no hay usuarios.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", textAlign: "left" }}>
                {["Nombre", "Correo", "Rol", "Estado", ""].map((h) => (
                  <th key={h} style={{ padding: "9px 14px", color: "#64748B", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.email} style={{ borderTop: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "9px 14px", color: "#0F172A" }}>{u.nombre ?? "—"}</td>
                  <td style={{ padding: "9px 14px", color: "#475569" }}>{u.email}</td>
                  <td style={{ padding: "9px 14px", color: "#475569" }}>{u.rol ? (ETIQUETA_ROL[u.rol] ?? u.rol) : "—"}</td>
                  <td style={{ padding: "9px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: u.activo ? "#DCFCE7" : "#FEE2E2", color: u.activo ? "#15803D" : "#B91C1C" }}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right" }}>
                    {u.rol !== "super_admin" && (
                      <button
                        onClick={() => alternarActivo(u)}
                        style={{ background: "none", border: "1px solid #CBD5E1", borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: u.activo ? "#B91C1C" : "#15803D" }}
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

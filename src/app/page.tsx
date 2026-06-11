"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const EMAIL = "gerencia@mindtalentrh.com";
const PASSWORD = "Mindtalent2026";
const KEY = "mindeval_portal_v1";

function isLoggedIn() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "true";
}

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoggedIn()) router.replace("/portal");
    else setLoading(false);
  }, [router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim().toLowerCase() === EMAIL && password === PASSWORD) {
      localStorage.setItem(KEY, "true");
      router.push("/portal");
    } else {
      setError("Correo o contraseña incorrectos.");
    }
  }

  if (loading) return null;

  return (
    <div className="min-h-screen flex" style={{ background: "#f3f4f6" }}>

      {/* Panel izquierdo — branding */}
      <div
        className="hidden lg:flex lg:w-5/12 flex-col justify-between p-12"
        style={{ background: "linear-gradient(160deg, #1a2035 0%, #243447 100%)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(201,168,76,0.2)", border: "1.5px solid rgba(201,168,76,0.4)" }}
          >
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#c9a84c" opacity="0.3"/>
              <path d="M9 12l2 2 4-4" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-wider">MINDTALENT</span>
        </div>

        {/* Texto central */}
        <div>
          <div
            className="inline-block text-xs font-bold tracking-widest px-3 py-1 rounded-full mb-8"
            style={{ background: "rgba(201,168,76,0.15)", color: "#c9a84c", border: "1px solid rgba(201,168,76,0.3)" }}
          >
            ECOSISTEMA DE TALENTO HUMANO
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-6">
            Diagnóstica, desarrolla<br />y potencia el talento<br />de tu organización
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.95rem", lineHeight: "1.7" }}>
            Cultura organizacional, clima laboral, evaluación 360° y manual de puestos integrados en una sola plataforma.
          </p>

          {/* Features */}
          <div className="mt-10 flex flex-col gap-4">
            {[
              { icon: "🎯", text: "Diagnóstico de Cultura Organizacional (Modelo Denison)" },
              { icon: "🌡️", text: "Encuesta de Clima Laboral anónima" },
              { icon: "🔄", text: "Evaluación 360° con Nine Box Matrix" },
              { icon: "📋", text: "Manual de Puestos con IA y exportación PDF" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-lg">{f.icon}</span>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.75rem" }}>
          MindTalent © {new Date().getFullYear()}
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        {/* Logo móvil */}
        <div className="lg:hidden mb-10 text-center">
          <span className="font-bold text-2xl tracking-wider" style={{ color: "#1a2035" }}>MINDTALENT</span>
          <p className="text-sm mt-1" style={{ color: "#c9a84c", fontWeight: 600 }}>MINDHEART · MINDTALENT</p>
        </div>

        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-10">
            <h2 className="text-2xl font-bold mb-1" style={{ color: "#1a2035" }}>Iniciar sesión</h2>
            <p className="text-sm mb-8" style={{ color: "#9ca3af" }}>Ingresa tus credenciales de acceso</p>

            {error && (
              <div className="mb-6 px-4 py-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#374151" }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  placeholder="tu@correo.com"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: "#f8fafc",
                    border: "1.5px solid #e5e7eb",
                    color: "#111",
                  }}
                  onFocus={e => e.target.style.borderColor = "#c9a84c"}
                  onBlur={e => e.target.style.borderColor = "#e5e7eb"}
                />
              </div>

              {/* Contraseña */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#374151" }}>
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all pr-12"
                    style={{
                      background: "#f8fafc",
                      border: "1.5px solid #e5e7eb",
                      color: "#111",
                    }}
                    onFocus={e => e.target.style.borderColor = "#c9a84c"}
                    onBlur={e => e.target.style.borderColor = "#e5e7eb"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                  >
                    {showPass ? (
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-semibold text-sm mt-2 transition-all hover:opacity-90 active:scale-95"
                style={{ background: "#c9a84c", color: "#1a2035" }}
              >
                Iniciar sesión
              </button>
            </form>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: "#9ca3af" }}>
            MindTalent © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

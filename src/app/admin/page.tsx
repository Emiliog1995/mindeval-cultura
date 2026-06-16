"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

export default function AdminLogin() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (await login(pin)) {
      router.push("/dashboard");
    } else {
      setError("PIN incorrecto. Inténtalo de nuevo.");
      setPin("");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#0A1A32" }}>
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-wide" style={{ color: "#0A1A32" }}>MINDTALENT</span>
          <p className="text-gray-500 text-xs mt-1">Panel de Consultor</p>
          <div className="w-12 h-1 rounded-full mx-auto mt-3" style={{ background: "#10b981" }} />
        </div>

        {error && (
          <p className="text-red-600 bg-red-50 rounded-lg px-4 py-2.5 mb-5 text-sm text-center">{error}</p>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">PIN de acceso</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Ingresa tu PIN"
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90"
            style={{ background: "#0A1A32" }}
          >
            Ingresar al panel →
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Acceso exclusivo para consultores MINDTALENT
        </p>
      </div>
    </div>
  );
}

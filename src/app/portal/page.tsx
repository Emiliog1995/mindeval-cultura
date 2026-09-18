"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthGuard, cerrarSesion } from "@/lib/useAuthGuard";

export default function Portal() {
  const router = useRouter();
  const { verificando } = useAuthGuard();

  if (verificando) return null;

  const FONT_SYSTEM = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const EASE_APPLE = "cubic-bezier(0.16, 1, 0.3, 1)";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0A1A32 0%, #1E2D5A 100%)", fontFamily: FONT_SYSTEM }}
    >
      <style jsx>{`
        @keyframes portalCardIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .portal-grid > a { animation: portalCardIn 0.5s ${EASE_APPLE} both; }
        .portal-grid > a:nth-child(1) { animation-delay: 0ms; }
        .portal-grid > a:nth-child(2) { animation-delay: 40ms; }
        .portal-grid > a:nth-child(3) { animation-delay: 80ms; }
        .portal-grid > a:nth-child(4) { animation-delay: 120ms; }
        .portal-grid > a:nth-child(5) { animation-delay: 160ms; }
        .portal-grid > a:nth-child(6) { animation-delay: 200ms; }
        .portal-grid > a:nth-child(7) { animation-delay: 240ms; }
        .portal-grid > a:nth-child(8) { animation-delay: 280ms; }
      `}</style>

      {/* Botón cerrar sesión */}
      <button
        onClick={async () => { await cerrarSesion(); router.push("/"); }}
        className="fixed top-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold hover:opacity-90 active:scale-95 backdrop-blur-md"
        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.16)", cursor: "pointer", transition: `opacity 200ms ${EASE_APPLE}, transform 150ms ${EASE_APPLE}, background 200ms ${EASE_APPLE}` }}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Cerrar sesión
      </button>

      {/* Logo / Marca */}
      <div className="text-center mb-14">
        <div
          className="inline-block px-6 py-2 rounded-full text-xs font-bold tracking-widest mb-7"
          style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}
        >
          MINDTALENT
        </div>
        <h1 className="text-5xl font-bold text-white mb-4" style={{ letterSpacing: "-0.025em" }}>
          Ecosistema de Talento Humano
        </h1>
        <p className="text-lg font-semibold" style={{ color: "#10b981" }}>
          MindHealth · by MINDTALENT
        </p>
      </div>

      {/* Tarjetas */}
      <div className="portal-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5 w-full max-w-6xl">

        {/* Participante DOCS */}
        <Link href="/evaluacion" className="group block">
          <div
            className="rounded-2xl p-8 text-center transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] group-hover:shadow-[0_28px_54px_-22px_rgba(16,185,129,0.35)] group-active:scale-[0.98] cursor-pointer h-full"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderTop: "2px solid rgba(16,185,129,0.55)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "linear-gradient(160deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))", border: "1px solid rgba(16,185,129,0.35)" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="#10b981" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Evaluación de Cultura</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Responde el cuestionario de cultura organizacional asignado por tu empresa
            </p>
            <div
              className="mt-6 inline-block px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-transform duration-200 group-hover:translate-x-0.5"
              style={{ background: "#10b981", color: "#0A1A32" }}
            >
              Iniciar evaluación →
            </div>
          </div>
        </Link>

        {/* Clima Laboral */}
        <Link href="/clima" className="group block">
          <div
            className="rounded-2xl p-8 text-center transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] group-hover:shadow-[0_28px_54px_-22px_rgba(16,185,129,0.35)] group-active:scale-[0.98] cursor-pointer h-full"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderTop: "2px solid rgba(16,185,129,0.55)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "linear-gradient(160deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))", border: "1px solid rgba(16,185,129,0.35)" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="#10b981" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Encuesta de Clima</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Encuesta anónima de clima laboral — tus respuestas son confidenciales
            </p>
            <div
              className="mt-6 inline-block px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-transform duration-200 group-hover:translate-x-0.5"
              style={{ background: "#10b981", color: "#0A1A32" }}
            >
              Responder encuesta →
            </div>
          </div>
        </Link>

        {/* Evaluación 360° */}
        <Link href="/evaluacion-360" className="group block">
          <div
            className="rounded-2xl p-8 text-center transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] group-hover:shadow-[0_28px_54px_-22px_rgba(16,185,129,0.35)] group-active:scale-[0.98] cursor-pointer h-full"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderTop: "2px solid rgba(16,185,129,0.55)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "linear-gradient(160deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))", border: "1px solid rgba(16,185,129,0.35)" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="#10b981" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Evaluación 360°</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Retroalimentación multi-fuente con Nine Box y plan de desarrollo individual
            </p>
            <div
              className="mt-6 inline-block px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-transform duration-200 group-hover:translate-x-0.5"
              style={{ background: "#10b981", color: "#0A1A32" }}
            >
              Iniciar 360° →
            </div>
          </div>
        </Link>

        {/* Manual de Puestos */}
        <Link href="/manual-puestos" className="group block">
          <div
            className="rounded-2xl p-8 text-center transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] group-hover:shadow-[0_28px_54px_-22px_rgba(16,185,129,0.35)] group-active:scale-[0.98] cursor-pointer h-full"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderTop: "2px solid rgba(16,185,129,0.55)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "linear-gradient(160deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))", border: "1px solid rgba(16,185,129,0.35)" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="#10b981" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Manual de Puestos</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Fichas MDT por competencias con IA — F + (CE × CM) — exportación PDF
            </p>
            <div
              className="mt-6 inline-block px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-transform duration-200 group-hover:translate-x-0.5"
              style={{ background: "#10b981", color: "#0A1A32" }}
            >
              Gestionar puestos →
            </div>
          </div>
        </Link>

        {/* MindEval Selección */}
        <Link href="/seleccion" className="group block">
          <div
            className="rounded-2xl p-8 text-center transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] group-hover:shadow-[0_28px_54px_-22px_rgba(0,215,224,0.4)] group-active:scale-[0.98] cursor-pointer h-full"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderTop: "2px solid rgba(0,215,224,0.6)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "linear-gradient(160deg, rgba(0,215,224,0.24), rgba(0,215,224,0.08))", border: "1px solid rgba(0,215,224,0.4)" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="#00D7E0" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">MindEval Selección</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Selección de talento con 7 etapas e IA — CVs, SENESCYT, psicométricas, técnica, assessment y entrevista
            </p>
            <div
              className="mt-6 inline-block px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-transform duration-200 group-hover:translate-x-0.5"
              style={{ background: "#00D7E0", color: "#0A1A32" }}
            >
              Gestionar selección →
            </div>
          </div>
        </Link>

        {/* Nómina */}
        <Link href="/nomina" className="group block">
          <div
            className="rounded-2xl p-8 text-center transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] group-hover:shadow-[0_28px_54px_-22px_rgba(249,185,18,0.35)] group-active:scale-[0.98] cursor-pointer h-full"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderTop: "2px solid rgba(249,185,18,0.55)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "linear-gradient(160deg, rgba(249,185,18,0.22), rgba(249,185,18,0.08))", border: "1px solid rgba(249,185,18,0.35)" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="#F9B912" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 7h6m-6 4h6m-6 4h4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Nómina Ecuador</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Rol de pagos, provisiones, décimos, vacaciones y liquidaciones — Ecuador 2026
            </p>
            <div
              className="mt-6 inline-block px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-transform duration-200 group-hover:translate-x-0.5"
              style={{ background: "#F9B912", color: "#0A1A32" }}
            >
              Gestionar nómina →
            </div>
          </div>
        </Link>

        {/* Panel de clientes */}
        <Link href="/admin/clientes" className="group block">
          <div
            className="rounded-2xl p-8 text-center transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] group-hover:shadow-[0_28px_54px_-22px_rgba(249,185,18,0.35)] group-active:scale-[0.98] cursor-pointer h-full"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderTop: "2px solid rgba(249,185,18,0.55)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "linear-gradient(160deg, rgba(249,185,18,0.22), rgba(249,185,18,0.08))", border: "1px solid rgba(249,185,18,0.35)" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="#F9B912" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M19 21H5m0 0H3m4-14h2m-2 4h2m-2 4h2m6-8h2m-2 4h2m-2 4h2" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Panel de Clientes</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Empresas registradas y módulos activos por cliente — activar, pausar, ir al módulo
            </p>
            <div
              className="mt-6 inline-block px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-transform duration-200 group-hover:translate-x-0.5"
              style={{ background: "#F9B912", color: "#0A1A32" }}
            >
              Ver clientes →
            </div>
          </div>
        </Link>

        {/* Consultor */}
        <Link href="/dashboard" className="group block">
          <div
            className="rounded-2xl p-8 text-center transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] group-hover:shadow-[0_28px_54px_-22px_rgba(255,255,255,0.15)] group-active:scale-[0.98] cursor-pointer h-full"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderTop: "2px solid rgba(255,255,255,0.3)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="rgba(255,255,255,0.7)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Acceso consultor</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Panel de control con resultados, informes individuales y exportación de datos
            </p>
            <div
              className="mt-6 inline-block px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-transform duration-200 group-hover:translate-x-0.5"
              style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              Ingresar →
            </div>
          </div>
        </Link>
      </div>

      {/* Footer */}
      <div className="mt-12 flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
        <span>© {new Date().getFullYear()} MINDTALENT · gerencia@mindtalentrh.com</span>
        <span>·</span>
        <a href="/privacidad" className="underline hover:opacity-80 transition-opacity">
          Aviso de Privacidad
        </a>
      </div>
    </div>
  );
}

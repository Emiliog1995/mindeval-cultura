"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function isLoggedIn() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("mindeval_portal_v1") === "true";
}

export default function Portal() {
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) router.replace("/");
  }, [router]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #1a2035 0%, #243447 100%)" }}
    >
      {/* Logo / Marca */}
      <div className="text-center mb-12">
        <div
          className="inline-block px-6 py-2 rounded-full text-xs font-bold tracking-widest mb-6"
          style={{ background: "rgba(201,168,76,0.15)", color: "#c9a84c", border: "1px solid rgba(201,168,76,0.3)" }}
        >
          MINDTALENT
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">
          Ecosistema de Talento Humano
        </h1>
        <p className="text-lg font-semibold" style={{ color: "#c9a84c" }}>
          MINDHEART · MINDTALENT
        </p>
      </div>

      {/* Tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 w-full max-w-6xl">

        {/* Participante DOCS */}
        <Link href="/evaluacion" className="group block">
          <div
            className="rounded-2xl p-8 text-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-2xl cursor-pointer h-full"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(201,168,76,0.15)", border: "2px solid rgba(201,168,76,0.4)" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="#c9a84c" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Evaluación de Cultura</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Responde el cuestionario de cultura organizacional asignado por tu empresa
            </p>
            <div
              className="mt-6 inline-block px-5 py-2 rounded-full text-sm font-semibold"
              style={{ background: "#c9a84c", color: "#1a2035" }}
            >
              Iniciar evaluación →
            </div>
          </div>
        </Link>

        {/* Clima Laboral */}
        <Link href="/clima" className="group block">
          <div
            className="rounded-2xl p-8 text-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-2xl cursor-pointer h-full"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(201,168,76,0.15)", border: "2px solid rgba(201,168,76,0.4)" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="#c9a84c" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Encuesta de Clima</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Encuesta anónima de clima laboral — tus respuestas son confidenciales
            </p>
            <div
              className="mt-6 inline-block px-5 py-2 rounded-full text-sm font-semibold"
              style={{ background: "#c9a84c", color: "#1a2035" }}
            >
              Responder encuesta →
            </div>
          </div>
        </Link>

        {/* Evaluación 360° */}
        <Link href="/evaluacion-360" className="group block">
          <div
            className="rounded-2xl p-8 text-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-2xl cursor-pointer h-full"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(201,168,76,0.15)", border: "2px solid rgba(201,168,76,0.4)" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="#c9a84c" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Evaluación 360°</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Retroalimentación multi-fuente con Nine Box y plan de desarrollo individual
            </p>
            <div
              className="mt-6 inline-block px-5 py-2 rounded-full text-sm font-semibold"
              style={{ background: "#c9a84c", color: "#1a2035" }}
            >
              Iniciar 360° →
            </div>
          </div>
        </Link>

        {/* Manual de Puestos */}
        <Link href="/manual-puestos" className="group block">
          <div
            className="rounded-2xl p-8 text-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-2xl cursor-pointer h-full"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(201,168,76,0.15)", border: "2px solid rgba(201,168,76,0.4)" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="#c9a84c" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Manual de Puestos</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Fichas MDT por competencias con IA — F + (CE × CM) — exportación PDF
            </p>
            <div
              className="mt-6 inline-block px-5 py-2 rounded-full text-sm font-semibold"
              style={{ background: "#c9a84c", color: "#1a2035" }}
            >
              Gestionar puestos →
            </div>
          </div>
        </Link>

        {/* Consultor */}
        <Link href="/admin" className="group block">
          <div
            className="rounded-2xl p-8 text-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-2xl cursor-pointer h-full"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.2)" }}
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
              className="mt-6 inline-block px-5 py-2 rounded-full text-sm font-semibold"
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
        <span>·</span>
        <button
          onClick={() => { localStorage.removeItem("mindeval_portal_v1"); window.location.href = "/"; }}
          className="underline hover:opacity-80 transition-opacity"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

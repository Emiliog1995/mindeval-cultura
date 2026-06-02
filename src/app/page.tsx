"use client";

import Link from "next/link";

export default function Portal() {
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
          Diagnóstico de Cultura Organizacional
        </h1>
        <p className="text-lg" style={{ color: "rgba(255,255,255,0.55)" }}>
          Modelo Denison
        </p>
      </div>

      {/* Tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">

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
      <p className="mt-12 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
        © {new Date().getFullYear()} MINDTALENT · gerencia@mindtalentrh.com
      </p>
    </div>
  );
}

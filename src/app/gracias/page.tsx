export default function Gracias() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f0f4f8" }}>
      <header style={{ background: "#0A1A32" }} className="py-4 px-6 shadow-lg">
        <div className="max-w-3xl mx-auto">
          <span style={{ color: "#10b981" }} className="text-xl font-bold tracking-wide">MINDTALENT</span>
          <p className="text-white text-xs mt-0.5 opacity-70">Assessment Center Digital · Quito, Ecuador</p>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-2xl shadow-md p-10 max-w-lg w-full text-center">

          {/* Ícono de check */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: "#0A1A32" }}
          >
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            ¡Gracias por tu participación!
          </h1>

          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            Tu evaluación ha sido registrada exitosamente. El equipo de <strong>MINDTALENT</strong> procesará
            los resultados y te los compartirá a través de tu consultor.
          </p>

          <div
            className="rounded-xl px-5 py-4 text-left mb-6"
            style={{ background: "#f8f6f0", borderLeft: "4px solid #10b981" }}
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Diagnóstico</p>
            <p className="text-sm font-bold text-gray-800">Cultura Organizacional DOCS – Modelo Denison</p>
            <p className="text-xs text-gray-500 mt-1">60 ítems · 4 dimensiones · 12 subescalas</p>
          </div>

          <p className="text-xs text-gray-400">
            Puedes cerrar esta ventana.
          </p>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-gray-400">
        MINDTALENT · gerencia@mindtalentrh.com · Quito, Ecuador
      </footer>
    </div>
  );
}

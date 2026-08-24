"use client";

interface Colaborador {
  nombre: string;
  cuadrante: number;
  puntaje360: number;
  potencial: number;
}

interface Props {
  colaboradores: Colaborador[];
  onSelect?: (nombre: string) => void;
}

const CELDAS: Array<{
  numero: number;
  nombre: string;
  bg: string;
  row: number;
  col: number;
}> = [
  { numero: 1, nombre: "ENIGMA",                 bg: "#fef9c3", row: 0, col: 0 },
  { numero: 2, nombre: "TALENTO EN CRECIMIENTO",  bg: "#dcfce7", row: 0, col: 1 },
  { numero: 3, nombre: "ESTRELLA",                bg: "#dcfce7", row: 0, col: 2 },
  { numero: 4, nombre: "INCONSISTENTE",           bg: "#fecaca", row: 1, col: 0 },
  { numero: 5, nombre: "PROFESIONAL CLAVE",       bg: "#fef9c3", row: 1, col: 1 },
  { numero: 6, nombre: "ALTO DESEMPEÑO",          bg: "#dcfce7", row: 1, col: 2 },
  { numero: 7, nombre: "RIESGO",                  bg: "#fecaca", row: 2, col: 0 },
  { numero: 8, nombre: "TRABAJADOR EFICAZ",       bg: "#fef9c3", row: 2, col: 1 },
  { numero: 9, nombre: "EXPERTO",                 bg: "#dcfce7", row: 2, col: 2 },
];

export default function NineBoxMatrix({ colaboradores, onSelect }: Props) {
  return (
    <div className="relative">
      {/* Eje Y label */}
      <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-gray-400 whitespace-nowrap">
        ↑ Potencial
      </div>

      <div className="grid grid-cols-3 gap-1" style={{ gridTemplateRows: "repeat(3, minmax(90px, 1fr))" }}>
        {CELDAS.map((celda) => {
          const personas = colaboradores.filter((c) => c.cuadrante === celda.numero);
          return (
            <div
              key={celda.numero}
              className="rounded p-2 relative min-h-[90px]"
              style={{ backgroundColor: celda.bg }}
            >
              <span className="absolute top-1 right-1 text-xs font-bold text-gray-500">
                {celda.numero}
              </span>
              <p className="text-[9px] font-semibold text-gray-600 mb-1 pr-3 leading-tight">
                {celda.nombre}
              </p>
              <div className="flex flex-wrap gap-1">
                {personas.map((p, i) => (
                  <button
                    key={`${p.nombre}-${i}`}
                    onClick={() => onSelect?.(p.nombre)}
                    className="text-[10px] bg-white/80 text-gray-700 rounded px-1.5 py-0.5 font-medium truncate max-w-[80px] hover:bg-white transition-colors"
                    title={`${p.nombre} — 360°: ${p.puntaje360.toFixed(2)} | Potencial: ${p.potencial.toFixed(2)}`}
                  >
                    {p.nombre.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Eje X label */}
      <div className="text-center text-xs text-gray-400 mt-2">← Desempeño 360° →</div>
      <div className="flex justify-between text-[10px] text-gray-500 px-2">
        <span>Bajo</span><span>Medio</span><span>Alto</span>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

/**
 * Perfil de una prueba como barras horizontales: una barra por escala, todas
 * contra el mismo máximo. Una sola serie -> un solo color y sin leyenda (el
 * título de la tarjeta ya dice qué prueba es). Los números van en tinta de
 * texto, no en el color de la barra. La tabla con el detalle se mantiene
 * debajo: el gráfico es la lectura rápida, no reemplaza los datos.
 */
export interface FilaPerfil {
  etiqueta: string;
  valor: number | null;
  /** Texto del valor tal como se muestra (ej. "7", "18 / 24"). */
  valorTexto: string;
  /** Línea extra para el tooltip (ej. "Bruto 18 de 24 · Categoría Alto"). */
  detalle?: string;
}

const TINTA = "#1B2A5B";
const BARRA = "#1B2A5B";
const PISTA = "#EEF1F7";
const TENUE = "#7C89A8";

export default function PerfilBarras({ filas, max, pie }: { filas: FilaPerfil[]; max: number; pie?: string }) {
  const [activa, setActiva] = useState<number | null>(null);
  if (!filas.length || max <= 0) return null;

  return (
    <div style={{ padding: "12px 14px 6px" }} role="img" aria-label={`Perfil en barras, escala de 0 a ${max}`}>
      {filas.map((f, i) => {
        const pct = f.valor === null ? 0 : Math.max(0, Math.min(100, (f.valor / max) * 100));
        const on = activa === i;
        return (
          <div
            key={`${f.etiqueta}-${i}`}
            onMouseEnter={() => setActiva(i)}
            onMouseLeave={() => setActiva(null)}
            onFocus={() => setActiva(i)}
            onBlur={() => setActiva(null)}
            tabIndex={0}
            style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(110px, 34%) 1fr 64px", alignItems: "center", gap: 10, padding: "5px 6px", borderRadius: 6, background: on ? "#F7F9FD" : "transparent", outline: "none" }}
          >
            <div style={{ fontSize: 12, color: TINTA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.etiqueta}</div>
            <div style={{ height: 10, background: PISTA, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: BARRA, borderRadius: "0 4px 4px 0", opacity: activa === null || on ? 1 : 0.55, transition: "opacity 120ms" }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: TINTA, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.valorTexto}</div>
            {on && f.detalle && (
              <div style={{ position: "absolute", left: "34%", top: "100%", zIndex: 5, marginTop: 2, background: "#0B1020", color: "#FFFFFF", fontSize: 11.5, padding: "6px 9px", borderRadius: 6, whiteSpace: "nowrap", pointerEvents: "none", boxShadow: "0 4px 14px rgba(0,0,0,0.18)" }}>
                <strong>{f.etiqueta}</strong> · {f.detalle}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(110px, 34%) 1fr 64px", gap: 10, padding: "2px 6px 0" }}>
        <span />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: TENUE }}>
          <span>0</span>
          <span>{max / 2}</span>
          <span>{max}</span>
        </div>
        <span />
      </div>
      {pie && <div style={{ fontSize: 11, color: TENUE, padding: "6px 6px 0" }}>{pie}</div>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { periodosSugeridos } from "@/lib/360-types";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const OPCIONES = periodosSugeridos();

export default function PeriodoSelect({ value, onChange, className }: Props) {
  const [modoManual, setModoManual] = useState(!!value && !OPCIONES.includes(value));

  if (modoManual) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ej: 2026-S2"
        className={className}
      />
    );
  }

  return (
    <select
      value={OPCIONES.includes(value) ? value : ""}
      onChange={(e) => {
        if (e.target.value === "__otro__") {
          setModoManual(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
      className={className}
    >
      <option value="">Selecciona…</option>
      {OPCIONES.map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
      <option value="__otro__">Otro…</option>
    </select>
  );
}

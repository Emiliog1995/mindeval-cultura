import type { SeveridadAlerta } from "./mindeval-types";

export function categoriaSten(sten: number): string {
  if (sten >= 9) return "Muy alto";
  if (sten >= 7) return "Alto";
  if (sten >= 5) return "Medio";
  if (sten >= 3) return "Bajo";
  return "Muy bajo";
}

export function percentilDeSten(sten: number): number {
  return Math.round(((sten - 1) / 9) * 100);
}

export function calcularIdoneidadGlobal(input: {
  matchCv?: number;
  stenPromedio?: number;
  tecnicaTotal?: number;
  assessmentPromedio?: number;
}): number | null {
  const pesos: Array<[number | undefined, number]> = [
    [input.matchCv, 0.3],
    [input.stenPromedio !== undefined ? (input.stenPromedio / 10) * 100 : undefined, 0.25],
    [input.tecnicaTotal, 0.25],
    [input.assessmentPromedio !== undefined ? (input.assessmentPromedio / 10) * 100 : undefined, 0.2],
  ];
  const disponibles = pesos.filter(([v]) => v !== undefined) as Array<[number, number]>;
  if (!disponibles.length) return null;
  const pesoTotal = disponibles.reduce((s, [, p]) => s + p, 0);
  const suma = disponibles.reduce((s, [v, p]) => s + v * p, 0);
  return Math.round(suma / pesoTotal);
}

const PENALIZACION: Record<SeveridadAlerta, number> = { bajo: 0, medio: 5, alto: 15, critico: 30 };

export function calcularIndiceIntegridad(alertas: { severidad: SeveridadAlerta }[]): number {
  const total = alertas.reduce((s, a) => s + PENALIZACION[a.severidad], 0);
  return Math.max(0, 100 - total);
}

export function promedio(nums: number[]): number | undefined {
  if (!nums.length) return undefined;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

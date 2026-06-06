"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer, LabelList,
} from "recharts";

interface Brecha {
  label: string;
  meta: number;
  actual: number;
  brecha: number;
  prioridad: 'alta' | 'media' | 'baja';
}

interface Props {
  brechas: Brecha[];
}

const PRIORIDAD_COLOR: Record<string, string> = {
  alta:  '#ef4444',
  media: '#eab308',
  baja:  '#22c55e',
};

export default function BrechasChart({ brechas }: Props) {
  const data = brechas.map((b) => ({
    name: b.label.length > 12 ? b.label.slice(0, 12) + '…' : b.label,
    Meta:   b.meta,
    Actual: b.actual,
    brecha: b.brecha,
    prioridad: b.prioridad,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d3a50" />
        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <YAxis domain={[0, 5]} tick={{ fill: "#64748b", fontSize: 10 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1e2a42", border: "1px solid #2d3a50", borderRadius: 8 }}
          formatter={(value) => (typeof value === "number" ? value.toFixed(2) : value)}
        />
        <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
        <ReferenceLine y={4.0} stroke="#c9a84c" strokeDasharray="4 4" label={{ value: "Meta 4.0", fill: "#c9a84c", fontSize: 10 }} />
        <ReferenceLine y={4.5} stroke="#2dd4bf" strokeDasharray="4 4" label={{ value: "Meta 4.5", fill: "#2dd4bf", fontSize: 10 }} />
        <Bar dataKey="Meta" fill="#c9a84c" fillOpacity={0.5} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Actual" fill="#2dd4bf" radius={[4, 4, 0, 0]}>
          <LabelList
            dataKey="brecha"
            position="top"
            formatter={(v: unknown) => { const n = Number(v); return n > 0 ? `-${n.toFixed(1)}` : '✓'; }}
            style={{ fontSize: 10 }}
            content={(props) => {
              const { x, y, width, value, index } = props as {
                x: number; y: number; width: number; value: number; index: number;
              };
              const color = PRIORIDAD_COLOR[data[index]?.prioridad ?? 'baja'];
              return (
                <text x={(x ?? 0) + (width ?? 0) / 2} y={(y ?? 0) - 4} textAnchor="middle" fill={color} fontSize={10} fontWeight={600}>
                  {(value as number) > 0 ? `-${(value as number).toFixed(1)}` : '✓'}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface Props {
  data: Array<{ competencia: string; actual: number; meta: number }>;
  height?: number;
}

export default function RadarChart360({ data, height = 340 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#2d3a50" />
        <PolarAngleAxis dataKey="competencia" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: "#64748b", fontSize: 10 }} />
        <Radar
          name="Meta organizacional"
          dataKey="meta"
          stroke="#c9a84c"
          fill="#c9a84c"
          fillOpacity={0.1}
          strokeDasharray="5 5"
          strokeWidth={2}
        />
        <Radar
          name="Puntaje actual"
          dataKey="actual"
          stroke="#2dd4bf"
          fill="#2dd4bf"
          fillOpacity={0.3}
          strokeWidth={2}
        />
        <Tooltip
          contentStyle={{ backgroundColor: "#1e2a42", border: "1px solid #2d3a50", borderRadius: 8 }}
          labelStyle={{ color: "#e2e8f0", fontWeight: 600 }}
          formatter={(value, name) => [typeof value === "number" ? value.toFixed(2) : String(value), name as string]}
        />
        <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface CoCoveragePoint {
  outcome: string;
  percentage: number;
}

function toneForCoverage(pct: number): string {
  if (pct >= 80) return "#1a7f4b";
  if (pct >= 60) return "#b7791f";
  return "#c22a2a";
}

export default function CoCoverageChart({ data }: { data: CoCoveragePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 0 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="outcome"
          width={44}
          tick={{ fontSize: 12, fill: "#334155", fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(24, 47, 104, 0.04)" }}
          contentStyle={{ borderRadius: 8, borderColor: "#e5e9f2", fontSize: 13 }}
          formatter={(value: number) => [`${value}% coverage`, ""]}
        />
        <Bar dataKey="percentage" radius={[0, 6, 6, 0]} maxBarSize={16} background={{ fill: "#f1f3f9", radius: 6 }}>
          {data.map((entry) => (
            <Cell key={entry.outcome} fill={toneForCoverage(entry.percentage)} />
          ))}
          <LabelList
            dataKey="percentage"
            position="right"
            formatter={(v: number) => `${v}%`}
            style={{ fontSize: 12, fontWeight: 600, fill: "#334155" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

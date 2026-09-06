import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BloomDistribution } from "../../types";
import { bloomLabel } from "../../lib/format";

const BLOOM_COLORS: Record<string, string> = {
  REMEMBER: "#a3a9fd",
  UNDERSTAND: "#8285f8",
  APPLY: "#6a64ef",
  ANALYZE: "#5a4be0",
  EVALUATE: "#4c3cc4",
  CREATE: "#3f339e",
};

export default function DifficultyDistributionChart({ data }: { data: BloomDistribution[] }) {
  const chartData = data.map((d) => ({ ...d, name: bloomLabel(d.level) }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e9f2" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          contentStyle={{ borderRadius: 8, borderColor: "#e5e9f2", fontSize: 13 }}
          formatter={(value: number) => [`${value}%`, "Question share"]}
        />
        <Bar dataKey="percentage" radius={[6, 6, 0, 0]} maxBarSize={40}>
          {chartData.map((entry) => (
            <Cell key={entry.level} fill={BLOOM_COLORS[entry.level] ?? "#6a64ef"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

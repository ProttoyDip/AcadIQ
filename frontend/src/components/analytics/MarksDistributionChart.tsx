import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "../../lib/chartTheme";

interface MarksDistributionChartProps {
  data: { topic: string; marks: number; percentage: number }[];
}

export default function MarksDistributionChart({ data }: MarksDistributionChartProps) {
  const t = useChartTheme();

  if (!data.length) {
    return (
      <p className="flex h-full items-center justify-center text-small text-muted-foreground">
        No marks distribution data yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={t.grid} />
        <XAxis type="number" tick={{ fontSize: 12, fill: t.axis }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="topic"
          width={140}
          tick={{ fontSize: 12, fill: t.axisStrong }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: t.track, opacity: 0.5 }}
          contentStyle={t.tooltip}
          formatter={(v: number) => [`${v} marks`, ""]}
        />
        <Bar dataKey="marks" fill={t.primary} radius={[0, 6, 6, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

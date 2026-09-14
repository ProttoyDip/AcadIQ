import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "../../lib/chartTheme";

export interface QualityTrendPoint {
  label: string;
  score: number;
}

export default function QualityTrendChart({ data }: { data: QualityTrendPoint[] }) {
  const t = useChartTheme();

  if (!data.length) {
    return (
      <p className="flex h-full items-center justify-center text-small text-muted-foreground">
        No quality history yet. Analyze a paper to start the trend.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="qualityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.primary} stopOpacity={0.3} />
            <stop offset="100%" stopColor={t.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={t.grid} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: t.axis }} axisLine={false} tickLine={false} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: t.axis }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip contentStyle={t.tooltip} formatter={(value: number) => [`${value}`, "Quality score"]} />
        <Area
          type="monotone"
          dataKey="score"
          stroke={t.primary}
          strokeWidth={2.5}
          fill="url(#qualityFill)"
          dot={{ r: 3, fill: t.primary, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: t.primary, stroke: t.surface, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

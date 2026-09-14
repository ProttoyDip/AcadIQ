import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme, scoreTone } from "../../lib/chartTheme";

export interface CoCoveragePoint {
  outcome: string;
  percentage: number;
}

export default function CoCoverageChart({ data }: { data: CoCoveragePoint[] }) {
  const t = useChartTheme();

  if (!data.length) {
    return (
      <p className="flex h-full items-center justify-center text-small text-muted-foreground">
        No outcome coverage data yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 4, bottom: 0 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="outcome"
          width={48}
          tick={{ fontSize: 12, fill: t.axisStrong, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: t.track, opacity: 0.5 }}
          contentStyle={t.tooltip}
          formatter={(value: number) => [`${value}% coverage`, ""]}
        />
        <Bar dataKey="percentage" radius={[0, 6, 6, 0]} maxBarSize={16} background={{ fill: t.track, radius: 6 }}>
          {data.map((entry) => (
            <Cell key={entry.outcome} fill={scoreTone(t, entry.percentage)} />
          ))}
          {/* Values are labelled directly so coverage never depends on colour alone */}
          <LabelList
            dataKey="percentage"
            position="right"
            formatter={(v: number) => `${v}%`}
            style={{ fontSize: 12, fontWeight: 600, fill: t.axisStrong }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

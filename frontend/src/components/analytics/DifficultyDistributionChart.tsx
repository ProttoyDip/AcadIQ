import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BloomDistribution } from "../../types";
import { bloomLabel } from "../../lib/format";
import { useChartTheme } from "../../lib/chartTheme";

/** Bloom levels run light to dark, so cognitive depth reads as colour intensity. */
const BLOOM_ORDER = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"];

export default function DifficultyDistributionChart({ data }: { data: BloomDistribution[] }) {
  const t = useChartTheme();
  const chartData = data.map((d) => ({ ...d, name: bloomLabel(d.level) }));

  if (!chartData.length) {
    return (
      <p className="flex h-full items-center justify-center text-small text-muted-foreground">
        No Bloom distribution data yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={t.grid} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: t.axis }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          unit="%"
          tick={{ fontSize: 12, fill: t.axis }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ fill: t.track, opacity: 0.5 }}
          contentStyle={t.tooltip}
          formatter={(value: number) => [`${value}%`, "Question share"]}
        />
        <Bar dataKey="percentage" radius={[6, 6, 0, 0]} maxBarSize={40}>
          {chartData.map((entry) => {
            const idx = BLOOM_ORDER.indexOf(entry.level);
            return <Cell key={entry.level} fill={t.bloom[idx === -1 ? 2 : idx]} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

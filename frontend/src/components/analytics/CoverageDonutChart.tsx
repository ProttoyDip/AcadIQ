import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useChartTheme } from "../../lib/chartTheme";

interface CoverageDonutChartProps {
  covered: number;
  missing: number;
}

export default function CoverageDonutChart({ covered, missing }: CoverageDonutChartProps) {
  const t = useChartTheme();
  const total = covered + missing;
  const data = [
    { name: "Covered", value: covered, color: t.success },
    { name: "Missing", value: missing, color: t.error },
  ];

  if (total === 0) {
    return (
      <p className="flex h-full items-center justify-center text-small text-muted-foreground">
        No syllabus coverage data yet.
      </p>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="66%"
            outerRadius="96%"
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} stroke={t.surface} strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip contentStyle={t.tooltip} />
          <Legend
            verticalAlign="bottom"
            height={24}
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ color: t.axis, fontSize: 12 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
        <span className="tnum text-heading font-bold text-foreground">
          {Math.round((covered / total) * 100)}%
        </span>
        <span className="text-xs text-muted-foreground">covered</span>
      </div>
    </div>
  );
}

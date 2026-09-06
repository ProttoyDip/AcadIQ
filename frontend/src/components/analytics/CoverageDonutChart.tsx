import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface CoverageDonutChartProps {
  covered: number;
  missing: number;
}

export default function CoverageDonutChart({ covered, missing }: CoverageDonutChartProps) {
  const total = covered + missing;
  const data = [
    { name: "Covered", value: covered, color: "#1a7f4b" },
    { name: "Missing", value: missing, color: "#c22a2a" },
  ];

  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="68%" outerRadius="100%" paddingAngle={2} startAngle={90} endAngle={-270}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e5e9f2", fontSize: 13 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-heading font-bold text-foreground">{total > 0 ? Math.round((covered / total) * 100) : 0}%</span>
        <span className="text-xs text-muted-foreground">covered</span>
      </div>
    </div>
  );
}

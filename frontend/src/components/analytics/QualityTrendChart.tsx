import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface QualityTrendPoint {
  label: string;
  score: number;
}

export default function QualityTrendChart({ data }: { data: QualityTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="qualityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#182f68" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#182f68" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e9f2" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          contentStyle={{ borderRadius: 8, borderColor: "#e5e9f2", fontSize: 13 }}
          formatter={(value: number) => [`${value}`, "Quality score"]}
        />
        <Area type="monotone" dataKey="score" stroke="#182f68" strokeWidth={2.5} fill="url(#qualityFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

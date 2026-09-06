import { PRIORITY_COLORS } from "../utils/constants";

interface Recommendation {
  message: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
}

export default function RecommendationPanel({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) {
    return <p className="text-sm text-slate-400">No recommendations generated.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {recommendations.map((rec, idx) => (
        <div key={idx} className="flex items-start gap-3 rounded-md border border-slate-200 bg-white p-3">
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[rec.priority]}`}>
            {rec.priority}
          </span>
          <p className="text-sm text-slate-700">{rec.message}</p>
        </div>
      ))}
    </div>
  );
}

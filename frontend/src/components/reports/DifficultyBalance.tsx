import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { BloomDistribution, BloomLevel } from "../../types";

interface Tier {
  name: string;
  description: string;
  levels: BloomLevel[];
  target: number;
}

const TIERS: Tier[] = [
  {
    name: "Easy",
    description: "Remember + Understand",
    levels: ["REMEMBER", "UNDERSTAND"],
    target: 40,
  },
  {
    name: "Medium",
    description: "Apply + Analyze",
    levels: ["APPLY", "ANALYZE"],
    target: 40,
  },
  {
    name: "Hard",
    description: "Evaluate + Create",
    levels: ["EVALUATE", "CREATE"],
    target: 20,
  },
];

function statusFor(actual: number, target: number): { label: string; tone: "success" | "warning" | "error"; progressTone: "success" | "warning" | "error" } {
  const diff = actual - target;
  if (Math.abs(diff) <= 8) return { label: "Balanced", tone: "success", progressTone: "success" };
  if (diff > 8) return { label: "Above target", tone: "warning", progressTone: "warning" };
  return { label: "Below target", tone: "warning", progressTone: "warning" };
}

export default function DifficultyBalance({ data }: { data: BloomDistribution[] }) {
  const byLevel = new Map(data.map((d) => [d.level, d.percentage]));

  return (
    <div className="flex flex-col gap-5">
      {TIERS.map((tier) => {
        const actual = tier.levels.reduce((sum, level) => sum + (byLevel.get(level) ?? 0), 0);
        const status = statusFor(actual, tier.target);

        return (
          <div key={tier.name}>
            <div className="mb-1.5 flex items-center justify-between">
              <div>
                <span className="text-small font-semibold text-foreground">{tier.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{tier.description}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">target ~{tier.target}%</span>
                <Badge variant={status.tone}>{status.label}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={actual} tone={status.progressTone} className="h-2.5" />
              <span className="w-10 shrink-0 text-right text-small font-semibold text-foreground">{Math.round(actual)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

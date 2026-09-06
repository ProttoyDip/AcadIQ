import { Badge } from "../ui/badge";

function toneFor(confidence: number): "success" | "warning" | "error" {
  if (confidence >= 70) return "success";
  if (confidence >= 40) return "warning";
  return "error";
}

export default function ConfidenceBadge({ confidence }: { confidence: number }) {
  return <Badge variant={toneFor(confidence)}>{Math.round(confidence)}% confidence</Badge>;
}

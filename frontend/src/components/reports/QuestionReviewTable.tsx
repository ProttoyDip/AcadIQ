import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { QuestionReviewItem } from "../../types";
import { bloomLabel } from "../../lib/format";

function clarityTone(score: number): "success" | "warning" | "error" {
  if (score >= 75) return "success";
  if (score >= 50) return "warning";
  return "error";
}

export default function QuestionReviewTable({ questions }: { questions: QuestionReviewItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Question</TableHead>
          <TableHead>Bloom level</TableHead>
          <TableHead>Clarity</TableHead>
          <TableHead>Issues</TableHead>
          <TableHead>Suggested rewrite</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {questions.map((q) => (
          <TableRow key={q.questionId}>
            <TableCell className="font-medium text-foreground">#{q.questionId}</TableCell>
            <TableCell>
              <Badge variant="outline">{bloomLabel(q.bloomLevel)}</Badge>
            </TableCell>
            <TableCell className="w-32">
              <div className="flex items-center gap-2">
                <Progress value={q.clarityScore} tone={clarityTone(q.clarityScore)} className="h-1.5" />
                <span className="w-8 shrink-0 text-xs text-muted-foreground">{Math.round(q.clarityScore)}</span>
              </div>
            </TableCell>
            <TableCell className="max-w-xs text-small text-muted-foreground">
              {q.issues.length > 0 ? q.issues.join("; ") : "—"}
            </TableCell>
            <TableCell className="max-w-xs text-small text-foreground">{q.suggestedRewrite ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

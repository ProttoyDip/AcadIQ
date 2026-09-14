import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { BloomLevel, QuestionFeedback, QuestionReviewItem } from "../../types";
import { bloomLabel } from "../../lib/format";
import { reportService } from "../../services/reportService";

const BLOOM_LEVELS: BloomLevel[] = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"];

function clarityTone(score: number): "success" | "warning" | "error" {
  if (score >= 75) return "success";
  if (score >= 50) return "warning";
  return "error";
}

/**
 * Every thumbs-up/down and Bloom correction here is a human label — the ground
 * truth this project otherwise lacks. Corrections also write back to the question.
 */
function FeedbackControls({ question, reportId, existing }: { question: QuestionReviewItem; reportId: number; existing?: QuestionFeedback }) {
  const queryClient = useQueryClient();
  const [corrected, setCorrected] = useState<BloomLevel | "">((existing?.correctedBloomLevel as BloomLevel | null) ?? "");
  const submit = useMutation({
    mutationFn: (payload: { verdict: "UP" | "DOWN"; correctedBloomLevel?: BloomLevel }) =>
      reportService.submitFeedback({
        questionId: question.questionId,
        reportId,
        verdict: payload.verdict,
        aiBloomLevel: question.bloomLevel,
        correctedBloomLevel: payload.correctedBloomLevel,
        aiTopic: question.topic,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["feedback", reportId] }),
  });
  const verdict = existing?.verdict;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={verdict === "UP" ? "default" : "outline"}
          className="h-7 w-7 p-0"
          title="Bloom level is right"
          disabled={submit.isPending}
          onClick={() => submit.mutate({ verdict: "UP" })}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant={verdict === "DOWN" ? "default" : "outline"}
          className="h-7 w-7 p-0"
          title="Bloom level is wrong"
          disabled={submit.isPending}
          onClick={() => submit.mutate({ verdict: "DOWN", correctedBloomLevel: corrected || undefined })}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
        {existing && <Check className="h-3.5 w-3.5 text-success" aria-label="Feedback saved" />}
      </div>
      <div className="flex items-center gap-1">
        <select
          aria-label="Correct Bloom level"
          className="h-7 rounded-md border border-border bg-background px-1.5 text-xs"
          value={corrected}
          onChange={(e) => setCorrected(e.target.value as BloomLevel | "")}
        >
          <option value="">Correct to…</option>
          {BLOOM_LEVELS.filter((level) => level !== question.bloomLevel).map((level) => (
            <option key={level} value={level}>{bloomLabel(level)}</option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={!corrected || submit.isPending}
          onClick={() => corrected && submit.mutate({ verdict: "DOWN", correctedBloomLevel: corrected })}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export default function QuestionReviewTable({ questions, reportId }: { questions: QuestionReviewItem[]; reportId?: number }) {
  const { data: feedback } = useQuery({
    queryKey: ["feedback", reportId],
    queryFn: () => reportService.feedbackForReport(reportId!),
    enabled: Boolean(reportId),
  });
  const feedbackByQuestion = new Map((feedback ?? []).map((f) => [f.questionId, f]));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Question</TableHead>
          <TableHead>Bloom level</TableHead>
          <TableHead>Decision and reasoning</TableHead>
          <TableHead>Clarity</TableHead>
          <TableHead>Issues</TableHead>
          <TableHead>Suggested rewrite</TableHead>
          {reportId && <TableHead>Your verdict</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {questions.map((q) => {
          const existing = feedbackByQuestion.get(q.questionId);
          return (
            <TableRow key={q.questionId}>
              <TableCell className="font-medium text-foreground">#{q.questionId}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant={existing?.correctedBloomLevel ? "warning" : "outline"}>
                    {bloomLabel((existing?.correctedBloomLevel as BloomLevel | null) ?? q.bloomLevel)}
                  </Badge>
                  {existing?.correctedBloomLevel && (
                    <span className="text-[11px] text-muted-foreground">AI said {bloomLabel(q.bloomLevel)}</span>
                  )}
                  {q.bloomVotes && (
                    <span className="text-[11px] tabular-nums text-muted-foreground" title="Samples agreeing on this level">
                      {q.bloomVotes} samples{q.bloomContested ? " · contested" : ""}
                    </span>
                  )}
                  {q.topic && <span className="text-[11px] text-muted-foreground">{q.topic}</span>}
                </div>
              </TableCell>
              <TableCell className="min-w-64 max-w-md">
                <p className="font-medium text-foreground">{q.decision}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{q.reason}</p>
                <Badge variant="outline" className="mt-2">{Math.round(q.confidence)}% confidence</Badge>
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
              {reportId && (
                <TableCell>
                  <FeedbackControls question={q} reportId={reportId} existing={existing} />
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

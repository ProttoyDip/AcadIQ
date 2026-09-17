import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Download, Loader2, Trash2, Wand2 } from "lucide-react";
import { workflowService } from "../../services/workflowService";
import { apiErrorMessage } from "../../services/api";
import { formatDate } from "../../lib/format";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { RubricRecord } from "../../types";

function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** AI-drafted marking scheme per paper: model answer, marking points summing to marks, partial-credit rules. */
export default function RubricPanel({ courseId, paperId, disabled }: { courseId: number; paperId: number; disabled?: boolean }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const rubrics = useQuery({ queryKey: ["rubrics", courseId], queryFn: () => workflowService.listRubrics(courseId) });
  const forPaper = (rubrics.data ?? []).filter((r) => r.questionPaperId === paperId);

  const generate = useMutation({
    mutationFn: () => workflowService.generateRubric(courseId, paperId),
    onSuccess: (r) => {
      setError(null);
      setOpenId(r.id);
      void queryClient.invalidateQueries({ queryKey: ["rubrics", courseId] });
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not generate a marking scheme")),
  });
  const remove = useMutation({
    mutationFn: (id: number) => workflowService.deleteRubric(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["rubrics", courseId] }),
    onError: (e) => setError(apiErrorMessage(e, "Could not delete")),
  });
  const download = useMutation({
    mutationFn: async (rubric: RubricRecord) => downloadText(`${rubric.name.replace(/[^\w-]+/g, "_")}.md`, await workflowService.rubricMarkdown(rubric.id)),
    onError: (e) => setError(apiErrorMessage(e, "Download failed")),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-small font-semibold text-foreground">
            <ClipboardList className="h-4 w-4 text-primary" /> Marking scheme
          </p>
          <p className="text-xs text-muted-foreground">
            Drafts a model answer and itemised marking points for every question, grounded in your syllabus and slides. Review before use; it also feeds the Dual LLM Evaluator.
          </p>
        </div>
        <Button size="sm" onClick={() => generate.mutate()} disabled={disabled || generate.isPending}>
          {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {forPaper.length ? "Draft another" : "Draft marking scheme"}
        </Button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      {generate.isPending && <p className="text-xs text-muted-foreground">Writing model answers — this takes a little longer than a normal analysis.</p>}

      {forPaper.length === 0 && !generate.isPending && <p className="text-xs text-muted-foreground">No marking scheme for this paper yet.</p>}

      <ul className="flex flex-col gap-2">
        {forPaper.map((rubric) => {
          const open = openId === rubric.id;
          const rescaled = rubric.criteria.rescaled ?? [];
          return (
            <li key={rubric.id} className="rounded-lg border border-border">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpenId(open ? null : rubric.id)} aria-expanded={open}>
                  <p className="truncate text-small font-semibold text-foreground">{rubric.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {rubric.criteria.questions.length} questions · {Number(rubric.maxScore)} marks · {formatDate(rubric.createdAt)}
                    {rescaled.length ? ` · points rescaled for Q${rescaled.join(", Q")}` : ""}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant="warning" className="hidden sm:inline-flex">AI draft</Badge>
                  <Button variant="ghost" size="sm" onClick={() => download.mutate(rubric)} aria-label="Download markdown">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate(rubric.id)} disabled={remove.isPending} aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {open && (
                <div className="flex flex-col gap-4 border-t border-border px-3 py-3">
                  {rubric.criteria.questions.map((q) => (
                    <div key={q.questionId} className="rounded-md bg-muted/40 p-3">
                      <p className="text-small font-semibold text-foreground">
                        Q{q.sequenceNumber} <span className="text-muted-foreground">· {q.marks} marks</span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{q.modelAnswer}</p>
                      <table className="mt-2 w-full text-xs">
                        <tbody>
                          {q.markingPoints.map((p, i) => (
                            <tr key={i} className="border-t border-border/60">
                              <td className="py-1 pr-2 text-foreground">{p.point}</td>
                              <td className="w-12 py-1 text-right font-semibold text-foreground">{p.marks}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {q.partialCreditRules.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">Partial credit:</span> {q.partialCreditRules.join(" · ")}
                        </p>
                      )}
                      {q.commonErrors.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">Common errors:</span> {q.commonErrors.join(" · ")}
                        </p>
                      )}
                    </div>
                  ))}
                  {rubric.criteria.generalGuidance.length > 0 && (
                    <ul className="list-disc pl-5 text-xs text-muted-foreground">
                      {rubric.criteria.generalGuidance.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

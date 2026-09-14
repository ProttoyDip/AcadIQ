import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { workflowService } from "../../services/workflowService";
import { apiErrorMessage } from "../../services/api";
import { bloomLabel } from "../../lib/format";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { BloomLevel, QuestionRewriteResult } from "../../types";

const BLOOM: BloomLevel[] = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"];
const MODES = [
  { value: "RAISE_BLOOM", label: "Raise Bloom level", hint: "Change the task so it genuinely demands the target level." },
  { value: "VARIANT", label: "Fresh variant", hint: "Same concept and difficulty, new scenario/numbers — defeats memorised past papers." },
  { value: "CLARIFY", label: "Clarify wording", hint: "Remove ambiguity and fix grammar without changing difficulty." },
  { value: "SPLIT", label: "Split into parts", hint: "Break a compound question into sub-parts whose marks sum to the original." },
  { value: "CUSTOM", label: "Custom instruction", hint: "Tell the model exactly what to change." },
] as const;
type Mode = (typeof MODES)[number]["value"];

/**
 * Small, high-frequency helper: rewrite one question. Works on a stored question
 * (grounded with the course syllabus) or on pasted text.
 */
export default function QuestionRewriter({
  question,
}: {
  question: { id?: number; text: string; marks: number; bloomLevel?: string | null };
}) {
  const [mode, setMode] = useState<Mode>("VARIANT");
  const [targetBloom, setTargetBloom] = useState<BloomLevel>("ANALYZE");
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState<QuestionRewriteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const rewrite = useMutation({
    mutationFn: () =>
      workflowService.rewriteQuestion({
        questionId: question.id,
        text: question.id ? undefined : question.text,
        marks: question.marks,
        mode,
        targetBloom: mode === "RAISE_BLOOM" ? targetBloom : undefined,
        instruction: mode === "CUSTOM" ? instruction : undefined,
      }),
    onSuccess: (r) => {
      setResult(r);
      setError(null);
    },
    onError: (e) => setError(apiErrorMessage(e, "Rewrite failed")),
  });

  const copy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 1500);
  };

  const canRun = mode !== "CUSTOM" || instruction.trim().length > 3;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-muted/40 p-3 text-xs">
        <p className="whitespace-pre-wrap text-foreground">{question.text}</p>
        <p className="mt-1 text-muted-foreground">
          {question.marks} marks{question.bloomLevel ? ` · ${bloomLabel(question.bloomLevel)}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">What to do</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">{MODES.find((m) => m.value === mode)?.hint}</p>
        </div>
        {mode === "RAISE_BLOOM" && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Target level</Label>
            <Select value={targetBloom} onValueChange={(v) => setTargetBloom(v as BloomLevel)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BLOOM.map((b) => (
                  <SelectItem key={b} value={b}>{bloomLabel(b)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {mode === "CUSTOM" && (
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="rw-instruction" className="text-xs">Instruction</Label>
            <textarea
              id="rw-instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              placeholder="e.g. Use a healthcare example and ask for a time-complexity justification"
              className="w-full rounded-lg border border-border bg-background p-2 text-xs"
            />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-error">{error}</p>}
      <div>
        <Button size="sm" onClick={() => rewrite.mutate()} disabled={!canRun || rewrite.isPending}>
          {rewrite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Rewrite
        </Button>
      </div>

      {result && (
        <ul className="flex flex-col gap-2">
          {result.variants.map((v, i) => (
            <li key={i} className="rounded-lg border border-border p-3">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="brand" className="px-1.5 py-0 text-[10px]">{bloomLabel(v.bloomLevel)}</Badge>
                <span className="text-[11px] text-muted-foreground">{v.marks} marks</span>
                <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs" onClick={() => copy(v.text, i)}>
                  <Copy className="h-3.5 w-3.5" /> {copied === i ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="whitespace-pre-wrap text-small text-foreground">{v.text}</p>
              <p className="mt-1 text-xs italic text-muted-foreground">{v.rationale}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

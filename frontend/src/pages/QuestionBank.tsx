import { useEffect, useMemo, useState } from "react";
import { VoiceInput, appendTranscript } from "../components/ui/voice-input";
import { useQuery } from "@tanstack/react-query";
import { Library, Search, Sparkles, Repeat } from "lucide-react";
import { useCourses } from "../hooks/useCourses";
import { workflowService } from "../services/workflowService";
import { apiErrorMessage } from "../services/api";
import PageHeader from "../components/layout/PageHeader";
import QuestionRewriter from "../components/analysis/QuestionRewriter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { LoadingState } from "../components/ui/loading-state";
import { bloomLabel } from "../lib/format";
import { BankQuestion } from "../types";

const ALL = "__all__";

export default function QuestionBank() {
  const { data: courses } = useCourses();
  const [courseId, setCourseId] = useState<string>("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [bloom, setBloom] = useState(ALL);
  const [topic, setTopic] = useState(ALL);
  const [rewriteTarget, setRewriteTarget] = useState<BankQuestion | null>(null);
  const [adhoc, setAdhoc] = useState("");
  const [adhocOpen, setAdhocOpen] = useState(false);

  useEffect(() => {
    if (!courseId && courses?.length) setCourseId(String(courses[0].id));
  }, [courses, courseId]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const bank = useQuery({
    queryKey: ["question-bank", courseId, debounced, bloom, topic],
    queryFn: () =>
      workflowService.questionBank(Number(courseId), {
        q: debounced || undefined,
        bloom: bloom === ALL ? undefined : bloom,
        topic: topic === ALL ? undefined : topic,
      }),
    enabled: Boolean(courseId),
  });

  const reused = useMemo(() => (bank.data?.questions ?? []).filter((x) => x.usedCount > 1).length, [bank.data]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Question Bank"
        description="Every question this course has asked, with its Bloom level, topic and how often it has been reused. Rewrite any of them in one click."
        actions={
          <Button variant="outline" onClick={() => setAdhocOpen(true)}>
            <Sparkles className="h-4 w-4" /> Rewrite pasted question
          </Button>
        }
      />

      <Card className="shadow-xs">
        <CardContent className="grid grid-cols-1 gap-3 pt-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Choose a course" /></SelectTrigger>
              <SelectContent>
                {(courses ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.courseCode} — {c.courseName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="qb-search" className="text-xs">Search text</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="qb-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. normalisation" className="pl-9" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2"><VoiceInput label="the search phrase" onTranscript={(t) => setQ(t)} /></span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Bloom level</Label>
            <Select value={bloom} onValueChange={setBloom}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All levels</SelectItem>
                {(bank.data?.bloomLevels ?? []).map((b) => (
                  <SelectItem key={b} value={b}>{bloomLabel(b)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Topic</Label>
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All topics</SelectItem>
                {(bank.data?.topics ?? []).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight">
            <Library className="h-4 w-4 text-primary" /> {bank.data ? `${bank.data.questions.length} questions` : "Questions"}
            {reused > 0 && <Badge variant="warning" className="gap-1"><Repeat className="h-3 w-3" /> {reused} reused verbatim</Badge>}
          </CardTitle>
          <CardDescription className="text-xs">Labels come from question reviews; unlabelled questions show a dash. Newest paper first.</CardDescription>
        </CardHeader>
        <CardContent>
          {!courseId && <EmptyState icon={Library} title="Pick a course" description="The bank is per course." className="py-10" />}
          {courseId && bank.isLoading && <LoadingState label="Loading questions..." />}
          {bank.isError && <p className="text-xs text-error">{apiErrorMessage(bank.error, "Could not load the bank")}</p>}
          {bank.data && bank.data.questions.length === 0 && (
            <EmptyState icon={Library} title="Nothing matches" description="Try a broader search or upload question papers for this course." className="py-10" />
          )}
          {bank.data && bank.data.questions.length > 0 && (
            <ul className="divide-y divide-border">
              {bank.data.questions.map((question) => (
                <li key={question.id} className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <p className="text-small text-foreground">{question.questionText}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{question.paper.semester} {question.paper.year} · Q{question.sequenceNumber} · {question.marks} marks</span>
                      {question.bloomLevel && <Badge variant="brand" className="px-1.5 py-0 text-[10px]">{bloomLabel(question.bloomLevel)}</Badge>}
                      {question.topic && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{question.topic}</Badge>}
                      {question.usedCount > 1 && <Badge variant="warning" className="px-1.5 py-0 text-[10px]">used {question.usedCount}×</Badge>}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setRewriteTarget(question)}>
                    <Sparkles className="h-4 w-4" /> Rewrite
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={rewriteTarget !== null} onOpenChange={(open) => !open && setRewriteTarget(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rewrite question</DialogTitle>
            <DialogDescription>Variants are grounded in the course syllabus. Copy the one you like into your paper.</DialogDescription>
          </DialogHeader>
          {rewriteTarget && (
            <QuestionRewriter question={{ id: rewriteTarget.id, text: rewriteTarget.questionText, marks: rewriteTarget.marks, bloomLevel: rewriteTarget.bloomLevel }} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={adhocOpen} onOpenChange={setAdhocOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rewrite a pasted question</DialogTitle>
            <DialogDescription>Not stored anywhere; useful while drafting.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end"><VoiceInput label="the question text" onTranscript={(t) => setAdhoc((v) => appendTranscript(v, t))} /></div>
          <textarea
            value={adhoc}
            onChange={(e) => setAdhoc(e.target.value)}
            rows={4}
            placeholder="Paste the question text…"
            className="w-full rounded-lg border border-border bg-background p-2 text-small"
          />
          {adhoc.trim().length >= 5 && <QuestionRewriter key={adhoc} question={{ text: adhoc.trim(), marks: 10 }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Wand2, Loader2, FlaskConical } from "lucide-react";
import { useCourses, useCourse } from "../hooks/useCourses";
import { reportService } from "../services/reportService";
import { apiErrorMessage } from "../services/api";
import PageHeader from "../components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import GeneratedPaperReport from "../components/reports/GeneratedPaperReport";
import { BloomLevel, GeneratedPaperResult } from "../types";
import { bloomLabel } from "../lib/format";

const BLOOM_LEVELS: BloomLevel[] = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"];
const DEFAULT_BLOOM: Record<BloomLevel, number> = { REMEMBER: 10, UNDERSTAND: 20, APPLY: 30, ANALYZE: 20, EVALUATE: 10, CREATE: 10 };

/**
 * Constraint-solving paper generator: generate → verify with AcadIQ's own
 * analysers → repair. The verifier already existed; this page just closes the loop.
 */
export default function PaperGenerator() {
  const navigate = useNavigate();
  const { data: courses } = useCourses();
  const [courseId, setCourseId] = useState("");
  const { data: course } = useCourse(courseId ? Number(courseId) : null);
  const [questionCount, setQuestionCount] = useState(8);
  const [totalMarks, setTotalMarks] = useState(100);
  const [passThreshold, setPassThreshold] = useState(75);
  const [maxIterations, setMaxIterations] = useState(2);
  const [bloom, setBloom] = useState<Record<BloomLevel, number>>(DEFAULT_BLOOM);
  const [result, setResult] = useState<GeneratedPaperResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: feedbackStats } = useQuery({
    queryKey: ["feedback-stats", courseId],
    queryFn: () => reportService.feedbackStats(Number(courseId)),
    enabled: Boolean(courseId),
  });

  const generate = useMutation({
    mutationFn: () =>
      reportService.generatePaper({ courseId: Number(courseId), questionCount, totalMarks, targetBloom: bloom, passThreshold, maxIterations }),
    onSuccess: (r) => {
      setResult(r);
      setError(null);
    },
    onError: (e) => setError(apiErrorMessage(e, "Paper generation failed")),
  });

  const bloomTotal = Object.values(bloom).reduce((a, b) => a + b, 0);
  const hasSyllabus = (course?.syllabusDocuments?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Agent loop"
        title="Paper Generator"
        description="Give it a syllabus, a marks budget and a Bloom target. It drafts a paper, runs the five analysers on the draft, and repairs until the machine-checkable objective passes — or tells you honestly that it didn't."
      />

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-primary" /> Constraints</CardTitle>
            <CardDescription>The verifier is AcadIQ's own analysers plus deterministic checks on marks, Bloom mix, CO weights and bank originality.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label>Course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
                <SelectContent>
                  {(courses ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.courseCode} — {c.courseName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {courseId && !hasSyllabus && <p className="text-xs text-error">This course has no syllabus uploaded; generation needs one.</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Questions</Label>
                <Input type="number" min={3} max={30} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Total marks</Label>
                <Input type="number" min={10} max={500} value={totalMarks} onChange={(e) => setTotalMarks(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Pass threshold</Label>
                <Input type="number" min={50} max={100} value={passThreshold} onChange={(e) => setPassThreshold(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Max iterations</Label>
                <Input type="number" min={1} max={3} value={maxIterations} onChange={(e) => setMaxIterations(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Target Bloom mix (% of marks)</Label>
                <Badge variant={Math.abs(bloomTotal - 100) < 0.5 ? "outline" : "warning"} className="tabular-nums">{bloomTotal}%</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {BLOOM_LEVELS.map((level) => (
                  <div key={level} className="flex items-center gap-2">
                    <span className="w-24 text-xs text-muted-foreground">{bloomLabel(level)}</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="h-8"
                      value={bloom[level]}
                      onChange={(e) => setBloom((prev) => ({ ...prev, [level]: Number(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Percentages are normalised server-side. Each iteration costs roughly 4 LLM calls (1 generate + 3 verify).</p>
            </div>
            <Button
              className="gap-2"
              disabled={!courseId || !hasSyllabus || generate.isPending}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generate.isPending ? "Generating and verifying…" : "Generate paper"}
            </Button>
            {error && <p className="text-small text-error">{error}</p>}
            {feedbackStats && feedbackStats.total > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Faculty labels for this course: {feedbackStats.total} verdicts, {feedbackStats.bloomCorrections} Bloom corrections
                {feedbackStats.cohensKappa !== null ? ` · κ = ${feedbackStats.cohensKappa}` : ""}. {feedbackStats.kappaNote}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {!result && !generate.isPending && (
            <Card>
              <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
                <Wand2 className="h-8 w-8 text-primary" />
                <p className="text-body font-semibold">No paper generated yet</p>
                <p className="max-w-md text-small text-muted-foreground">
                  The result is stored as a report so you can inspect its provenance, reproduce it, and download it as a PDF.
                </p>
              </CardContent>
            </Card>
          )}
          {generate.isPending && (
            <Card>
              <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-body font-semibold">Running the generate → verify → repair loop</p>
                <p className="max-w-md text-small text-muted-foreground">Up to {maxIterations} iteration{maxIterations === 1 ? "" : "s"}; each one drafts a paper and scores it with the question-review, CO-mapping and syllabus-coverage analysers.</p>
              </CardContent>
            </Card>
          )}
          {result && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-small text-muted-foreground">Saved as report #{result.reportId}.</p>
                <Button variant="outline" size="sm" onClick={() => navigate(`/reports/${result.reportId}`)}>Open report (provenance, PDF)</Button>
              </div>
              <GeneratedPaperReport result={result} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

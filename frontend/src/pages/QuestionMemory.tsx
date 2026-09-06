import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSearch2, GitCompareArrows, History, Sparkles, Layers, Search, Lightbulb } from "lucide-react";
import { useCourses, useCourse } from "../hooks/useCourses";
import { useReports } from "../hooks/useReports";
import { useAnalyzeSimilarity } from "../hooks/useAnalysis";
import { apiErrorMessage } from "../services/api";
import PageHeader from "../components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { LoadingState } from "../components/ui/loading-state";
import { Input } from "../components/ui/input";
import { QuestionSimilarityResult } from "../types";
import { cn } from "../lib/utils";

export default function QuestionMemory() {
  const { data: courses } = useCourses();
  const [courseId, setCourseId] = useState<string>("");
  const { data: course, isLoading: courseLoading } = useCourse(courseId ? Number(courseId) : null);
  const { data: allReports } = useReports();
  const [currentPaperId, setCurrentPaperId] = useState<string>("");
  const [previousPaperId, setPreviousPaperId] = useState<string>("");
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analyzeSimilarity = useAnalyzeSimilarity();
  const navigate = useNavigate();

  const papers = course?.questionPapers ?? [];
  const selectedPaper = papers.find((p) => String(p.id) === currentPaperId);

  // Every similarity check ever run for this course — the raw material of the
  // academic memory engine. Matches accumulate across runs, so a question can
  // surface history against several previous papers, not just the last pair compared.
  const courseSimilarityResults = useMemo(
    () =>
      (allReports ?? [])
        .filter((r) => r.reportType === "QUESTION_SIMILARITY" && r.courseId === (courseId ? Number(courseId) : null))
        .map((r) => r.resultJson as unknown as QuestionSimilarityResult),
    [allReports, courseId]
  );

  const questionLookup = useMemo(() => {
    const map = new Map<number, { text: string; paperLabel: string; topic: string | null }>();
    for (const paper of papers) {
      for (const q of paper.questions ?? []) {
        map.set(q.id, {
          text: q.questionText,
          paperLabel: `${paper.semester} ${paper.year}`,
          topic: q.topic ?? null,
        });
      }
    }
    return map;
  }, [papers]);

  const topicFrequency = useMemo(() => {
    const byTopic = new Map<string, Set<string>>();
    for (const paper of papers) {
      for (const q of paper.questions ?? []) {
        if (!q.topic) continue;
        const label = `${paper.semester} ${paper.year}`;
        if (!byTopic.has(q.topic)) byTopic.set(q.topic, new Set());
        byTopic.get(q.topic)!.add(label);
      }
    }
    return Array.from(byTopic.entries())
      .map(([topic, papersSet]) => ({ topic, occurrences: papersSet.size, papers: Array.from(papersSet) }))
      .sort((a, b) => b.occurrences - a.occurrences);
  }, [papers]);

  const selectedQuestionMemory = useMemo(() => {
    if (!selectedQuestionId) return null;
    const entries = courseSimilarityResults.flatMap((result) =>
      result.matches
        .filter((m) => m.currentQuestionId === selectedQuestionId)
        .map((m) => ({
          paperLabel: questionLookup.get(m.previousQuestionId)?.paperLabel ?? "a previous paper",
          similarityPercentage: m.similarityPercentage,
          recommendation: result.recommendation,
        }))
    );
    return entries.sort((a, b) => b.similarityPercentage - a.similarityPercentage);
  }, [selectedQuestionId, courseSimilarityResults, questionLookup]);

  async function runSimilarityCheck() {
    if (!courseId || !currentPaperId || !previousPaperId) return;
    setError(null);
    try {
      const result = await analyzeSimilarity.mutateAsync({
        courseId: Number(courseId),
        currentPaperId: Number(currentPaperId),
        previousPaperId: Number(previousPaperId),
      });
      navigate(`/reports/${result.reportId}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Similarity check failed"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Academic Memory Engine"
        description="Institutional archive of examination items — query historical patterns, prevent repetitive evaluations, and preserve assessment originality across terms."
      />

      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              Active Course:
            </Label>
            <div className="w-full sm:w-72">
              <Select
                value={courseId}
                onValueChange={(v) => {
                  setCourseId(v);
                  setCurrentPaperId("");
                  setPreviousPaperId("");
                  setSelectedQuestionId(null);
                }}
              >
                <SelectTrigger className="h-9 text-xs font-medium">
                  <SelectValue placeholder="Select course archive..." />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                      {c.courseCode} — {c.courseName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex h-2 w-2 rounded-full bg-success" />
            <span>Memory Repository Active</span>
          </div>
        </div>
      </div>

      <Card className="shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <Layers className="h-4 w-4 text-primary-600 dark:text-primary-400" /> Syllabus Topic Recurrence
          </CardTitle>
          <CardDescription className="text-xs">Historical frequency of syllabus topics across archived semester papers.</CardDescription>
        </CardHeader>
        <CardContent>
          {!courseId ? (
            <EmptyState icon={Layers} title="Select a course" description="Choose an active course above to inspect its topic history." />
          ) : topicFrequency.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No historical topics recorded"
              description="Upload and parse question papers for this course to initialize institutional topic memory."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Topic</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Examined Terms</TableHead>
                    <TableHead className="text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Frequency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topicFrequency.map((t) => (
                    <TableRow key={t.topic} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-semibold text-xs text-foreground">{t.topic}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.papers.join(", ")}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={t.occurrences >= 3 ? "warning" : "outline"} className="tabular-nums font-semibold text-xs">
                          {t.occurrences}× tested
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xs border-primary-100 dark:border-primary-900/60 bg-gradient-to-b from-card to-primary-50/20 dark:to-primary-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <GitCompareArrows className="h-4 w-4 text-primary-600 dark:text-primary-400" /> Cross-Paper Similarity Audit
          </CardTitle>
          <CardDescription className="text-xs">
            Run a pairwise similarity check between a candidate paper and a benchmark paper to detect recycled questions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-foreground">Candidate Paper (Draft)</Label>
              <Select value={currentPaperId} onValueChange={setCurrentPaperId} disabled={!courseId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select candidate paper..." />
                </SelectTrigger>
                <SelectContent>
                  {papers.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                      {p.semester} {p.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-foreground">Historical Benchmark Paper</Label>
              <Select value={previousPaperId} onValueChange={setPreviousPaperId} disabled={!courseId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select benchmark paper..." />
                </SelectTrigger>
                <SelectContent>
                  {papers
                    .filter((p) => String(p.id) !== currentPaperId)
                    .map((p) => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                        {p.semester} {p.year}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-error-border bg-error-bg/60 px-3 py-2 text-xs font-medium text-error">
              {error}
            </div>
          )}

          <div className="flex justify-start">
            <Button
              onClick={runSimilarityCheck}
              disabled={!currentPaperId || !previousPaperId || analyzeSimilarity.isPending}
              size="sm"
              className="text-xs font-semibold gap-2"
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              {analyzeSimilarity.isPending ? "Executing Similarity Audit..." : "Run Pairwise Similarity Audit"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold tracking-tight">Active Question Inventory</CardTitle>
                <CardDescription className="text-xs">Select any question item to inspect cross-term recurrence.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/60 text-[11px] font-semibold text-primary-800 dark:text-primary-300 hover:bg-primary-100"
                onClick={() => {
                  setSearchQuery("normalization");
                  setShowDemo(true);
                  setSelectedQuestionId(null);
                }}
              >
                <Lightbulb className="h-3 w-3" /> Audit Demo Case
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {courseLoading ? (
              <LoadingState label="Indexing question records..." />
            ) : selectedPaper && selectedPaper.questions && selectedPaper.questions.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search candidate questions or topics..."
                    className="h-9 pl-9 text-xs"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDemo(false);
                    }}
                  />
                </div>
                <div className="max-h-[380px] overflow-y-auto rounded-lg border border-border scrollbar-thin">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-xs z-10">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Question Stem</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Topic</TableHead>
                        <TableHead className="text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Marks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPaper.questions
                        .filter((q) => !searchQuery || q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) || q.topic?.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((q) => {
                          const isSelected = selectedQuestionId === q.id;
                          return (
                            <TableRow
                              key={q.id}
                              onClick={() => {
                                setSelectedQuestionId(q.id);
                                setShowDemo(false);
                              }}
                              className={cn(
                                "cursor-pointer transition-colors text-xs",
                                isSelected
                                  ? "bg-primary-50/80 dark:bg-primary-950/60 font-semibold border-l-2 border-l-primary"
                                  : "hover:bg-muted/40"
                              )}
                            >
                              <TableCell className="max-w-xs text-foreground font-medium line-clamp-2">{q.questionText}</TableCell>
                              <TableCell className="text-muted-foreground whitespace-nowrap">{q.topic ?? "—"}</TableCell>
                              <TableCell className="text-right tabular-nums text-foreground font-semibold">{q.marks}</TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : showDemo ? (
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search candidate questions or topics..."
                    className="h-9 pl-9 text-xs"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDemo(false);
                    }}
                  />
                </div>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Question Stem</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Topic</TableHead>
                        <TableHead className="text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Marks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="cursor-pointer bg-primary-50/80 dark:bg-primary-950/60 border-l-2 border-l-primary text-xs">
                        <TableCell className="max-w-xs font-semibold text-foreground">Explain normalization techniques with BCNF criteria.</TableCell>
                        <TableCell className="text-muted-foreground">Database Design</TableCell>
                        <TableCell className="text-right tabular-nums font-bold text-foreground">10</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={FileSearch2}
                title="Select a paper to browse its question bank"
                description="Choose an active course and candidate paper above to inspect its parsed questions."
              />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-tight">
              <History className="h-4 w-4 text-primary-600 dark:text-primary-400" /> Historical Recurrence Footprint
            </CardTitle>
            <CardDescription className="text-xs">Prior examination instances matching or conceptually resembling this question stem.</CardDescription>
          </CardHeader>
          <CardContent>
            {showDemo ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Item</p>
                  <p className="mt-1 text-xs sm:text-sm font-semibold text-foreground">Explain normalization techniques with BCNF criteria.</p>
                </div>
                <div className="flex flex-col divide-y divide-border/60">
                  <div className="flex items-center justify-between py-2.5 pt-0">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Fall 2025 Midterm Examination</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">High conceptual duplicate match</p>
                    </div>
                    <Badge variant="error" className="tabular-nums font-semibold text-xs">87% Similarity</Badge>
                  </div>
                  <div className="flex items-center justify-between py-2.5 pb-0">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Spring 2024 Final Examination</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Repeated assessment pattern</p>
                    </div>
                    <Badge variant="warning" className="tabular-nums font-semibold text-xs">72% Similarity</Badge>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-950/40 p-3.5">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-700 dark:text-primary-300" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary-800 dark:text-primary-300">
                      Recommendation for Assessment Originality
                    </p>
                    <p className="mt-0.5 text-xs text-foreground/90 leading-relaxed">
                      This core concept has recurred across consecutive terms. Recommend converting into an applied case study scenario with real-world schema anomalies.
                    </p>
                  </div>
                </div>
              </div>
            ) : !selectedQuestionId ? (
              <EmptyState
                icon={History}
                title="No question selected"
                description="Click any question row in the active inventory to view historical precedents."
              />
            ) : !selectedQuestionMemory || selectedQuestionMemory.length === 0 ? (
              <EmptyState
                icon={History}
                title="No historical matches found"
                description="This question stem appears unique against previously indexed examinations for this course."
              />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Item</p>
                  <p className="mt-1 text-xs sm:text-sm font-semibold text-foreground">
                    {questionLookup.get(selectedQuestionId)?.text}
                  </p>
                </div>
                <div className="flex flex-col divide-y divide-border/60">
                  {selectedQuestionMemory.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-xs font-semibold text-foreground">{entry.paperLabel}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Archived institutional exam</p>
                      </div>
                      <Badge
                        variant={entry.similarityPercentage >= 75 ? "error" : entry.similarityPercentage >= 50 ? "warning" : "muted"}
                        className="tabular-nums font-semibold text-xs"
                      >
                        {Math.round(entry.similarityPercentage)}% match
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-950/40 p-3.5">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-700 dark:text-primary-300" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary-800 dark:text-primary-300">
                      Institutional Memory Insight
                    </p>
                    <p className="mt-0.5 text-xs text-foreground/90 leading-relaxed">
                      This assessment concept has been evaluated across {selectedQuestionMemory.length} prior term{selectedQuestionMemory.length === 1 ? "" : "s"}. {selectedQuestionMemory[0].recommendation}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

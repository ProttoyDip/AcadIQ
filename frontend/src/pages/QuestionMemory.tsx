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
        title="Academic memory"
        description="AcadIQ's institutional memory of every question ever asked — search question history, spot repeated topics, and get AI suggestions before a concept gets asked the same way again."
      />

      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label>Course</Label>
        <Select
          value={courseId}
          onValueChange={(v) => {
            setCourseId(v);
            setCurrentPaperId("");
            setPreviousPaperId("");
            setSelectedQuestionId(null);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a course to search its memory" />
          </SelectTrigger>
          <SelectContent>
            {courses?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.courseCode} — {c.courseName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body font-semibold">
            <Layers className="h-4 w-4 text-primary-700" /> Topic memory
          </CardTitle>
          <CardDescription>How often each syllabus topic has been examined across this course's history.</CardDescription>
        </CardHeader>
        <CardContent>
          {!courseId ? (
            <EmptyState icon={Layers} title="Select a course" description="Choose a course above to see its topic history." />
          ) : topicFrequency.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No topic history yet"
              description="Upload and parse question papers for this course to build topic memory."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Topic</TableHead>
                  <TableHead>Asked in</TableHead>
                  <TableHead className="text-right">Times asked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topicFrequency.map((t) => (
                  <TableRow key={t.topic}>
                    <TableCell className="font-medium text-foreground">{t.topic}</TableCell>
                    <TableCell className="text-small text-muted-foreground">{t.papers.join(", ")}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={t.occurrences >= 3 ? "warning" : "outline"}>{t.occurrences}×</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body font-semibold">
            <GitCompareArrows className="h-4 w-4 text-primary-700" /> Run a new similarity check
          </CardTitle>
          <CardDescription>Compare a paper against a previous semester's exam to build memory for its questions.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Current paper</Label>
              <Select value={currentPaperId} onValueChange={setCurrentPaperId} disabled={!courseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select paper" />
                </SelectTrigger>
                <SelectContent>
                  {papers.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.semester} {p.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Previous paper</Label>
              <Select value={previousPaperId} onValueChange={setPreviousPaperId} disabled={!courseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select paper" />
                </SelectTrigger>
                <SelectContent>
                  {papers
                    .filter((p) => String(p.id) !== currentPaperId)
                    .map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.semester} {p.year}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-error-border bg-error-bg px-3 py-2 text-small text-error">
              {error}
            </div>
          )}

          <div>
            <Button
              onClick={runSimilarityCheck}
              disabled={!currentPaperId || !previousPaperId || analyzeSimilarity.isPending}
            >
              <GitCompareArrows className="h-4 w-4" />
              {analyzeSimilarity.isPending ? "Checking..." : "Run similarity check"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-body font-semibold">Question bank</CardTitle>
                <CardDescription>Select a question to view its academic memory.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-primary-200 bg-primary-50 text-xs text-primary-700 hover:bg-primary-100"
                onClick={() => {
                  setSearchQuery("normalization");
                  setShowDemo(true);
                  setSelectedQuestionId(null);
                }}
              >
                <Lightbulb className="h-3 w-3" /> Demo Query
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {courseLoading ? (
              <LoadingState label="Loading questions..." />
            ) : selectedPaper && selectedPaper.questions && selectedPaper.questions.length > 0 ? (
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search previous questions..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDemo(false);
                    }}
                  />
                </div>
                <div className="max-h-[400px] overflow-y-auto rounded-md border border-border scrollbar-thin">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <TableRow>
                        <TableHead>Question</TableHead>
                        <TableHead>Topic</TableHead>
                        <TableHead className="text-right">Marks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPaper.questions
                        .filter((q) => !searchQuery || q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) || q.topic?.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((q) => (
                          <TableRow
                            key={q.id}
                            onClick={() => {
                              setSelectedQuestionId(q.id);
                              setShowDemo(false);
                            }}
                            className={`cursor-pointer ${selectedQuestionId === q.id ? "bg-primary-50/60" : ""}`}
                          >
                            <TableCell className="max-w-xs text-small text-foreground">{q.questionText}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{q.topic ?? "—"}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{q.marks}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : showDemo ? (
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search previous questions..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDemo(false);
                    }}
                  />
                </div>
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Question</TableHead>
                        <TableHead>Topic</TableHead>
                        <TableHead className="text-right">Marks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="cursor-pointer bg-primary-50/60">
                        <TableCell className="max-w-xs text-small text-foreground">Explain normalization techniques.</TableCell>
                        <TableCell className="text-xs text-muted-foreground">Database Design</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">10</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={FileSearch2}
                title="Select a paper to browse its questions"
                description="Choose a course and a current paper above to see its parsed question bank."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-body font-semibold">
              <History className="h-4 w-4 text-primary-700" /> Question history
            </CardTitle>
            <CardDescription>Where this question — or something close to it — has appeared before.</CardDescription>
          </CardHeader>
          <CardContent>
            {showDemo ? (
              <div className="flex flex-col gap-4">
                <p className="text-small font-medium text-foreground">Explain normalization techniques.</p>
                <div className="flex flex-col divide-y divide-border">
                  <div className="flex items-center justify-between py-2.5 pt-0">
                    <span className="text-small text-foreground">Fall 2025</span>
                    <Badge variant="error">87% similar</Badge>
                  </div>
                  <div className="flex items-center justify-between py-2.5 pb-0">
                    <span className="text-small text-foreground">Spring 2026</span>
                    <Badge variant="warning">72% similar</Badge>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-md bg-primary-50/60 p-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-primary-700">AI insight</p>
                    <p className="text-small text-foreground">
                      This concept has appeared multiple times. Create a case-based question.
                    </p>
                  </div>
                </div>
              </div>
            ) : !selectedQuestionId ? (
              <EmptyState
                icon={History}
                title="No question selected"
                description="Click a question in the bank to see its academic memory."
              />
            ) : !selectedQuestionMemory || selectedQuestionMemory.length === 0 ? (
              <EmptyState
                icon={History}
                title="No history for this question yet"
                description="Run a similarity check above against a previous paper to build memory for it."
              />
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-small font-medium text-foreground">
                  {questionLookup.get(selectedQuestionId)?.text}
                </p>
                <div className="flex flex-col divide-y divide-border">
                  {selectedQuestionMemory.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                      <span className="text-small text-foreground">{entry.paperLabel}</span>
                      <Badge variant={entry.similarityPercentage >= 75 ? "error" : entry.similarityPercentage >= 50 ? "warning" : "muted"}>
                        {Math.round(entry.similarityPercentage)}% similar
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-2.5 rounded-md bg-primary-50/60 p-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-primary-700">AI insight</p>
                    <p className="text-small text-foreground">
                      This concept has appeared {selectedQuestionMemory.length} time
                      {selectedQuestionMemory.length === 1 ? "" : "s"} before. {selectedQuestionMemory[0].recommendation}
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

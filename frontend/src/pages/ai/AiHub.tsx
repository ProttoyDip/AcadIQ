import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  FileText,
  Eye,
  ListOrdered,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Database,
  Layers,
  Sparkles,
  Trash2,
  Copy,
  Check,
  Download,
  Search,
  BookOpen,
  HelpCircle,
  BookmarkCheck,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { aiService, SavedGeneratedQuestion, AiDocument } from "../../services/aiService";

export default function AiHub() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("questions");
  const [questionSearch, setQuestionSearch] = useState("");
  const [copiedQuestionId, setCopiedQuestionId] = useState<number | null>(null);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [selectedSummaryDoc, setSelectedSummaryDoc] = useState<AiDocument | null>(null);

  // Runtime status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["ai-status"],
    queryFn: aiService.getStatus,
    refetchInterval: 15000,
  });

  // Uploaded Documents
  const { data: documents, refetch: refetchDocs } = useQuery({
    queryKey: ["ai-documents"],
    queryFn: aiService.listDocuments,
  });

  // Saved Questions History
  const { data: savedQuestions, isLoading: questionsLoading, refetch: refetchQuestions } = useQuery({
    queryKey: ["ai-saved-questions"],
    queryFn: () => aiService.listQuestionHistory({ limit: 100 }),
  });

  // History Overview
  const { data: overview } = useQuery({
    queryKey: ["ai-history-overview"],
    queryFn: aiService.getHistoryOverview,
  });

  // Delete Document
  const deleteDocMutation = useMutation({
    mutationFn: (id: number) => aiService.deleteDocument(id),
    onSuccess: () => {
      refetchDocs();
      queryClient.invalidateQueries({ queryKey: ["ai-history-overview"] });
    },
  });

  // Delete Question
  const deleteQuestionMutation = useMutation({
    mutationFn: (id: number) => aiService.deleteQuestion(id),
    onSuccess: () => {
      refetchQuestions();
      queryClient.invalidateQueries({ queryKey: ["ai-history-overview"] });
    },
  });

  const handleDeleteDocument = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this document and its indexed chunks?")) return;
    deleteDocMutation.mutate(id);
  };

  const handleDeleteQuestion = (id: number) => {
    if (!window.confirm("Delete this saved question?")) return;
    deleteQuestionMutation.mutate(id);
  };

  const handleCopyQuestion = (q: SavedGeneratedQuestion) => {
    let text = `Question: ${q.question}\nType: ${q.type} | Difficulty: ${q.difficulty}\n`;
    if (q.options && Array.isArray(q.options)) {
      text += `Options:\n${q.options.map((opt, i) => `  ${String.fromCharCode(65 + i)}) ${opt}`).join("\n")}\n`;
    }
    if (q.correctAnswer) {
      text += `Answer: ${q.correctAnswer}\n`;
    }
    if (q.explanation) {
      text += `Explanation: ${q.explanation}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopiedQuestionId(q.id);
    setTimeout(() => setCopiedQuestionId(null), 2000);
  };

  const handleExportQuestions = (format: "json" | "txt") => {
    if (!savedQuestions || savedQuestions.length === 0) return;

    let content = "";
    let mimeType = "text/plain";
    let filename = `acadiq-generated-questions-${new Date().toISOString().slice(0, 10)}`;

    if (format === "json") {
      content = JSON.stringify(savedQuestions, null, 2);
      mimeType = "application/json";
      filename += ".json";
    } else {
      content = savedQuestions
        .map((q, idx) => {
          let str = `Q${idx + 1}. [${q.type}] [${q.difficulty}] ${q.question}\n`;
          if (q.topic) str += `Topic: ${q.topic}\n`;
          if (q.options && Array.isArray(q.options)) {
            str += q.options.map((opt, i) => `   ${String.fromCharCode(65 + i)}) ${opt}`).join("\n") + "\n";
          }
          if (q.correctAnswer) str += `Correct Answer: ${q.correctAnswer}\n`;
          if (q.explanation) str += `Explanation: ${q.explanation}\n`;
          return str;
        })
        .join("\n----------------------------------------\n\n");
      filename += ".txt";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredQuestions = (savedQuestions || []).filter((q) => {
    if (!questionSearch.trim()) return true;
    const s = questionSearch.toLowerCase();
    return (
      q.question.toLowerCase().includes(s) ||
      (q.topic && q.topic.toLowerCase().includes(s)) ||
      q.type.toLowerCase().includes(s) ||
      q.difficulty.toLowerCase().includes(s)
    );
  });

  const documentsWithSummary = (documents || []).filter((d) => Boolean(d.summary));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Local Intelligence Engine"
        title="AI Assistant Hub"
        description="Interact with local academic AI powered by Ollama. Process PDFs with RAG retrieval, analyze visual diagrams, and generate curriculum-grounded examination questions offline."
      />

      {/* Ollama Runtime Status Banner */}
      <Card className="border-border/60 bg-gradient-to-r from-card via-card to-primary-50/20 dark:to-primary-950/20">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Cpu className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="text-base font-semibold">Local Ollama Runtime</CardTitle>
                <CardDescription className="text-xs">
                  {status?.baseUrl || "http://localhost:11434"}
                </CardDescription>
              </div>
            </div>
            {statusLoading ? (
              <Badge variant="outline" className="animate-pulse">Checking runtime...</Badge>
            ) : status?.running ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Ollama Active
              </Badge>
            ) : (
              <Badge variant="error" className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> Ollama Offline
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/50 p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Text & RAG Model</span>
              <p className="mt-1 font-semibold text-foreground text-sm flex items-center justify-between">
                <span>{status?.config.textModel || "gemma3:4b"}</span>
                {status?.models.some((m) => m.includes("gemma3")) ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-normal">Ready</span>
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-normal">Needs pull</span>
                )}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/50 p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Vision AI Model</span>
              <p className="mt-1 font-semibold text-foreground text-sm flex items-center justify-between">
                <span>{status?.config.visionModel || "qwen2.5vl:3b"}</span>
                {status?.models.some((m) => m.includes("qwen2.5vl")) ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-normal">Ready</span>
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-normal">Needs pull</span>
                )}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/50 p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Embedding Model</span>
              <p className="mt-1 font-semibold text-foreground text-sm flex items-center justify-between">
                <span>{status?.config.embeddingModel || "nomic-embed-text"}</span>
                {status?.models.some((m) => m.includes("nomic-embed-text")) ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-normal">Ready</span>
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-normal">Needs pull</span>
                )}
              </p>
            </div>
          </div>

          {status && !status.running && (
            <div className="mt-4 rounded-lg bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Ollama is not running locally</p>
                <p className="mt-0.5 text-muted-foreground">
                  Start Ollama by running <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">ollama serve</code> in your terminal.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* PDF Assistant */}
        <Card className="flex flex-col border-border/70 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
          <CardHeader className="pb-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 mb-2">
              <FileText className="h-5 w-5" />
            </span>
            <CardTitle className="text-lg">PDF Assistant</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Upload scholarly papers and textbooks. Chunk, embed with nomic-embed-text, summarize, and ask grounded questions with page citations.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-2.5 pt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Full text extraction & sentence-aware chunking</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>RAG vector retrieval with page citations</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Short, detailed, and concept summaries</span>
            </div>
          </CardContent>
          <div className="p-6 pt-2">
            <Button asChild className="w-full justify-between" variant="outline">
              <Link to="/ai/pdf">
                Open PDF Assistant <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Card>

        {/* Vision AI */}
        <Card className="flex flex-col border-border/70 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
          <CardHeader className="pb-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 mb-2">
              <Eye className="h-5 w-5" />
            </span>
            <CardTitle className="text-lg">Image Assistant</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Upload diagrams, charts, screenshots, and equations. Qwen2.5-VL provides pedagogical breakdowns and OCR text reading.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-2.5 pt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Diagram, chart & trend explanation</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>OCR handwritten notes & code screenshots</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Math equation & scientific formula analysis</span>
            </div>
          </CardContent>
          <div className="p-6 pt-2">
            <Button asChild className="w-full justify-between" variant="outline">
              <Link to="/ai/image">
                Open Image Assistant <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Card>

        {/* Question Generator */}
        <Card className="flex flex-col border-border/70 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
          <CardHeader className="pb-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 mb-2">
              <ListOrdered className="h-5 w-5" />
            </span>
            <CardTitle className="text-lg">Question Generator</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Upload course outlines or syllabi in PDF, DOCX, or TXT. Automatically generate MCQs, descriptive, viva, and conceptual questions.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-2.5 pt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Grounded strictly in course materials</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>MCQ, Short Answer, Viva, True/False, Descriptive</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Structured JSON with answers & explanations</span>
            </div>
          </CardContent>
          <div className="p-6 pt-2">
            <Button asChild className="w-full justify-between" variant="outline">
              <Link to="/ai/questions">
                Open Question Generator <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>

      {/* Saved Work & History Section */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <BookmarkCheck className="h-5 w-5 text-primary" /> Saved Work & History
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Review, export, and manage your previously generated questions, document summaries, and indexed knowledge.
              </CardDescription>
            </div>

            {/* Overview Counters */}
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1">
                <strong>{overview?.totalQuestions ?? savedQuestions?.length ?? 0}</strong> Questions Saved
              </span>
              <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1">
                <strong>{documents?.length ?? 0}</strong> Documents Indexed
              </span>
              <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1">
                <strong>{documentsWithSummary.length}</strong> Summaries Ready
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <TabsList className="bg-muted/60">
                <TabsTrigger value="questions" className="text-xs">
                  <ListOrdered className="h-3.5 w-3.5" /> Generated Questions ({savedQuestions?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="documents" className="text-xs">
                  <Database className="h-3.5 w-3.5" /> Indexed Documents ({documents?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="summaries" className="text-xs">
                  <BookOpen className="h-3.5 w-3.5" /> Document Summaries ({documentsWithSummary.length})
                </TabsTrigger>
              </TabsList>

              {activeTab === "questions" && savedQuestions && savedQuestions.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search questions or topics..."
                      value={questionSearch}
                      onChange={(e) => setQuestionSearch(e.target.value)}
                      className="h-8 w-48 pl-8 text-xs"
                    />
                  </div>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => handleExportQuestions("json")}>
                    <Download className="h-3 w-3" /> JSON
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => handleExportQuestions("txt")}>
                    <Download className="h-3 w-3" /> TXT
                  </Button>
                </div>
              )}
            </div>

            {/* TAB 1: Generated Questions History */}
            <TabsContent value="questions" className="pt-4">
              {questionsLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading saved questions...</div>
              ) : filteredQuestions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-12 text-center">
                  <ListOrdered className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm font-semibold text-foreground">No questions found</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    {questionSearch
                      ? "No questions match your current search query."
                      : "Generate examination questions from any course outline or syllabus to build your saved question bank."}
                  </p>
                  <Button asChild size="sm" className="mt-4">
                    <Link to="/ai/questions">Generate Questions Now</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredQuestions.map((q, idx) => {
                    const isAnswerRevealed = Boolean(revealedAnswers[q.id]);
                    return (
                      <div
                        key={q.id}
                        className="rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-primary">#{idx + 1}</span>
                            <Badge variant="brand" className="text-[10px] px-2 py-0">
                              {q.type}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0 ${
                                q.difficulty === "Easy"
                                  ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                                  : q.difficulty === "Hard"
                                  ? "border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-400"
                                  : "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                              }`}
                            >
                              {q.difficulty}
                            </Badge>
                            {q.topic && (
                              <span className="text-[11px] text-muted-foreground font-medium">
                                Topic: {q.topic}
                              </span>
                            )}
                            {q.document?.title && (
                              <span className="text-[11px] text-muted-foreground/80 italic">
                                Source: {q.document.title}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleCopyQuestion(q)}
                              title="Copy question text"
                            >
                              {copiedQuestionId === q.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteQuestion(q.id)}
                              title="Delete question"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Question Text */}
                        <p className="mt-3 text-sm font-semibold text-foreground leading-relaxed whitespace-pre-wrap">
                          {q.question}
                        </p>

                        {/* MCQ Options if available */}
                        {q.options && Array.isArray(q.options) && q.options.length > 0 && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt, optIdx) => (
                              <div
                                key={optIdx}
                                className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-foreground flex items-center gap-2"
                              >
                                <span className="font-bold text-muted-foreground text-[11px]">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Expandable Answer & Explanation */}
                        {(q.correctAnswer || q.explanation) && (
                          <div className="mt-3.5 pt-2 border-t border-border/40">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px] text-primary hover:text-primary/80 font-medium p-0"
                              onClick={() =>
                                setRevealedAnswers((prev) => ({
                                  ...prev,
                                  [q.id]: !prev[q.id],
                                }))
                              }
                            >
                              {isAnswerRevealed ? "Hide Answer & Explanation" : "Reveal Answer & Explanation"}
                            </Button>

                            {isAnswerRevealed && (
                              <div className="mt-2.5 rounded-lg bg-muted/40 p-3 text-xs space-y-1.5 border border-border/50">
                                {q.correctAnswer && (
                                  <div>
                                    <span className="font-semibold text-foreground">Answer: </span>
                                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                      {q.correctAnswer}
                                    </span>
                                  </div>
                                )}
                                {q.explanation && (
                                  <div>
                                    <span className="font-semibold text-foreground">Explanation: </span>
                                    <span className="text-muted-foreground leading-relaxed">
                                      {q.explanation}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-2 text-[10px] text-muted-foreground/60 flex items-center justify-end">
                          Saved on {new Date(q.createdAt).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* TAB 2: Indexed Documents */}
            <TabsContent value="documents" className="pt-4">
              {!documents || documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm font-medium text-foreground">No documents uploaded yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Upload a PDF textbook or paper to get started with local summarization and question answering.
                  </p>
                  <Button asChild size="sm" className="mt-4">
                    <Link to="/ai/pdf">Upload First PDF</Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex flex-wrap items-center justify-between gap-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-sm text-foreground">{doc.title}</p>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {doc.fileType}
                          </Badge>
                          {doc.chunkCount > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Layers className="h-3 w-3" /> {doc.chunkCount} chunks
                            </span>
                          )}
                          {doc.summary && (
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px] border-none">
                              Summary Ready
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{doc.originalName}</span>
                          <span>•</span>
                          <span>{(doc.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {doc.summary && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs gap-1.5"
                            onClick={() => setSelectedSummaryDoc(doc)}
                          >
                            <BookOpen className="h-3.5 w-3.5 text-primary" /> View Summary
                          </Button>
                        )}
                        <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                          <Link to={`/ai/pdf?docId=${doc.id}`}>
                            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" /> Open in Assistant
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteDocument(doc.id)}
                          title="Delete document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: Document Summaries */}
            <TabsContent value="summaries" className="pt-4">
              {documentsWithSummary.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-12 text-center">
                  <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm font-semibold text-foreground">No summaries generated yet</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    Generate an executive or structured summary for any uploaded PDF document in the PDF Assistant.
                  </p>
                  <Button asChild size="sm" className="mt-4">
                    <Link to="/ai/pdf">Open PDF Assistant</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documentsWithSummary.map((doc) => (
                    <Card key={doc.id} className="border-border/70 hover:border-primary/50 transition-all">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-sm font-bold truncate">{doc.title}</CardTitle>
                            <CardDescription className="text-xs text-muted-foreground mt-0.5">
                              {doc.originalName} • {new Date(doc.createdAt).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setSelectedSummaryDoc(doc)}
                          >
                            Read Full
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          {doc.summary}
                        </p>
                        {doc.keyPoints && Array.isArray(doc.keyPoints) && doc.keyPoints.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {doc.keyPoints.slice(0, 3).map((kp, i) => (
                              <span
                                key={i}
                                className="inline-block rounded-md bg-muted px-2 py-0.5 text-[10px] text-foreground truncate max-w-[200px]"
                              >
                                • {kp}
                              </span>
                            ))}
                            {doc.keyPoints.length > 3 && (
                              <span className="text-[10px] text-muted-foreground self-center">
                                +{doc.keyPoints.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Summary Viewer Dialog */}
      <Dialog open={Boolean(selectedSummaryDoc)} onOpenChange={(open) => !open && setSelectedSummaryDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" /> {selectedSummaryDoc?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Saved synthesis and key takeaways generated by Gemma 3.
            </DialogDescription>
          </DialogHeader>

          {selectedSummaryDoc && (
            <div className="space-y-4 pt-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Summary</h4>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                  {selectedSummaryDoc.summary}
                </div>
              </div>

              {selectedSummaryDoc.keyPoints && Array.isArray(selectedSummaryDoc.keyPoints) && selectedSummaryDoc.keyPoints.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Key Takeaways</h4>
                  <ul className="space-y-1.5 rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-foreground">
                    {selectedSummaryDoc.keyPoints.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <Button asChild size="sm" variant="outline" className="text-xs">
                  <Link to={`/ai/pdf?docId=${selectedSummaryDoc.id}`}>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" /> Open in Assistant
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedSummaryDoc(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

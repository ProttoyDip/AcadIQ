import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  UploadCloud,
  ListOrdered,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Copy,
  Check,
  Download,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { aiService, GeneratedQuestionItem } from "../../services/aiService";
import { apiErrorMessage } from "../../services/api";

const QUESTION_TYPES = [
  "MCQ",
  "Short Answer",
  "Descriptive",
  "True/False",
  "Viva",
  "Conceptual",
  "Application-based",
  "Mixed",
];

const DIFFICULTIES = ["Easy", "Medium", "Hard", "Mixed"];

export default function QuestionGenerator() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [courseTextInput, setCourseTextInput] = useState("");
  const [useTextInput, setUseTextInput] = useState(false);

  const [questionCount, setQuestionCount] = useState<number>(5);
  const [questionType, setQuestionType] = useState<string>("MCQ");
  const [difficulty, setDifficulty] = useState<string>("Medium");
  const [topic, setTopic] = useState("");
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [includeExplanations, setIncludeExplanations] = useState(true);

  const [questions, setQuestions] = useState<GeneratedQuestionItem[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx") && !lower.endsWith(".txt")) {
      setError("Please select a PDF, DOCX, or TXT file.");
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const generateMutation = useMutation({
    mutationFn: () => {
      if (!useTextInput && !selectedFile) {
        throw new Error("Please upload a course outline file or switch to text paste.");
      }
      if (useTextInput && !courseTextInput.trim()) {
        throw new Error("Please enter course outline text.");
      }

      return aiService.generateQuestions({
        file: useTextInput ? undefined : (selectedFile || undefined),
        courseText: useTextInput ? courseTextInput : undefined,
        questionCount,
        questionType,
        difficulty,
        topic: topic.trim() || undefined,
        includeAnswers,
        includeExplanations,
      });
    },
    onSuccess: (data) => {
      setQuestions(data.questions || []);
      setError(null);
      // Reveal all answers initially if requested
      const initialReveal: Record<number, boolean> = {};
      data.questions.forEach((_, idx) => {
        initialReveal[idx] = true;
      });
      setRevealedAnswers(initialReveal);
    },
    onError: (err) => {
      setError(apiErrorMessage(err, "Failed to generate questions"));
    },
  });

  const toggleRevealAnswer = (idx: number) => {
    setRevealedAnswers((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleCopyQuestion = (q: GeneratedQuestionItem, idx: number) => {
    let text = `Q: ${q.question}\nType: ${q.type} | Difficulty: ${q.difficulty}\n`;
    if (q.options && q.options.length > 0) {
      text += q.options.map((opt, i) => `  ${String.fromCharCode(65 + i)}. ${opt}`).join("\n") + "\n";
    }
    if (q.correctAnswer) {
      text += `Correct Answer: ${q.correctAnswer}\n`;
    }
    if (q.explanation) {
      text += `Explanation: ${q.explanation}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ questions }, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `generated_questions_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Pedagogical Assessment Engine"
        title="Course Outline Question Generator"
        description="Upload a syllabus or course outline in PDF, DOCX, or TXT. Gemma 3 automatically synthesizes curriculum-grounded assessment questions with verified answers and explanations."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Controls Column (5 cols) */}
        <Card className="lg:col-span-5 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" /> Configuration & Outline
            </CardTitle>
            <CardDescription className="text-xs">
              Upload your syllabus and configure assessment parameters.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Input Mode Toggle */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-xs font-semibold text-foreground">Input Method</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={!useTextInput ? "secondary" : "ghost"}
                  className="h-7 text-xs"
                  onClick={() => setUseTextInput(false)}
                >
                  Upload File
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={useTextInput ? "secondary" : "ghost"}
                  className="h-7 text-xs"
                  onClick={() => setUseTextInput(true)}
                >
                  Paste Text
                </Button>
              </div>
            </div>

            {/* File Upload or Text Paste */}
            {!useTextInput ? (
              <div>
                <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 text-center cursor-pointer transition-colors hover:border-primary/60 hover:bg-muted/20">
                  <UploadCloud className="h-8 w-8 text-muted-foreground/60 mb-2" />
                  <span className="text-xs font-semibold text-foreground">
                    {selectedFile ? selectedFile.name : "Click to select Course Outline"}
                  </span>
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    Accepts PDF, DOCX, or TXT (up to 25MB)
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
                {selectedFile && (
                  <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Ready: {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
            ) : (
              <div>
                <Label className="text-xs">Paste Course Outline / Syllabus</Label>
                <textarea
                  value={courseTextInput}
                  onChange={(e) => setCourseTextInput(e.target.value)}
                  placeholder="Paste modules, lecture topics, and learning objectives here..."
                  rows={6}
                  className="mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            )}

            {/* Assessment Options Form */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Question Type</Label>
                  <Select value={questionType} onValueChange={setQuestionType}>
                    <SelectTrigger className="mt-1.5 h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Difficulty</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger className="mt-1.5 h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((d) => (
                        <SelectItem key={d} value={d} className="text-xs">
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Question Count</Label>
                  <Input
                    type="number"
                    min={1}
                    max={25}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="mt-1.5 h-9 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs">Topic / Chapter (Optional)</Label>
                  <Input
                    placeholder="e.g. Unit 3: Neural Networks"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="mt-1.5 h-9 text-xs"
                  />
                </div>
              </div>

              {/* Checkbox Toggles */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAnswers}
                    onChange={(e) => setIncludeAnswers(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Include Correct Answers</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeExplanations}
                    onChange={(e) => setIncludeExplanations(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Include Explanations</span>
                </label>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || (!useTextInput && !selectedFile) || (useTextInput && !courseTextInput.trim())}
                className="w-full mt-3 h-10 font-semibold text-xs"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Questions with Gemma 3...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Generate Questions
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Generated Questions List (7 cols) */}
        <Card className="lg:col-span-7 flex flex-col">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-primary" /> Generated Questions ({questions.length})
              </CardTitle>
              {questions.length > 0 && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleExportJson}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export JSON
                </Button>
              )}
            </div>
            <CardDescription className="text-xs">
              Every question is formulated strictly using the uploaded course content.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[750px] scrollbar-thin">
            {generateMutation.isPending ? (
              <div className="py-24 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="font-semibold text-foreground text-sm">Gemma 3 is synthesizing questions...</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Reviewing syllabus concepts, mapping Bloom's taxonomy, and validating JSON structure.
                </p>
              </div>
            ) : questions.length === 0 ? (
              <div className="py-24 text-center text-xs text-muted-foreground">
                <HelpCircle className="mx-auto h-8 w-8 opacity-40 mb-2" />
                <p>Configure options on the left and click "Generate Questions".</p>
              </div>
            ) : (
              questions.map((q, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border/70 bg-card p-4 shadow-sm space-y-3 transition-colors hover:border-primary/40"
                >
                  {/* Header: Type, Difficulty, Copy */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                        {idx + 1}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {q.type}
                      </Badge>
                      <Badge
                        className={`text-[10px] ${
                          q.difficulty === "Easy"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : q.difficulty === "Hard"
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {q.difficulty}
                      </Badge>
                      {q.topic && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                          Topic: {q.topic}
                        </span>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopyQuestion(q, idx)}
                    >
                      {copiedId === idx ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Question Text */}
                  <p className="font-semibold text-xs leading-relaxed text-foreground">
                    {q.question}
                  </p>

                  {/* MCQ Options */}
                  {q.options && q.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt, optIdx) => {
                        const isCorrect = q.correctAnswer && q.correctAnswer.trim().toLowerCase() === opt.trim().toLowerCase();
                        const optionLetter = String.fromCharCode(65 + optIdx);
                        return (
                          <div
                            key={optIdx}
                            className={`rounded-lg p-2.5 text-xs border flex items-center gap-2 ${
                              isCorrect && revealedAnswers[idx]
                                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 font-medium"
                                : "border-border/60 bg-muted/20 text-foreground"
                            }`}
                          >
                            <span className="font-bold text-[10px] text-muted-foreground">{optionLetter}.</span>
                            <span>{opt}</span>
                            {isCorrect && revealedAnswers[idx] && (
                              <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Toggle Answer / Explanation Drawer */}
                  {(q.correctAnswer || q.explanation) && (
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 p-0 text-[11px] font-semibold text-primary"
                          onClick={() => toggleRevealAnswer(idx)}
                        >
                          {revealedAnswers[idx] ? "Hide Answer & Explanation" : "Reveal Answer & Explanation"}
                        </Button>
                      </div>

                      {revealedAnswers[idx] && (
                        <div className="mt-2 space-y-2 rounded-lg bg-muted/30 p-3 border border-border/40 text-xs">
                          {q.correctAnswer && (
                            <div>
                              <span className="font-semibold text-foreground">Answer: </span>
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                {q.correctAnswer}
                              </span>
                            </div>
                          )}
                          {q.explanation && (
                            <div className="text-muted-foreground leading-relaxed">
                              <span className="font-semibold text-foreground">Explanation: </span>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

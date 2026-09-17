import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  UploadCloud,
  FileText,
  Sparkles,
  Send,
  Loader2,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ChevronRight,
  Layers,
  HelpCircle,
  RefreshCw,
  MessageSquare,
  Trash2,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Progress } from "../../components/ui/progress";
import { aiService, AiDocument, RagSource } from "../../services/aiService";
import { apiErrorMessage } from "../../services/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  grounded?: boolean;
  sources?: RagSource[];
  timestamp: string;
}

const SUMMARY_TYPES = [
  { value: "detailed", label: "Detailed Summary", hint: "Comprehensive academic breakdown" },
  { value: "short", label: "Short Summary", hint: "1-2 focused paragraphs" },
  { value: "key_points", label: "Key Takeaways", hint: "Core points and findings" },
  { value: "important_concepts", label: "Important Concepts", hint: "Key terminology and formulas" },
  { value: "topic_summary", label: "Topic/Chapter Summary", hint: "Organized by units/sections" },
];

export default function PdfAssistant() {
  const [searchParams] = useSearchParams();
  const initialDocId = searchParams.get("docId") ? Number(searchParams.get("docId")) : null;

  const [selectedDocId, setSelectedDocId] = useState<number | null>(initialDocId);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [summaryType, setSummaryType] = useState<string>("detailed");
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);

  const [questionInput, setQuestionInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch documents list for selector
  const { data: documents, refetch: refetchDocs } = useQuery({
    queryKey: ["ai-documents"],
    queryFn: aiService.listDocuments,
  });

  // Fetch current selected document details
  const { data: currentDoc, isLoading: docLoading } = useQuery({
    queryKey: ["ai-document", selectedDocId],
    queryFn: () => (selectedDocId ? aiService.getDocument(selectedDocId) : null),
    enabled: Boolean(selectedDocId),
  });

  // Populate existing summary if already present on document
  useEffect(() => {
    if (currentDoc) {
      if (currentDoc.summary) {
        setSummaryText(currentDoc.summary);
      } else {
        setSummaryText(null);
      }
      if (currentDoc.keyPoints && Array.isArray(currentDoc.keyPoints)) {
        setKeyPoints(currentDoc.keyPoints);
      } else {
        setKeyPoints([]);
      }
    }
  }, [currentDoc]);

  // Scroll chat into view
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Load chat history from localStorage when document changes
  useEffect(() => {
    if (!selectedDocId) {
      setChatMessages([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`acadiq_pdf_chat_${selectedDocId}`);
      if (saved) {
        setChatMessages(JSON.parse(saved));
      } else {
        setChatMessages([]);
      }
    } catch {
      setChatMessages([]);
    }
  }, [selectedDocId]);

  // Persist chat history to localStorage
  useEffect(() => {
    if (selectedDocId && chatMessages.length > 0) {
      try {
        localStorage.setItem(`acadiq_pdf_chat_${selectedDocId}`, JSON.stringify(chatMessages));
      } catch {
        // storage quota exceeded or unavailable
      }
    }
  }, [selectedDocId, chatMessages]);

  const handleClearChat = () => {
    if (selectedDocId) {
      localStorage.removeItem(`acadiq_pdf_chat_${selectedDocId}`);
    }
    setChatMessages([]);
  };

  // Handle PDF upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Please select a valid PDF document.");
      return;
    }

    setUploadFile(file);
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const result = await aiService.uploadPdf(file, undefined, (pct) => {
        setUploadProgress(Math.max(10, pct));
      });
      setIsUploading(false);
      setUploadProgress(100);
      setSelectedDocId(result.documentId);
      refetchDocs();
    } catch (err) {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadError(apiErrorMessage(err, "Failed to upload and parse PDF"));
    }
  };

  // Summarize Mutation
  const summarizeMutation = useMutation({
    mutationFn: () => {
      if (!selectedDocId) throw new Error("No document selected");
      return aiService.summarizePdf(selectedDocId, summaryType);
    },
    onSuccess: (data) => {
      setSummaryText(data.summary);
      setKeyPoints(data.keyPoints || []);
    },
  });

  // Ask Question Mutation
  const askMutation = useMutation({
    mutationFn: (question: string) => {
      if (!selectedDocId) throw new Error("No document selected");
      return aiService.askPdf(selectedDocId, question);
    },
    onSuccess: (data, question) => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          role: "assistant",
          content: data.answer,
          grounded: data.grounded,
          sources: data.sources,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    },
    onError: (err) => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          role: "assistant",
          content: `Error: ${apiErrorMessage(err, "Failed to generate answer")}`,
          grounded: false,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    },
  });

  const handleSendQuestion = (q?: string) => {
    const questionToSend = q || questionInput;
    if (!questionToSend.trim() || !selectedDocId || askMutation.isPending) return;

    setChatMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        role: "user",
        content: questionToSend.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    setQuestionInput("");
    askMutation.mutate(questionToSend.trim());
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="RAG-Powered Academic Research"
        title="PDF Assistant"
        description="Upload textbooks, research papers, or syllabus documents. Extract clean text, chunk into vector embeddings with nomic-embed-text, generate structured summaries, and ask grounded questions with source citations."
      />

      {/* Document Selector & Upload Bar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Upload Card */}
        <Card className="border-dashed lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-primary" /> Upload New PDF
            </CardTitle>
            <CardDescription className="text-xs">
              Supports searchable PDFs up to 25MB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center cursor-pointer transition-colors hover:border-primary/60 hover:bg-muted/30">
              <FileText className="h-8 w-8 text-muted-foreground/80 mb-2" />
              <span className="text-xs font-semibold text-foreground">Click to upload PDF</span>
              <span className="mt-1 text-[11px] text-muted-foreground">Automatic chunking & embeddings</span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                disabled={isUploading}
                onChange={handleFileUpload}
              />
            </label>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Parsing & embedding document...
                  </span>
                  <span className="font-semibold">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {uploadError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Document Overview */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Active Document
              </CardTitle>

              {documents && documents.length > 0 && (
                <div className="w-64">
                  <Select
                    value={selectedDocId ? String(selectedDocId) : ""}
                    onValueChange={(val) => setSelectedDocId(Number(val))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select an uploaded PDF" />
                    </SelectTrigger>
                    <SelectContent>
                      {documents
                        .filter((d) => d.fileType === "PDF")
                        .map((d) => (
                          <SelectItem key={d.id} value={String(d.id)} className="text-xs">
                            {d.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <CardDescription className="text-xs">
              Context ground for summarization and vector retrieval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {docLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading document details...
              </div>
            ) : currentDoc ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-foreground truncate">{currentDoc.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{currentDoc.originalName}</p>
                    </div>
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Vector Indexed
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                    <div className="rounded bg-card p-2.5 border border-border/50">
                      <span className="text-[10px] uppercase text-muted-foreground">Pages</span>
                      <p className="font-semibold text-foreground text-sm">
                        {currentDoc.metadata?.pageCount || 1}
                      </p>
                    </div>
                    <div className="rounded bg-card p-2.5 border border-border/50">
                      <span className="text-[10px] uppercase text-muted-foreground">Indexed Chunks</span>
                      <p className="font-semibold text-foreground text-sm">{currentDoc.chunkCount}</p>
                    </div>
                    <div className="rounded bg-card p-2.5 border border-border/50">
                      <span className="text-[10px] uppercase text-muted-foreground">Size</span>
                      <p className="font-semibold text-foreground text-sm">
                        {(currentDoc.fileSize / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <div className="rounded bg-card p-2.5 border border-border/50">
                      <span className="text-[10px] uppercase text-muted-foreground">Embedding</span>
                      <p className="font-semibold text-foreground text-sm">nomic-embed</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-muted-foreground">
                <FileText className="mx-auto h-8 w-8 opacity-40 mb-2" />
                <p>No document selected. Please upload a PDF or select an existing document from the dropdown above.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two Columns: Summarizer (Left) and Ask PDF Chat (Right) */}
      {currentDoc && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Summary Column */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Document Summary
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={summaryType} onValueChange={setSummaryType}>
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUMMARY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="text-xs">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => summarizeMutation.mutate()}
                    disabled={summarizeMutation.isPending}
                  >
                    {summarizeMutation.isPending ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Generate
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <CardDescription className="text-xs">
                AI synthesis powered by Gemma 3 across document sections.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              {summarizeMutation.isError && (
                <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                  {apiErrorMessage(summarizeMutation.error, "Failed to generate summary")}
                </div>
              )}

              {summaryText ? (
                <div className="space-y-4">
                  {keyPoints.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Key Points & Takeaways
                      </h4>
                      <div className="space-y-1.5">
                        {keyPoints.map((point, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs rounded-md bg-muted/30 p-2 border border-border/40">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                              {idx + 1}
                            </span>
                            <span className="text-foreground">{point}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Full Synthesis
                    </h4>
                    <div className="rounded-lg border border-border/60 bg-card p-4 text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-96 overflow-y-auto scrollbar-thin">
                      {summaryText}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-xs text-muted-foreground">
                  <BookOpen className="mx-auto h-8 w-8 opacity-40 mb-2" />
                  <p>Click "Generate" to create a structured summary of this document.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ask PDF (RAG Chat) Column */}
          <Card className="flex flex-col h-[650px]">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" /> Ask Document (RAG)
                </span>
                <div className="flex items-center gap-2">
                  {chatMessages.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                      onClick={handleClearChat}
                      title="Clear chat history for this document"
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Clear
                    </Button>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    Gemma 3 + nomic-embed
                  </Badge>
                </div>
              </CardTitle>
              <CardDescription className="text-xs">
                Answers are grounded strictly in the document context. Sources & page numbers will be cited.
              </CardDescription>
            </CardHeader>

            {/* Chat Messages Log */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {chatMessages.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground space-y-3">
                  <HelpCircle className="mx-auto h-8 w-8 opacity-40" />
                  <p>Ask any question about this document. The system will retrieve relevant chunks and generate a grounded answer.</p>
                  <div className="pt-2 flex flex-wrap justify-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => handleSendQuestion("What is the core objective of this document?")}
                    >
                      "What is the core objective?"
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => handleSendQuestion("Explain the primary methodologies used.")}
                    >
                      "Explain the methodologies"
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => handleSendQuestion("What are the key conclusions?")}
                    >
                      "What are the conclusions?"
                    </Button>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/40 border border-border/70 text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Source Citations */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-border/50">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                            <Layers className="h-3 w-3" /> Cited Document Sources
                          </p>
                          <div className="space-y-1">
                            {msg.sources.map((src, i) => (
                              <div
                                key={i}
                                className="rounded bg-background/80 p-1.5 text-[11px] border border-border/40 flex items-center justify-between gap-2"
                              >
                                <span className="font-medium text-primary truncate">
                                  {src.pageNumber ? `Page ${src.pageNumber}` : `Chunk #${src.chunkIndex}`}
                                  {src.section ? ` (${src.section})` : ""}
                                </span>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {Math.round(src.similarity * 100)}% match
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="mt-1 text-[10px] text-muted-foreground px-1">{msg.timestamp}</span>
                  </div>
                ))
              )}

              {askMutation.isPending && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg border border-border/40 w-fit">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Searching document chunks & generating grounded answer...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </CardContent>

            {/* Question Input */}
            <div className="p-3 border-t border-border/60 bg-card">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendQuestion();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="Ask a question about this document..."
                  disabled={askMutation.isPending}
                  className="text-xs h-10"
                />
                <Button
                  type="submit"
                  disabled={!questionInput.trim() || askMutation.isPending}
                  className="h-10 px-4"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

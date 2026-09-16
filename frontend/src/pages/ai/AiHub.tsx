import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { aiService } from "../../services/aiService";

export default function AiHub() {
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["ai-status"],
    queryFn: aiService.getStatus,
    refetchInterval: 15000,
  });

  const { data: documents, refetch: refetchDocs } = useQuery({
    queryKey: ["ai-documents"],
    queryFn: aiService.listDocuments,
  });

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this document and its indexed chunks?")) return;
    try {
      await aiService.deleteDocument(id);
      refetchDocs();
    } catch {
      // Handled by api interceptor
    }
  };

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

      {/* Uploaded Documents List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" /> Indexed AI Documents
              </CardTitle>
              <CardDescription className="text-xs">
                Documents available for RAG vector search, summarization, and question generation.
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/ai/pdf">Upload New PDF</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                      <Link to={`/ai/pdf?docId=${doc.id}`}>
                        <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" /> Open in Assistant
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(doc.id)}
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  UploadCloud,
  Eye,
  Sparkles,
  Loader2,
  AlertCircle,
  X,
  FileText,
  LineChart,
  Code,
  Binary,
  Layers,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { aiService, ImageAnalysisResult } from "../../services/aiService";
import { apiErrorMessage } from "../../services/api";

const PRESET_QUESTIONS = [
  { label: "What is shown in this image?", icon: Eye },
  { label: "Explain this diagram.", icon: Layers },
  { label: "Read the text from this image.", icon: FileText },
  { label: "Explain this chart.", icon: LineChart },
  { label: "What does this screenshot contain?", icon: Code },
  { label: "Explain this mathematical equation.", icon: Binary },
];

export default function ImageAssistant() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [question, setQuestion] = useState("What is shown in this image?");
  const [result, setResult] = useState<ImageAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, or WEBP).");
      return;
    }

    setSelectedFile(file);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  };

  const analyzeMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error("No image selected");
      return aiService.analyzeImage(selectedFile, question);
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (err) => {
      setError(apiErrorMessage(err, "Failed to analyze image"));
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Vision AI Intelligence"
        title="Image Assistant"
        description="Upload academic diagrams, charts, screenshots, mathematical formulas, or scanned lecture notes. Qwen2.5-VL provides deep visual understanding and OCR."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Upload & Preview Card (5 columns) */}
        <Card className="lg:col-span-5 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" /> Image Preview
              </CardTitle>
              {selectedFile && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={handleClearImage}
                >
                  <X className="mr-1 h-3 w-3" /> Clear
                </Button>
              )}
            </div>
            <CardDescription className="text-xs">
              Supports PNG, JPG, WEBP, or GIF up to 15MB.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            {previewUrl ? (
              <div className="relative rounded-xl border border-border overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center p-2 min-h-[300px]">
                <img
                  src={previewUrl}
                  alt="Upload preview"
                  className="max-h-[400px] w-auto max-w-full rounded-lg object-contain shadow-sm"
                />
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 p-12 text-center cursor-pointer transition-colors hover:border-primary/60 hover:bg-muted/20 min-h-[300px]">
                <UploadCloud className="h-10 w-10 text-muted-foreground/60 mb-3" />
                <span className="text-sm font-semibold text-foreground">Click to upload image</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Diagrams, charts, code, math formulas, or scanned pages
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            )}

            {selectedFile && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground px-1">
                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prompt & AI Response Card (7 columns) */}
        <Card className="lg:col-span-7 flex flex-col">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Visual Analysis
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                Qwen2.5-VL:3b
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Choose a preset question or ask a custom academic inquiry about the image.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 space-y-5 pt-4">
            {/* Preset Questions Chips */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Suggested Visual Inquiries
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_QUESTIONS.map((q, idx) => {
                  const Icon = q.icon;
                  return (
                    <Button
                      key={idx}
                      type="button"
                      variant={question === q.label ? "secondary" : "outline"}
                      size="sm"
                      className="h-7 text-xs font-normal"
                      onClick={() => setQuestion(q.label)}
                    >
                      <Icon className="mr-1.5 h-3 w-3 text-primary" />
                      {q.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Question Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Your Question</label>
              <div className="flex items-center gap-2">
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. Explain this diagram step by step..."
                  className="text-xs h-10"
                />
                <Button
                  onClick={() => analyzeMutation.mutate()}
                  disabled={!selectedFile || analyzeMutation.isPending || !question.trim()}
                  className="h-10 px-5 text-xs font-semibold"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1.5 h-4 w-4" /> Analyze
                    </>
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* AI Response Output */}
            {result ? (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider">AI Explanation</span>
                  <span>Model: {result.model}</span>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/20 p-5 text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-[420px] overflow-y-auto scrollbar-thin shadow-inner">
                  {result.answer}
                </div>
              </div>
            ) : analyzeMutation.isPending ? (
              <div className="py-20 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="font-medium text-foreground">Analyzing image with Qwen2.5-VL...</p>
                <p className="text-[11px] text-muted-foreground max-w-sm">
                  Detecting visual shapes, text, axes, and structure to build a detailed educational response.
                </p>
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-muted-foreground">
                <Eye className="mx-auto h-8 w-8 opacity-40 mb-2" />
                <p>Upload an image and click "Analyze" to inspect visual content.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

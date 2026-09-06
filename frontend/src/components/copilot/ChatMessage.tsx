import AIResponseCard from "./AIResponseCard";

interface ChatMessageProps {
  role: "USER" | "ASSISTANT";
  content: string;
  reasoning?: string | null;
  confidence?: number | null;
  sources?: string[];
}

export default function ChatMessage({ role, content, reasoning, confidence, sources = [] }: ChatMessageProps) {
  if (role === "USER") {
    return (
      <div className="border-l-2 border-primary-200 pl-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">You asked</p>
        <p className="mt-0.5 text-small text-foreground">{content}</p>
      </div>
    );
  }

  return (
    <AIResponseCard
      answer={content}
      reasoning={reasoning ?? "No reasoning recorded for this response."}
      confidence={confidence ?? 0}
      sources={sources}
    />
  );
}

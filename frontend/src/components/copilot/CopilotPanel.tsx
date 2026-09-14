import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Gauge, Wrench, Copy, Target, FileEdit } from "lucide-react";
import { useCopilotChat, useCopilotSession } from "../../hooks/useCopilot";
import { apiErrorMessage } from "../../services/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import ChatMessage from "./ChatMessage";
import QuickActionButton from "./QuickActionButton";
import TypingIndicator from "./TypingIndicator";

interface Turn {
  role: "USER" | "ASSISTANT";
  content: string;
  reasoning?: string | null;
  confidence?: number | null;
  sources?: string[];
}

interface CopilotPanelProps {
  courseId: number;
  examId?: number;
  reportId?: number;
  contextLabel?: string;
}

const QUICK_ACTIONS = [
  { icon: Gauge, label: "Explain Score", prompt: "Explain why this exam received its current quality score." },
  { icon: Wrench, label: "Improve Questions", prompt: "What specific changes would improve the questions in this exam?" },
  { icon: Target, label: "Check CO Coverage", prompt: "Which course outcomes are weakly covered by this exam, and why?" },
  { icon: Copy, label: "Find Similar Questions", prompt: "Have any questions in this exam been repeated from previous papers?" },
  { icon: FileEdit, label: "Suggest Better Questions", prompt: "Suggest improved, application-based versions of the weakest questions." },
];

/**
 * The Copilot only ever answers through AcadIQ's own retrieved data (see
 * backend copilot.service.ts) — this panel is the surface for that, not a
 * general chat window. Every assistant turn renders through AIResponseCard so
 * answer/reasoning/confidence/sources are always visible together.
 */
export default function CopilotPanel({ courseId, examId, reportId, contextLabel }: CopilotPanelProps) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const seededRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: session } = useCopilotSession(sessionId);
  const chat = useCopilotChat();

  useEffect(() => {
    if (session && !seededRef.current) {
      setTurns(
        session.messages.map((m) => ({
          role: m.role,
          content: m.content,
          reasoning: m.aiReasoning,
          confidence: m.confidence !== null ? Number(m.confidence) : null,
        }))
      );
      seededRef.current = true;
    }
  }, [session]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, chat.isPending]);

  async function send(message: string) {
    if (!message.trim() || chat.isPending) return;
    setError(null);
    setTurns((prev) => [...prev, { role: "USER", content: message }]);
    setInput("");
    try {
      const result = await chat.mutateAsync({ sessionId: sessionId ?? undefined, courseId, examId, reportId, message });
      if (!sessionId) setSessionId(result.sessionId);
      setTurns((prev) => [
        ...prev,
        { role: "ASSISTANT", content: result.answer, reasoning: result.reasoning, confidence: result.confidence, sources: result.sources },
      ]);
    } catch (err) {
      setError(apiErrorMessage(err, "AcadIQ Copilot could not respond"));
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border-2 border-primary-200 bg-card shadow-md dark:border-primary-800">
      <div className="border-b border-border bg-primary-50/60 px-5 py-4 dark:bg-primary-950/40">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-body font-bold leading-tight text-foreground">AcadIQ Copilot</p>
            <p className="text-small text-muted-foreground">Ask anything about this report</p>
          </div>
        </div>
        {contextLabel && (
          <p className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{contextLabel}</p>
        )}
      </div>

      <div className="border-b border-border px-5 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick actions</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <QuickActionButton
              key={action.label}
              icon={action.icon}
              label={action.label}
              onClick={() => send(action.prompt)}
              disabled={chat.isPending}
            />
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
        {turns.length === 0 ? (
          <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-primary-200 bg-primary-50/40 px-5 py-8 text-center dark:border-primary-800 dark:bg-primary-950/30">
            <Sparkles className="h-7 w-7 text-primary" />
            <p className="text-body font-semibold text-foreground">Start a conversation</p>
            <p className="text-small text-muted-foreground">
              Type a question below or pick a quick action — AcadIQ Copilot answers only from your academic data.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {turns.map((t, i) => (
              <ChatMessage key={i} role={t.role} content={t.content} reasoning={t.reasoning} confidence={t.confidence} sources={t.sources} />
            ))}
            {chat.isPending && <TypingIndicator />}
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-md border border-error-border bg-error-bg px-3 py-2 text-small text-error">{error}</div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t-2 border-primary-100 bg-muted/30 p-4 dark:border-primary-900"
      >
        <div className="flex items-center gap-2 rounded-xl border-2 border-primary-200 bg-card p-1.5 shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30 dark:border-primary-800">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AcadIQ Copilot…"
            disabled={chat.isPending}
            className="h-12 border-0 bg-transparent px-3 text-body shadow-none hover:border-0 focus-visible:border-0 focus-visible:ring-0"
          />
          <Button type="submit" size="lg" className="h-11 shrink-0 gap-2 px-5" disabled={chat.isPending || !input.trim()}>
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Press Enter to send</p>
      </form>
    </div>
  );
}

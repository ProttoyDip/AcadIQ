import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Gauge, Wrench, Copy, Target, FileEdit, ChevronDown, Mic, Square, Loader2 } from "lucide-react";
import { useCopilotChat, useCopilotSession, useCopilotVoice } from "../../hooks/useCopilot";
import { MAX_RECORDING_SECONDS, useSpeech, useVoiceRecorder } from "../../hooks/useVoice";
import { apiErrorMessage } from "../../services/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import ChatMessage from "./ChatMessage";
import QuickActionButton from "./QuickActionButton";
import TypingIndicator from "./TypingIndicator";
import { CopilotRetrieval } from "../../types";
import AiModelSelector from "../ai/AiModelSelector";

interface Turn {
  role: "USER" | "ASSISTANT";
  content: string;
  reasoning?: string | null;
  confidence?: number | null;
  sources?: string[];
  retrieval?: CopilotRetrieval;
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
  const [actionsOpen, setActionsOpen] = useState(true);
  const seededRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: session } = useCopilotSession(sessionId);
  const chat = useCopilotChat();
  const voice = useCopilotVoice();
  const recorder = useVoiceRecorder();
  const speech = useSpeech();

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
    setActionsOpen(false);
    setTurns((prev) => [...prev, { role: "USER", content: message }]);
    setInput("");
    try {
      const result = await chat.mutateAsync({ sessionId: sessionId ?? undefined, courseId, examId, reportId, message });
      if (!sessionId) setSessionId(result.sessionId);
      setTurns((prev) => [
        ...prev,
        { role: "ASSISTANT", content: result.answer, reasoning: result.reasoning, confidence: result.confidence, sources: result.sources, retrieval: result.retrieval },
      ]);
    } catch (err) {
      setError(apiErrorMessage(err, "AcadIQ Copilot could not respond"));
    }
  }

  /**
   * Click to start, click again to stop and send. The transcript is shown as
   * the user's own turn before the answer arrives: a misheard question and a
   * bad answer look identical otherwise, and mishearing is the common failure.
   */
  async function handleMic() {
    if (recorder.state === "recording") {
      recorder.stop();
      return;
    }
    setError(null);
    const clip = await recorder.start();
    if (!clip) {
      if (recorder.error) setError(recorder.error);
      return;
    }
    setActionsOpen(false);
    try {
      const result = await voice.mutateAsync({
        payload: { sessionId: sessionId ?? undefined, courseId, examId, reportId },
        clip,
      });
      if (!sessionId) setSessionId(result.sessionId);
      setTurns((prev) => [
        ...prev,
        { role: "USER", content: result.transcript },
        { role: "ASSISTANT", content: result.answer, reasoning: result.reasoning, confidence: result.confidence, sources: result.sources, retrieval: result.retrieval },
      ]);
      speech.speak(result.answer);
    } catch (err) {
      setError(apiErrorMessage(err, "AcadIQ Copilot could not hear that"));
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border-2 border-primary-200 bg-card shadow-md dark:border-primary-800">
      <div className="flex items-center gap-3 border-b border-border bg-primary-50/60 px-4 py-3 dark:bg-primary-950/40">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-body font-bold leading-tight text-foreground">AcadIQ Copilot</p>
          <p className="truncate text-small text-muted-foreground">Ask anything about this report</p>
        </div>
        {contextLabel && (
          <span className="hidden shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:inline-flex">{contextLabel}</span>
        )}
      </div>

      <div className="shrink-0 border-b border-border px-4 py-3">
        <AiModelSelector compact disabled={chat.isPending} />
      </div>

      <div className="border-b border-border">
        <button
          type="button"
          onClick={() => setActionsOpen((open) => !open)}
          aria-expanded={actionsOpen}
          aria-controls="copilot-quick-actions"
          className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <span>Quick actions</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${actionsOpen ? "rotate-180" : ""}`} />
        </button>
        {actionsOpen && (
          <div id="copilot-quick-actions" className="flex flex-wrap gap-2 px-4 pb-3">
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
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
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
              <div key={i} className="flex flex-col gap-1">
                <ChatMessage role={t.role} content={t.content} reasoning={t.reasoning} confidence={t.confidence} sources={t.sources} />
                {t.role === "ASSISTANT" && t.retrieval && (
                  <p className="px-1 text-[11px] text-muted-foreground">
                    {t.retrieval.method === "EMBEDDING"
                      ? `Retrieved for this message: ${t.retrieval.syllabusChunks > 0 ? `${t.retrieval.syllabusChunks} syllabus passage${t.retrieval.syllabusChunks === 1 ? "" : "s"}` : "full syllabus (no passage stood out)"}${t.retrieval.relevantQuestions.length ? `, most relevant ${t.retrieval.relevantQuestions.map((n) => `Q${n}`).join(", ")}` : ""}`
                      : `Full-context mode (semantic retrieval unavailable${t.retrieval.reason ? `: ${t.retrieval.reason}` : ""})`}
                  </p>
                )}
              </div>
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
        className="border-t-2 border-primary-100 bg-muted/30 p-3 dark:border-primary-900"
      >
        <div className="flex items-center gap-2 rounded-xl border-2 border-primary-200 bg-card p-1 shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30 dark:border-primary-800">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={recorder.state === "recording" ? "Listening…" : "Ask AcadIQ Copilot…"}
            disabled={chat.isPending || voice.isPending || recorder.state === "recording"}
            className="h-11 border-0 bg-transparent px-3 text-body shadow-none hover:border-0 focus-visible:border-0 focus-visible:ring-0"
          />
          {recorder.supported && (
            <Button
              type="button"
              size="lg"
              variant={recorder.state === "recording" ? "destructive" : "ghost"}
              className="h-10 w-10 shrink-0 p-0"
              onClick={handleMic}
              disabled={chat.isPending || voice.isPending}
              aria-label={recorder.state === "recording" ? "Stop recording and send" : "Ask by voice"}
              title={recorder.state === "recording" ? "Stop and send" : "Ask by voice"}
            >
              {voice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : recorder.state === "recording" ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          <Button type="submit" size="lg" className="h-10 shrink-0 gap-2 px-4" disabled={chat.isPending || voice.isPending || recorder.state === "recording" || !input.trim()}>
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
        <p className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {recorder.state === "recording"
              ? `Recording ${recorder.seconds}s — click the square to send (max ${MAX_RECORDING_SECONDS}s)`
              : voice.isPending
                ? "Transcribing your question…"
                : "Press Enter to send"}
          </span>
          {speech.speaking && (
            <button type="button" onClick={speech.cancel} className="shrink-0 font-medium text-primary hover:underline">
              Stop speaking
            </button>
          )}
        </p>
      </form>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { VoiceInput, appendTranscript } from "../ui/voice-input";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
import { Check, Copy, Loader2, LocateFixed, Paperclip, Send, Sparkles, Trash2, X, XCircle } from "lucide-react";
import { assistantService, AssistantPageContext } from "../../services/assistantService";
import { scheduleService } from "../../services/scheduleService";
import { apiErrorMessage } from "../../services/api";
import { useAssistantStore, AssistantMessage } from "../../store/assistantStore";
import { useAuth } from "../../hooks/useAuth";
import { todayIso } from "../../lib/dates";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { AssistantChatReply } from "../../types";

const QUICK = ["What do I teach today?", "Cancel my next class", "Find a make-up slot for the cancelled class", "Am I behind in any course?", "Draft a notice for the moved class"];
const QUICK_ADMIN = ["Which department routines are uploaded?", "Import the attached routine as Fall 2026", "Which rooms are free tomorrow 9–10:30?", "List users and their roles"];

function pageContext(pathname: string): AssistantPageContext {
  const course = /^\/courses\/(\d+)/.exec(pathname);
  const report = /^\/reports\/(\d+)/.exec(pathname);
  return { path: pathname, courseId: course ? Number(course[1]) : undefined, reportId: report ? Number(report[1]) : undefined };
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Renders read-only tool results in a compact, human way. */
function ResultBlock({ tool, result }: { tool: string; result: unknown }) {
  const r = result as Record<string, unknown>;
  if (tool === "draft_notice" && r?.body) {
    return (
      <div className="rounded-md bg-muted/50 p-2 text-xs">
        {r.subject ? <p className="mb-1 font-semibold">{String(r.subject)}</p> : null}
        <p className="whitespace-pre-wrap">{String(r.body)}</p>
        <Button size="sm" variant="ghost" className="mt-1 h-7 px-2 text-[11px]" onClick={() => navigator.clipboard.writeText(`${r.subject ? `${r.subject}\n\n` : ""}${r.body}`)}><Copy className="h-3 w-3" /> Copy</Button>
      </div>
    );
  }
  if (tool === "suggest_makeup_slots" && Array.isArray(r?.suggestions)) {
    const list = r.suggestions as Array<{ date: string; startTime: string; endTime: string; room: string | null; reasons: string[] }>;
    return <ul className="list-disc pl-4 text-xs">{list.slice(0, 4).map((s, i) => <li key={i}>{s.date} {s.startTime}–{s.endTime}{s.room ? ` · ${s.room}` : ""} <span className="text-muted-foreground">({s.reasons[0]})</span></li>)}</ul>;
  }
  if (tool === "get_free_rooms" && Array.isArray(r?.free)) {
    return <p className="text-xs">Free: {(r.free as string[]).join(", ") || "none"}{Array.isArray(r.busy) && (r.busy as unknown[]).length ? ` · busy: ${(r.busy as Array<{ room: string }>).map((b) => b.room).join(", ")}` : ""}</p>;
  }
  if (tool === "rewrite_question" && Array.isArray(r?.variants)) {
    return <ul className="flex flex-col gap-1 text-xs">{(r.variants as Array<{ text: string; bloomLevel: string }>).map((v, i) => <li key={i} className="rounded-md bg-muted/50 p-2"><Badge variant="brand" className="mb-1 px-1.5 py-0 text-[10px]">{v.bloomLevel}</Badge><p>{v.text}</p></li>)}</ul>;
  }
  if (tool === "import_my_routine" || tool === "import_department_routine") {
    const n = (r?.imported ?? r?.slotCount) as number | undefined;
    return <p className="text-xs">{n !== undefined ? `${n} slots imported` : "Imported"}{r?.method === "VISION" ? " (read from photo)" : ""}{typeof r?.lowConfidence === "number" && r.lowConfidence > 0 ? ` · ${r.lowConfidence} low-confidence rows — review on the Schedule page` : ""}</p>;
  }
  if ((tool === "list_users" || tool === "list_department_routines") && Array.isArray(result)) {
    const rows = result as Array<Record<string, unknown>>;
    return <ul className="list-disc pl-4 text-xs">{rows.slice(0, 12).map((row, i) => <li key={i}>{tool === "list_users" ? `${row.name} · ${row.email} · ${row.role}` : `#${row.id} ${row.termLabel} · ${row.slotCount} slots · ${row.originalName}`}</li>)}{rows.length > 12 && <li>+{rows.length - 12} more</li>}</ul>;
  }
  if (tool === "get_pace" && r?.status) return <p className="text-xs"><Badge variant="brand" className="px-1.5 py-0 text-[10px]">{String(r.status)}</Badge> {String(r.note ?? "")}</p>;
  if (tool === "get_clashes" && Array.isArray(result)) {
    const list = result as Array<{ severity: string; message: string }>;
    return list.length ? <ul className="list-disc pl-4 text-xs">{list.slice(0, 5).map((c, i) => <li key={i}><span className="font-semibold">{c.severity}</span> {c.message}</li>)}</ul> : <p className="text-xs text-muted-foreground">No clashes.</p>;
  }
  if (tool === "compare_blueprint" && r?.verdict) return <p className="text-xs"><Badge variant="brand" className="px-1.5 py-0 text-[10px]">{String(r.verdict).replace("_", " ")}</Badge> fit {String(r.fitScore)}/100</p>;
  if (tool === "export_course_file" && r?.downloadPath) return <p className="text-xs">Course file ready — open the course page → Course tools → Download.</p>;
  return null;
}

function PendingActions({ message, onDone }: { message: AssistantMessage; onDone: (outcome: AssistantMessage["outcome"]) => void }) {
  const reply = message.reply!;
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const run = useMutation({
    mutationFn: () => assistantService.execute({ actionToken: reply.actionToken!, actions: reply.pendingActions.map((a) => ({ tool: a.tool, args: a.args })), skip: [...skip] }),
    onSuccess: (r) => {
      onDone({ summary: r.summary, results: r.results });
      void queryClient.invalidateQueries();
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not run the actions")),
  });
  if (message.outcome) {
    return (
      <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2 text-xs">
        <p className="font-semibold text-foreground">{message.outcome.summary}</p>
        <ul className="mt-1 flex flex-col gap-0.5">
          {reply.pendingActions.map((a) => {
            const res = message.outcome!.results.find((r) => r.index === a.index);
            return (
              <li key={a.index} className="flex flex-col gap-1">
                <span className="flex items-start gap-1.5">
                  {res?.skipped ? <span className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground">–</span> : res?.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" />}
                  <span className={cn(res?.skipped && "text-muted-foreground line-through")}>{a.label}{res?.error ? <span className="text-error"> — {res.error}</span> : null}</span>
                </span>
                {res?.ok && !res.skipped && res.result !== undefined && <div className="pl-5"><ResultBlock tool={a.tool} result={res.result} /></div>}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  const remaining = reply.pendingActions.length - skip.size;
  return (
    <div className="mt-2 rounded-lg border border-primary-200 bg-primary-50/40 p-2 text-xs dark:border-primary-800 dark:bg-primary-950/30">
      <p className="mb-1 font-semibold text-foreground">Confirm to run:</p>
      <ul className="flex flex-col gap-1">
        {reply.pendingActions.map((a) => (
          <li key={a.index} className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 accent-primary" checked={!skip.has(a.index)} onChange={(e) => setSkip((s) => { const n = new Set(s); if (e.target.checked) n.delete(a.index); else n.add(a.index); return n; })} />
            <span className={cn(skip.has(a.index) && "text-muted-foreground line-through")}>{a.label}{a.why ? <span className="block text-[11px] text-muted-foreground">{a.why}</span> : null}</span>
          </li>
        ))}
      </ul>
      {error && <p className="mt-1 text-error">{error}</p>}
      <div className="mt-2 flex gap-2">
        <Button size="sm" className="h-8" onClick={() => run.mutate()} disabled={run.isPending || remaining === 0}>
          {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Confirm {remaining} action{remaining === 1 ? "" : "s"}
        </Button>
        <Button size="sm" variant="ghost" className="h-8" onClick={() => onDone({ summary: "Cancelled — nothing was changed.", results: reply.pendingActions.map((a) => ({ index: a.index, ok: true, skipped: true })) })}>Cancel</Button>
      </div>
    </div>
  );
}

export default function AssistantBubble() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { open, setOpen, toggle, position, setPosition, messages, push, update, clear } = useAssistantStore();

  // Bubble lives at absolute viewport coordinates driven by motion values, so dragging
  // never fights React re-renders; the panel is laid out relative to the bubble's rect.
  const BUBBLE = 56;
  const MARGIN = 16;
  const defaultPos = () => ({ x: window.innerWidth - BUBBLE - MARGIN, y: window.innerHeight - BUBBLE - 24 });
  const clamp = (p: { x: number; y: number }) => ({
    x: Math.min(Math.max(p.x, MARGIN), window.innerWidth - BUBBLE - MARGIN),
    y: Math.min(Math.max(p.y, MARGIN), window.innerHeight - BUBBLE - MARGIN),
  });
  const start = clamp(position ?? defaultPos());
  const bx = useMotionValue(start.x);
  const by = useMotionValue(start.y);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const layoutPanel = () => {
    const x = bx.get();
    const y = by.get();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(400, vw - 2 * MARGIN);
    const h = Math.min(600, vh - 2 * MARGIN - BUBBLE - 12);
    const above = y + BUBBLE / 2 > vh / 2;
    const top = above ? Math.max(MARGIN, y - 12 - h) : Math.min(vh - MARGIN - h, y + BUBBLE + 12);
    const alignRight = x + BUBBLE / 2 > vw / 2;
    const left = Math.min(Math.max(alignRight ? x + BUBBLE - w : x, MARGIN), vw - MARGIN - w);
    setPanelStyle({ top, left, width: w, height: h });
  };
  useEffect(() => {
    const onResize = () => {
      const p = clamp({ x: bx.get(), y: by.get() });
      bx.set(p.x);
      by.set(p.y);
      if (open) layoutPanel();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (open) layoutPanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const dragging = useRef(false);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const attach = useMutation({
    mutationFn: (file: File) => assistantService.attach(file),
    onSuccess: (a) => {
      setAttachments((list) => [...list, { id: a.id, name: a.name }]);
      push({ id: uid(), role: "assistant", content: `Attached “${a.name}”. Tell me what to do with it — e.g. “import this as my routine”${isAdmin ? " or “import this as the department routine for Fall 2026”" : ""}.`, createdAt: new Date().toISOString() });
    },
    onError: (e) => push({ id: uid(), role: "assistant", content: apiErrorMessage(e, "Could not attach that file."), createdAt: new Date().toISOString() }),
  });
  const isAdmin = user?.role === "ADMIN";
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const today = todayIso();
  const briefing = useQuery({ queryKey: ["schedule", "today", today], queryFn: () => scheduleService.today(today), enabled: user?.role === "FACULTY", staleTime: 60_000 });
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const unlogged = useMemo(() => (briefing.data?.sessions ?? []).filter((s) => s.status === "SCHEDULED" && Number(s.endTime.slice(0, 2)) * 60 + Number(s.endTime.slice(3, 5)) <= nowMin).length, [briefing.data, nowMin]);

  useEffect(() => {
    if (open) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      inputRef.current?.focus();
    }
  }, [open, messages.length]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const chat = useMutation({
    mutationFn: (message: string) =>
      assistantService.chat({
        message,
        history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        page: pageContext(location.pathname),
        clientDate: today,
      }),
    onSuccess: (reply: AssistantChatReply) => {
      const parts = [reply.reply];
      if (reply.followUpQuestion) parts.push(reply.followUpQuestion);
      if (reply.rejected.length) parts.push(`(Skipped ${reply.rejected.length} suggestion${reply.rejected.length === 1 ? "" : "s"} I couldn't validate.)`);
      push({ id: uid(), role: "assistant", content: parts.join("\n\n"), reply, createdAt: new Date().toISOString() });
      // An attachment referenced by a proposed action leaves the tray; the server deletes the file once the action runs.
      const used = new Set(reply.pendingActions.map((a) => a.args.attachmentId).filter((v): v is string => typeof v === "string"));
      if (used.size) setAttachments((list) => list.filter((a) => !used.has(a.id)));
      if (reply.navigate && reply.pendingActions.length === 0 && reply.navigate !== location.pathname) navigate(reply.navigate);
    },
    onError: (e) => push({ id: uid(), role: "assistant", content: apiErrorMessage(e, "Sorry — I couldn't process that."), createdAt: new Date().toISOString() }),
  });

  const send = (text: string) => {
    const message = text.trim();
    if (!message || chat.isPending) return;
    push({ id: uid(), role: "user", content: message, createdAt: new Date().toISOString() });
    setInput("");
    chat.mutate(message);
  };

  if (user?.role !== "FACULTY" && user?.role !== "ADMIN") return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            role="dialog"
            aria-label="AcadIQ Copilot"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={panelStyle}
            className="fixed z-40 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-float"
          >
            <header className="flex items-center justify-between gap-2 border-b border-border bg-primary-50/60 px-4 py-3 dark:bg-primary-950/40">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"><Sparkles className="h-4.5 w-4.5" /></span>
                <div className="min-w-0">
                  <p className="text-body font-bold leading-tight text-foreground">AcadIQ Copilot{isAdmin ? " · admin" : ""}</p>
                  <p className="truncate text-small text-muted-foreground">Tell me what to do — you confirm before it runs</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { const p = defaultPos(); bx.set(p.x); by.set(p.y); setPosition(null); layoutPanel(); }} aria-label="Reset bubble position" title="Reset position">
                  <LocateFixed className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={clear} aria-label="Clear conversation" title="Clear"><Trash2 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setOpen(false)} aria-label="Close AcadIQ Copilot"><X className="h-4 w-4" /></Button>
              </div>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 scrollbar-thin" aria-live="polite">
              {messages.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  <p className="mb-2">{isAdmin ? "Manage the department routine and users in plain language — attach the routine PDF/photo with the paperclip, then ask me to import it. Nothing changes until you confirm." : "Tell me what to do in plain language — cancel or move a class, log what you covered, draft a notice, plan the term, run an audit, draft a marking scheme, or attach your routine (PDF or photo) and ask me to import it. Nothing changes until you confirm."}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(isAdmin ? QUICK_ADMIN : QUICK).map((q) => (
                      <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground hover:border-primary hover:text-primary">{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[92%] rounded-2xl px-3 py-2 text-small", m.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground")}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.reply?.results.map((r, i) => (
                      <div key={i} className="mt-2">
                        <p className="text-[11px] font-semibold text-muted-foreground">{r.label}</p>
                        {r.ok ? <ResultBlock tool={r.tool} result={r.result} /> : <p className="text-xs text-error">{r.error}</p>}
                      </div>
                    ))}
                    {m.reply && m.reply.pendingActions.length > 0 && m.reply.actionToken && (
                      <PendingActions message={m} onDone={(outcome) => update(m.id, { outcome })} />
                    )}
                    {m.reply?.navigate && m.reply.pendingActions.length > 0 && m.outcome && (
                      <Button size="sm" variant="link" className="mt-1 h-auto p-0 text-xs" onClick={() => navigate(m.reply!.navigate!)}>Open {m.reply.navigate}</Button>
                    )}
                  </div>
                </div>
              ))}
              {chat.isPending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…</div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex flex-col gap-2 border-t border-border p-3"
            >
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {attachments.map((a) => (
                    <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground">
                      <Paperclip className="h-3 w-3" /> {a.name}
                      <button type="button" aria-label={`Remove ${a.name}`} className="ml-0.5 text-muted-foreground hover:text-error" onClick={() => { void assistantService.discardAttachment(a.id).catch(() => undefined); setAttachments((l) => l.filter((x) => x.id !== a.id)); }}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.txt,.csv,.jpg,.jpeg,.png,.webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) attach.mutate(f); e.target.value = ""; }} />
                <Button type="button" variant="ghost" size="sm" className="h-10 w-10 shrink-0 p-0" onClick={() => fileRef.current?.click()} disabled={attach.isPending} aria-label="Attach a routine file or photo" title="Attach routine (PDF, DOCX, photo)">
                  {attach.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
                <VoiceInput
                  label="your instruction"
                  disabled={chat.isPending}
                  onTranscript={(t) => {
                    // Dictated text lands in the box rather than sending itself.
                    // This assistant cancels classes and moves timetables; a
                    // misheard command should be read before it is acted on,
                    // even though every action still needs confirming.
                    setInput((v) => appendTranscript(v, t));
                    inputRef.current?.focus();
                  }}
                />
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isAdmin ? "e.g. Import the attached routine as Fall 2026" : "e.g. Cancel tomorrow's CSE301 and find a make-up"}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-small focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Message AcadIQ Copilot"
                />
                <Button type="submit" size="sm" className="h-10 w-10 p-0" disabled={!input.trim() || chat.isPending} aria-label="Send"><Send className="h-4 w-4" /></Button>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        drag
        dragMomentum={false}
        dragElastic={0}
        onDragStart={() => {
          dragging.current = true;
        }}
        onDragEnd={() => {
          const p = clamp({ x: bx.get(), y: by.get() });
          bx.set(p.x);
          by.set(p.y);
          setPosition(p);
          if (open) layoutPanel();
          // Let the synthetic click that follows a drag pass before re-enabling toggle.
          setTimeout(() => {
            dragging.current = false;
          }, 0);
        }}
        onClick={() => {
          if (!dragging.current) toggle();
        }}
        aria-label={open ? "Close AcadIQ Copilot" : "Open AcadIQ Copilot (drag to move)"}
        aria-expanded={open}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        whileDrag={{ scale: 1.08, cursor: "grabbing" }}
        style={{ x: bx, y: by, left: 0, top: 0 }}
        className="fixed z-40 flex h-14 w-14 cursor-grab touch-none select-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={open ? "Close AcadIQ Copilot" : "AcadIQ Copilot — drag to move"}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        {!open && unlogged > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-white ring-2 ring-card" title={`${unlogged} class${unlogged === 1 ? "" : "es"} to log`}>
            {unlogged}
          </span>
        )}
        {!open && unlogged > 0 && <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/40" aria-hidden="true" />}
      </motion.button>
    </>
  );
}

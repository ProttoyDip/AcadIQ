import { Loader2, Mic, Square } from "lucide-react";
import { useState } from "react";
import { copilotService } from "../../services/copilotService";
import { apiErrorMessage } from "../../services/api";
import { MAX_RECORDING_SECONDS, useVoiceRecorder } from "../../hooks/useVoice";
import { cn } from "../../lib/utils";

interface VoiceInputProps {
  /** Receives the transcript. Append rather than replace where a field may already hold text. */
  onTranscript: (text: string) => void;
  /** Surface-specific failures; falls back to an inline message when omitted. */
  onError?: (message: string) => void;
  disabled?: boolean;
  className?: string;
  /** Names the field being dictated, for the screen-reader label. */
  label?: string;
}

/**
 * Dictate into any text field. Click to record, click again to transcribe.
 *
 * Uses the server's Whisper endpoint rather than the browser's Web Speech API:
 * faculty here dictate in Bengali and Bangla-accented English, and Web Speech
 * handles neither well and only exists in Chrome. Renders nothing at all where
 * recording is unsupported, so no surface shows a button that cannot work.
 */
export function VoiceInput({ onTranscript, onError, disabled, className, label = "text" }: VoiceInputProps) {
  const recorder = useVoiceRecorder();
  const [busy, setBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  if (!recorder.supported) return null;

  const fail = (message: string) => {
    if (onError) onError(message);
    else setInlineError(message);
  };

  async function handleClick() {
    if (recorder.state === "recording") {
      recorder.stop();
      return;
    }
    setInlineError(null);
    const clip = await recorder.start();
    if (!clip) {
      if (recorder.error) fail(recorder.error);
      return;
    }
    setBusy(true);
    try {
      const { transcript } = await copilotService.transcribe(clip);
      onTranscript(transcript);
    } catch (err) {
      fail(apiErrorMessage(err, "Could not transcribe that recording"));
    } finally {
      setBusy(false);
    }
  }

  const recording = recorder.state === "recording";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || busy}
        aria-label={recording ? `Stop dictating and insert ${label}` : `Dictate ${label}`}
        title={recording ? "Stop and transcribe" : "Dictate with your voice"}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          recording
            ? "border-error-border bg-error-bg text-error hover:bg-error-bg/80"
            : "border-border bg-card text-muted-foreground hover:border-primary-200 hover:text-primary"
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
      </button>
      {(recording || busy) && (
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {recording ? `${recorder.seconds}s / ${MAX_RECORDING_SECONDS}s` : "Transcribing…"}
        </span>
      )}
      {inlineError && <span className="text-xs text-error">{inlineError}</span>}
    </span>
  );
}

/** Appends dictated text to whatever a field already contains, spacing sensibly. */
export function appendTranscript(existing: string, transcript: string): string {
  const base = existing.trimEnd();
  if (!base) return transcript;
  return /[.!?]$/.test(base) ? `${base} ${transcript}` : `${base} ${transcript}`;
}

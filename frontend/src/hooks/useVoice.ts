import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Microphone capture and speech playback for the Copilot.
 *
 * Recording uses MediaRecorder rather than the Web Speech API: faculty here
 * dictate in Bengali and Bangla-accented English, which the browser engines
 * transcribe poorly, and Web Speech is Chrome-only. The clip goes to Whisper
 * server-side instead. Playback does use the browser's speechSynthesis, which
 * is free, offline and everywhere — robotic, but nothing here needs a voice
 * actor.
 */

/** Longest clip we will record. Matches MAX_SPEECH_SECONDS on the server, and
 *  stops a forgotten open microphone from uploading minutes of room noise. */
export const MAX_RECORDING_SECONDS = 120;

export type RecorderState = "idle" | "recording" | "unsupported";

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  // Ordered by transcription quality per byte; Safari only offers mp4.
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export function useVoiceRecorder() {
  const supported =
    typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";

  const [state, setState] = useState<RecorderState>(supported ? "idle" : "unsupported");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const resolveRef = useRef<((clip: Blob | null) => void) | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    setSeconds(0);
  }, []);

  // A live microphone must not outlive the panel that opened it.
  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  /** Starts recording; resolves with the clip when `stop()` is called, or null if it failed. */
  const start = useCallback(async (): Promise<Blob | null> => {
    if (!supported) {
      setError("This browser cannot record audio. Type your question instead.");
      return null;
    }
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      // Distinguish "said no" from "no microphone": the fixes are different.
      const name = (err as DOMException)?.name;
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone access was blocked. Allow it in your browser's address bar, then try again."
          : name === "NotFoundError"
            ? "No microphone was found. Plug one in or type your question instead."
            : "Could not start recording. Type your question instead."
      );
      return null;
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    chunksRef.current = [];
    setState("recording");
    setSeconds(0);

    tickRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_RECORDING_SECONDS) stop();
        return s + 1;
      });
    }, 1000);

    const done = new Promise<Blob | null>((resolve) => {
      resolveRef.current = resolve;
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const clip = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      cleanup();
      setState("idle");
      resolveRef.current?.(clip.size > 0 ? clip : null);
      resolveRef.current = null;
    };
    recorder.onerror = () => {
      cleanup();
      setState("idle");
      setError("Recording stopped unexpectedly. Try again.");
      resolveRef.current?.(null);
      resolveRef.current = null;
    };

    recorder.start();
    return done;
  }, [supported, stop, cleanup]);

  return { supported, state, seconds, error, setError, start, stop };
}

/** Reads an answer aloud. No-ops where speechSynthesis is missing. */
export function useSpeech() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  // Leaving the panel mid-sentence should not leave a voice talking to an empty room.
  useEffect(() => cancel, [cancel]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [supported]
  );

  return { supported, speaking, speak, cancel };
}

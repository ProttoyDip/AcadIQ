interface ProviderFailure {
  message: string;
  /** True when waiting and retrying can succeed (429, or a 413 that is really a per-minute budget). */
  retryable: boolean;
  retryAfterMs: number | null;
  detail?: string;
  code?: string;
}

/**
 * Groq reports both "request exceeds the model's per-request token limit" and
 * "you have exhausted this minute's token budget" as HTTP 413. Only the first
 * is fatal; the second should be waited out like a 429. The body tells them apart:
 *   "... on tokens per minute (TPM): Limit 8000, Requested 2900, please try again in 4.2s"
 */
export async function classifyFailure(response: Response): Promise<ProviderFailure> {
  let detail = "";
  let code = "";
  try {
    const body = (await response.json()) as { error?: { message?: string; code?: string; type?: string } | string };
    detail = typeof body.error === "string" ? body.error : body.error?.message ?? "";
    code = typeof body.error === "object" ? body.error?.code ?? body.error?.type ?? "" : "";
  } catch {
    detail = "";
  }
  const wait = detail.match(/try again in\s*([\d.]+)\s*(ms|s|m)\b/i);
  const retryAfterMs = wait ? Math.round(Number(wait[1]) * (wait[2] === "ms" ? 1 : wait[2] === "m" ? 60_000 : 1000)) : null;

  if (response.status === 402 || code === "insufficient_quota") {
    return { message: "AI provider credits or quota are exhausted", retryable: false, retryAfterMs, detail, code };
  }

  if (response.status === 429) {
    return { message: "AI provider rate limit reached (HTTP 429) — please retry in a minute", retryable: true, retryAfterMs, detail };
  }
  if (response.status === 413) {
    const limits = detail.match(/Limit\s*([\d,]+).*?Requested\s*([\d,]+)/i);
    const limit = limits ? Number(limits[1].replace(/,/g, "")) : null;
    const requested = limits ? Number(limits[2].replace(/,/g, "")) : null;
    const perMinute = /per minute|TPM|RPM/i.test(detail);
    if (perMinute && limit !== null && requested !== null && requested <= limit) {
      return {
        message: `AI provider token budget for this minute is used up (${requested.toLocaleString()} of ${limit.toLocaleString()} tokens/min) — please retry shortly`,
        retryable: true,
        retryAfterMs,
        detail,
      };
    }
    return {
      message: requested !== null && limit !== null
        ? `This request needs ~${requested.toLocaleString()} tokens but the AI provider allows ${limit.toLocaleString()} per request. Reduce the syllabus or question count and retry.`
        : "This request is too large for the AI provider's per-request limit. Reduce the syllabus or question count and retry.",
      retryable: false,
      retryAfterMs: null,
      detail,
    };
  }
  return { message: `AI provider returned HTTP ${response.status}`, retryable: response.status >= 500, retryAfterMs: null, detail, code };
}


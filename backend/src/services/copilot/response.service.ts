import { callLlmChatJson, ChatMessage } from "../../ai/llmClient";
import { copilotResponseSchema, CopilotAiResponse } from "../../ai/schemas/copilotResponse.schema";
import { AppError } from "../../middleware/error.middleware";
import { logger } from "../../utils/logger";

/**
 * Step 5 of the retrieval flow: "Send to LLM → Return answer with
 * explanation". Isolated so the orchestrator (copilot.service.ts) never talks
 * to the raw LLM client directly — every response is schema-validated here
 * before anything downstream can treat it as trustworthy. An LLM reply that
 * doesn't fit the required {answer, reasoning, confidence} shape is rejected
 * outright rather than persisted or shown to the faculty member.
 */
/**
 * A reply that arrives intact but omits a required field is a formatting slip,
 * not a provider outage, so llmClient's transport retries never see it. One
 * bounded re-ask — naming the fields that were missing — recovers those without
 * loosening the schema, which stays strict on purpose. Only one: beyond that a
 * model that cannot produce the shape is unlikely to on a third try, and every
 * attempt is a billed call.
 */
const MAX_SHAPE_RETRIES = 1;

function missingFieldNames(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }): string[] {
  return Object.entries(error.flatten().fieldErrors)
    .filter(([, errors]) => errors?.length)
    .map(([field]) => field);
}

export async function generateCopilotResponse(messages: ChatMessage[]): Promise<CopilotAiResponse> {
  let conversation = messages;
  let lastError: ReturnType<typeof copilotResponseSchema.safeParse> & { success: false };

  for (let attempt = 0; attempt <= MAX_SHAPE_RETRIES; attempt += 1) {
    const raw = await callLlmChatJson<unknown>(conversation);
    const parsed = copilotResponseSchema.safeParse(raw);
    if (parsed.success) return parsed.data;

    lastError = parsed;
    const missing = missingFieldNames(parsed.error);
    logger.warn("copilot_response_shape_invalid", { attempt: attempt + 1, missing });

    if (attempt < MAX_SHAPE_RETRIES) {
      conversation = [
        ...conversation,
        { role: "assistant", content: JSON.stringify(raw) },
        {
          role: "user",
          content: `That reply was rejected: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required. Reply again with JSON only, containing every one of "answer", "reasoning" and "confidence". Do not add any other field.`,
        },
      ];
    }
  }

  throw new AppError(
    "AcadIQ Copilot returned an unsupported response and did not answer.",
    502,
    lastError!.error.flatten()
  );
}

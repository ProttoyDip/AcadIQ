import { callLlmChatJson, ChatMessage } from "../../ai/llmClient";
import { copilotResponseSchema, CopilotAiResponse } from "../../ai/schemas/copilotResponse.schema";
import { AppError } from "../../middleware/error.middleware";

/**
 * Step 5 of the retrieval flow: "Send to LLM → Return answer with
 * explanation". Isolated so the orchestrator (copilot.service.ts) never talks
 * to the raw LLM client directly — every response is schema-validated here
 * before anything downstream can treat it as trustworthy. An LLM reply that
 * doesn't fit the required {answer, reasoning, confidence} shape is rejected
 * outright rather than persisted or shown to the faculty member.
 */
export async function generateCopilotResponse(messages: ChatMessage[]): Promise<CopilotAiResponse> {
  const raw = await callLlmChatJson<unknown>(messages);
  const parsed = copilotResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      "AcadIQ Copilot returned an unsupported response and did not answer.",
      502,
      parsed.error.flatten()
    );
  }
  return parsed.data;
}

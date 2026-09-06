import { copilotRepository } from "../repositories/copilot.repository";
import { identifyIntent } from "./copilot/retrieval.service";
import { assembleContext } from "./copilot/context.service";
import { buildCopilotSystemPrompt } from "./copilot/prompt.service";
import { generateCopilotResponse } from "./copilot/response.service";
import { ChatMessage } from "../ai/llmClient";
import { auditService } from "./audit.service";
import { AppError } from "../middleware/error.middleware";
import { CopilotChatRequest } from "../validators/copilot.validator";

/**
 * Faculty question → identify intent → retrieve relevant AcadIQ data → build
 * AI context → send to LLM → return answer with explanation. Each step lives
 * in its own module under services/copilot/ — this orchestrates them and owns
 * persistence, keeping the retrieval/prompt/response layers reusable and
 * independently testable.
 */
export const copilotService = {
  async chat(userId: number, input: CopilotChatRequest) {
    let session: any;
    if (input.sessionId) {
      session = await copilotRepository.findSessionById(input.sessionId, userId);
      if (!session) {
        throw new AppError("Copilot conversation session not found", 404);
      }
    } else {
      const cleanTitle = input.message.trim().replace(/\n+/g, " ");
      const title = cleanTitle.length > 50 ? cleanTitle.slice(0, 47) + "..." : cleanTitle;

      session = await copilotRepository.createSession({
        userId,
        courseId: input.courseId,
        examId: input.examId,
        title,
      });
    }

    // 1. Identify intent
    const intent = identifyIntent(input.message);

    // 2-3. Retrieve relevant AcadIQ data + build AI context
    const context = await assembleContext(
      userId,
      session.courseId ?? input.courseId,
      input.examId ?? session.examId ?? undefined,
      input.reportId
    );

    await copilotRepository.addCopilotContext({
      sessionId: session.id,
      sourceType: context.sources.length > 0 ? "RETRIEVED_CONTEXT" : "NONE_AVAILABLE",
      content: JSON.stringify({ intent, sources: context.sources, retrievedAt: new Date().toISOString() }),
    });

    const systemPrompt = buildCopilotSystemPrompt(context, intent);
    const history = await copilotRepository.getRecentSessionMessages(session.id, 8);
    const llmMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m: { role: string; content: string }) => ({
        role: (m.role === "ASSISTANT" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: input.message },
    ];

    await copilotRepository.addChatMessage({
      sessionId: session.id,
      role: "USER",
      content: input.message,
    });

    // 4-5. Send to LLM, validate, and return an answer with explanation
    const aiResponse = await generateCopilotResponse(llmMessages);

    const savedAssistantMessage = await copilotRepository.addChatMessage({
      sessionId: session.id,
      role: "ASSISTANT",
      content: aiResponse.answer,
      aiReasoning: aiResponse.reasoning,
      confidence: aiResponse.confidence,
    });

    await copilotRepository.touchSession(session.id);

    await auditService.recordAuditLog({
      userId,
      action: "Faculty interacted with AcadIQ Copilot",
      document: `Session #${session.id}: ${session.title}`,
    });

    return {
      sessionId: session.id,
      title: session.title,
      courseId: session.courseId,
      message: savedAssistantMessage.content,
      answer: savedAssistantMessage.content,
      reasoning: aiResponse.reasoning,
      confidence: aiResponse.confidence,
      sources: context.sources,
      createdAt: savedAssistantMessage.createdAt,
    };
  },

  async getSession(userId: number, sessionId: number) {
    const session = await copilotRepository.findSessionById(sessionId, userId);
    if (!session) {
      throw new AppError("Copilot conversation session not found", 404);
    }
    return session;
  },

  async listSessions(userId: number, courseId?: number) {
    return copilotRepository.listSessions(userId, courseId);
  },

  async deleteSession(userId: number, sessionId: number) {
    const result = await copilotRepository.deleteSession(sessionId, userId);
    if (result.count === 0) {
      throw new AppError("Session not found or already deleted", 404);
    }
    return { success: true };
  },
};

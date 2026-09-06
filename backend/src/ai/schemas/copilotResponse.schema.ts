import { z } from "zod";

/**
 * Every Copilot turn must be grounded, explainable, and self-scored — never a
 * bare chat reply. `sources` is deliberately NOT part of this schema: it is
 * computed server-side from the context AcadIQ actually retrieved, rather than
 * trusted from the model's own claims, since a self-reported citation list is
 * exactly the kind of "unsupported answer" this feature exists to prevent.
 */
export const copilotResponseSchema = z.object({
  answer: z.string().trim().min(1),
  reasoning: z.string().trim().min(1),
  confidence: z.number().min(0).max(100),
});

export type CopilotAiResponse = z.infer<typeof copilotResponseSchema>;

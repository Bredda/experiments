import z from "zod";
import { agentIdSchema, eventIdSchema } from "./ids";

/**
 * What an experimenter asks for, before the engine records it as an event.
 * The recorded event is this body plus `id`, `timestamp` and `step` (see
 * `events.ts`), so the request and the fact share one definition.
 */

/** A system instruction given to one agent for the next step only. */
export const promptInjectionSchema = z.object({
	type: z.literal("intervention.prompt_injected"),
	agentId: agentIdSchema,
	content: z.string().trim().min(1).max(2000),
});
export type PromptInjection = z.infer<typeof promptInjectionSchema>;

/**
 * An event removed from one agent's view from the next step on. Memory has no
 * state to edit, so this is a fact that the view honors, not a mutation.
 */
export const memoryRedactionSchema = z.object({
	type: z.literal("intervention.memory_redacted"),
	agentId: agentIdSchema,
	targetEventId: eventIdSchema,
});
export type MemoryRedaction = z.infer<typeof memoryRedactionSchema>;

export const interventionSchema = z.discriminatedUnion("type", [
	promptInjectionSchema,
	memoryRedactionSchema,
]);
export type Intervention = z.infer<typeof interventionSchema>;

/** Most interventions one step or one fork may carry. */
export const MAX_INTERVENTIONS = 20;

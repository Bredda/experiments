import z from "zod";
import { actionSchema, modelCallSchema, promptSchema } from "./actions";
import { agentIdSchema, eventIdSchema, roomIdSchema } from "./ids";
import { memoryRedactionSchema, promptInjectionSchema } from "./interventions";
import { stepSchema, timeSchema } from "./primitives";

export const eventSchema = z.object({
	id: eventIdSchema,
	timestamp: timeSchema,
	step: stepSchema,
});

export const agentJoinedSchema = eventSchema.extend({
	agentId: agentIdSchema,
	roomId: roomIdSchema,
	type: z.literal("agent.joined"),
});
export type AgentJoined = z.infer<typeof agentJoinedSchema>;

export const messagePublishedSchema = eventSchema.extend({
	agentId: agentIdSchema,
	roomId: roomIdSchema,
	content: z.string(),
	type: z.literal("message.published"),
});
export type MessagePublished = z.infer<typeof messagePublishedSchema>;

export const actionProposedSchema = eventSchema.extend({
	agentId: agentIdSchema,
	action: actionSchema,
	type: z.literal("action.proposed"),
});
export type ActionProposed = z.infer<typeof actionProposedSchema>;

export const actionSelectedSchema = eventSchema.extend({
	agentId: agentIdSchema,
	action: actionSchema,
	type: z.literal("action.selected"),
});
export type ActionSelected = z.infer<typeof actionSelectedSchema>;

export const agentPromptBuiltSchema = eventSchema.extend({
	agentId: agentIdSchema,
	prompt: promptSchema,
	// The model call behind the prompt, when the agent reports it. Absent on
	// events recorded before it existed and for agents that call no model.
	model: modelCallSchema.shape.model.optional(),
	usage: modelCallSchema.shape.usage,
	type: z.literal("agent.prompt_built"),
});
export type AgentPromptBuilt = z.infer<typeof agentPromptBuiltSchema>;

// Interventions are facts recorded between two steps: `step` is the step they
// follow, and they take effect from the next one.
export const interventionPromptInjectedSchema = eventSchema.extend(
	promptInjectionSchema.shape,
);
export type InterventionPromptInjected = z.infer<
	typeof interventionPromptInjectedSchema
>;

export const interventionMemoryRedactedSchema = eventSchema.extend(
	memoryRedactionSchema.shape,
);
export type InterventionMemoryRedacted = z.infer<
	typeof interventionMemoryRedactedSchema
>;

export const anyEventSchema = z.discriminatedUnion("type", [
	agentJoinedSchema,
	messagePublishedSchema,
	actionProposedSchema,
	actionSelectedSchema,
	agentPromptBuiltSchema,
	interventionPromptInjectedSchema,
	interventionMemoryRedactedSchema,
]);
export type AnyEvent = z.infer<typeof anyEventSchema>;

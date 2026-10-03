import z from "zod";
import { actionSchema, promptSchema } from "./actions";
import { agentIdSchema, eventIdSchema, roomIdSchema } from "./ids";
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
	type: z.literal("agent.prompt_built"),
});
export type AgentPromptBuilt = z.infer<typeof agentPromptBuiltSchema>;

export const anyEventSchema = z.discriminatedUnion("type", [
	agentJoinedSchema,
	messagePublishedSchema,
	actionProposedSchema,
	actionSelectedSchema,
	agentPromptBuiltSchema,
]);
export type AnyEvent = z.infer<typeof anyEventSchema>;

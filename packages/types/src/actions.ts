import z from "zod";
import { agentIdSchema, roomIdSchema } from "./ids";

export const speakSchema = z.object({
	agentId: agentIdSchema,
	roomId: roomIdSchema,
	content: z.string(),
	urgency: z.number().default(0.5),
	relevance: z.number().default(0.5),
	socialCost: z.number().default(0),
	type: z.literal("speak").default("speak"),
	reasoning: z.string().optional(),
});
export type Speak = z.infer<typeof speakSchema>;

export function speakScore(speak: Speak): number {
	return speak.urgency + speak.relevance - speak.socialCost;
}

export function speak(
	params: Omit<z.input<typeof speakSchema>, "type">,
): Speak {
	return speakSchema.parse({ ...params, type: "speak" });
}

export const staySilentSchema = z.object({
	agentId: agentIdSchema,
	reasoning: z.string().optional(),
	type: z.literal("stay_silent").default("stay_silent"),
});
export type StaySilent = z.infer<typeof staySilentSchema>;

export function staySilent(
	params: Omit<z.input<typeof staySilentSchema>, "type">,
): StaySilent {
	return staySilentSchema.parse({ ...params, type: "stay_silent" });
}

export const actionSchema = z.discriminatedUnion("type", [
	speakSchema,
	staySilentSchema,
]);
export type Action = z.infer<typeof actionSchema>;

export const promptSchema = z.array(
	z.object({ role: z.string(), content: z.string() }),
);
export type Prompt = z.infer<typeof promptSchema>;

export const tokenUsageSchema = z.object({
	inputTokens: z.number().int().gte(0),
	outputTokens: z.number().int().gte(0),
});
export type TokenUsage = z.infer<typeof tokenUsageSchema>;

/** What a model-backed agent knows about the call behind its proposal. */
export const modelCallSchema = z.object({
	model: z.string(),
	usage: tokenUsageSchema.optional(),
});
export type ModelCall = z.infer<typeof modelCallSchema>;

export const actionProposalSchema = z.object({
	action: actionSchema,
	confidence: z.number().gte(0).default(1.0),
	prompt: promptSchema.optional(),
	meta: modelCallSchema.optional(),
});
export type ActionProposal = z.infer<typeof actionProposalSchema>;

export function actionProposal(
	params: z.input<typeof actionProposalSchema>,
): ActionProposal {
	return actionProposalSchema.parse(params);
}

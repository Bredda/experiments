import z from "zod";
import { memoryTypeSchema } from "./memory";

export const AGENT_BEHAVIORS = ["mentioned", "silent", "llm"] as const;
export const agentBehaviorSchema = z.enum(AGENT_BEHAVIORS);
export type AgentBehavior = (typeof AGENT_BEHAVIORS)[number];

/** Models an `llm` agent can run on. */
export const AGENT_MODELS = [
	"claude-haiku-4-5-20251001",
	"claude-sonnet-5-5",
	"claude-opus-5-5",
] as const;
export const agentModelSchema = z.enum(AGENT_MODELS);
export type AgentModel = (typeof AGENT_MODELS)[number];
/** The model of an `llm` agent that does not name one. */
export const DEFAULT_AGENT_MODEL: AgentModel = AGENT_MODELS[0];

export const agentConfigSchema = z
	.object({
		id: z.string(),
		behavior: agentBehaviorSchema,
		memory: memoryTypeSchema.optional(),
		persona: z.string().trim().min(1).optional(),
		model: agentModelSchema.optional(),
	})
	.strict()
	.check((ctx) => {
		const agent = ctx.value;

		// Only the llm behavior reads them: elsewhere they would be silently ignored.
		for (const field of ["persona", "model"] as const) {
			if (agent[field] !== undefined && agent.behavior !== "llm") {
				ctx.issues.push({
					code: "custom",
					input: agent,
					path: [field],
					message: `Agent '${agent.id}': '${field}' is only valid for the 'llm' behavior`,
				});
			}
		}
	});
export type AgentConfig = z.infer<typeof agentConfigSchema>;

export const roomConfigSchema = z
	.object({
		id: z.string(),
		members: z.array(z.string()).default([]),
	})
	.strict();
export type RoomConfig = z.infer<typeof roomConfigSchema>;

export const schedulerTypeSchema = z.enum([
	"highest_urgency",
	"weighted_random",
]);
export type SchedulerType = z.infer<typeof schedulerTypeSchema>;
export const schedulerConfigSchema = z
	.object({
		type: schedulerTypeSchema,
	})
	.strict();
export type SchedulerConfig = z.infer<typeof schedulerConfigSchema>;

export const SEED_PATTERN = /^[0-9A-Z]+$/;

export const seedSchema = z.string().regex(SEED_PATTERN, {
	error: "Seed must be strictly alphanumerical: 0-9, A-Z",
});
export type SeedType = z.infer<typeof seedSchema>;

export const scenarioConfigSchema = z
	.object({
		name: z.string(),
		seed: seedSchema,
		agents: z.array(agentConfigSchema),
		rooms: z.array(roomConfigSchema),
		scheduler: schedulerConfigSchema,
		steps: z.number().int().gte(0).default(10),
	})
	.strict()
	.check((ctx) => {
		const scenario = ctx.value;
		const agentIds = new Set(scenario.agents.map((agent) => agent.id));

		for (const room of scenario.rooms) {
			const unknownMembers = room.members.filter(
				(member) => !agentIds.has(member),
			);

			if (unknownMembers.length > 0) {
				ctx.issues.push({
					code: "custom",
					input: scenario,
					message: `Room '${room.id}' references unknown agents: ${unknownMembers.sort().join(", ")}`,
				});
			}
		}
	});
export type ScenarioConfig = z.infer<typeof scenarioConfigSchema>;

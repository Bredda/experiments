import {
	MEMORY_KINDS,
	type MemoryType,
	memoryTypeSchema,
} from "@experiments/types";
import {
	AGENT_BEHAVIORS,
	type AgentBehavior,
	type AgentModel,
	agentBehaviorSchema,
	agentModelSchema,
	DEFAULT_AGENT_MODEL,
	type SchedulerType,
	schedulerTypeSchema,
	seedSchema,
} from "@experiments/types/scenario";
import z from "zod";

export const MAX_AGENTS = 5;

export const agentSchema = z.object({
	name: z.string().trim().min(1, "Required"),
	behavior: agentBehaviorSchema,
	memory: memoryTypeSchema,
	// Only sent to the API for llm agents; blank means the default prompt.
	persona: z.string().trim(),
	model: agentModelSchema,
});
export type Agent = z.infer<typeof agentSchema>;

/** Agent schema that also rejects names already used by other agents. */
export const makeAgentSchema = (existingNames: string[]) =>
	agentSchema.refine((agent) => !existingNames.includes(agent.name), {
		path: ["name"],
		error: "An agent with this name already exists",
	});

export const runFormSchema = z.object({
	name: z.string().min(1, "Required"),
	seed: seedSchema,
	agents: z
		.array(agentSchema)
		.min(1, "Add at least one agent")
		.max(MAX_AGENTS, `At most ${MAX_AGENTS} agents`),
	scheduler: schedulerTypeSchema,
	steps: z.number().int().gte(0),
});
export type RunFormValues = z.infer<typeof runFormSchema>;

export const newAgentDefaults = (name: string): Agent => ({
	name,
	behavior: AGENT_BEHAVIORS[0],
	memory: MEMORY_KINDS[0],
	persona: "",
	model: DEFAULT_AGENT_MODEL,
});

export const MEMORY_LABELS: Record<MemoryType, string> = {
	sliding_window: "Sliding Window",
	last_n: "Last N",
};

export const MODEL_LABELS: Record<AgentModel, string> = {
	"claude-haiku-4-5-20251001": "Claude Haiku 4.5",
	"claude-sonnet-5-5": "Claude Sonnet 5.5",
	"claude-opus-5-5": "Claude Opus 5.5",
};

export const SCHEDULER_LABELS: Record<SchedulerType, string> = {
	highest_urgency: "Highest urgency",
	weighted_random: "Weighted random",
};

export const BEHAVIOR_LABELS: Record<AgentBehavior, string> = {
	mentioned: "Mentioned",
	silent: "Silent",
	llm: "LLM",
};

import {
	MEMORY_KINDS,
	type MemoryType,
	memoryTypeSchema,
} from "@experiments/types";
import {
	AGENT_BEHAVIORS,
	type AgentBehavior,
	agentBehaviorSchema,
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
});

export const MEMORY_LABELS: Record<MemoryType, string> = {
	sliding_window: "Sliding Window",
};

export const SCHEDULER_LABELS: Record<SchedulerType, string> = {
	highest_urgency: "Highest urgency",
	weighted_random: "Weighted random",
};

export const BEHAVIOR_LABELS: Record<AgentBehavior, string> = {
	mentioned: "Mentioned",
	silent: "Silent",
};

import z from "zod";
import { anyEventSchema } from "./events";
import { runIdSchema } from "./ids";
import { timeSchema } from "./primitives";
import { SEED_PATTERN, scenarioConfigSchema } from "./scenario";

export const runStatusSchema = z.enum(["created", "running", "completed"]);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const runRecordSchema = z.object({
	runId: runIdSchema,
	name: z.string(),
	seed: z.string().regex(SEED_PATTERN),
	status: runStatusSchema,
	scenario: scenarioConfigSchema,
	createdAt: timeSchema,
});
export type RunRecord = z.infer<typeof runRecordSchema>;

export const eventRecordSchema = z.object({
	id: z.number().int(),
	runId: runIdSchema,
	step: z.number().int().gte(0),
	type: z.string(),
	payload: anyEventSchema,
	timestamp: timeSchema,
});
export type EventRecord = z.infer<typeof eventRecordSchema>;

/** Outcome of advancing a run by one step: the run as it is now, and what the step added. */
export const stepResultSchema = z.object({
	run: runRecordSchema,
	events: z.array(eventRecordSchema),
});
export type StepResult = z.infer<typeof stepResultSchema>;

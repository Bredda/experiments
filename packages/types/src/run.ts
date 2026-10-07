import z from "zod";
import { anyEventSchema } from "./events";
import { runIdSchema } from "./ids";
import { interventionSchema, MAX_INTERVENTIONS } from "./interventions";
import { timeSchema } from "./primitives";
import { SEED_PATTERN, scenarioConfigSchema } from "./scenario";

export const runStatusSchema = z.enum(["created", "running", "completed"]);
export type RunStatus = z.infer<typeof runStatusSchema>;

/** Where a forked run comes from: the run it copied and the last step it copied. */
export const forkInfoSchema = z.object({
	parentRunId: runIdSchema,
	step: z.number().int().gte(0),
	purpose: z.string().nullable(),
});
export type ForkInfo = z.infer<typeof forkInfoSchema>;

export const runRecordSchema = z.object({
	runId: runIdSchema,
	name: z.string(),
	seed: z.string().regex(SEED_PATTERN),
	status: runStatusSchema,
	scenario: scenarioConfigSchema,
	/** `null` for a run that was not forked from another. */
	fork: forkInfoSchema.nullable(),
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

/** Interventions to apply, between the last played step and the next one. */
const interventionsSchema = z
	.array(interventionSchema)
	.max(MAX_INTERVENTIONS)
	.default([]);

/** Body of a request to advance a run: what to apply before the step. */
export const stepRequestSchema = z.object({
	interventions: interventionsSchema,
});
export type StepRequest = z.input<typeof stepRequestSchema>;

/** Body of a fork request: the run to fork comes from the URL. */
export const forkRunRequestSchema = z.object({
	/** Last step of the parent that the fork keeps: 0 (just the arrivals) to the latest played step. */
	step: z.number().int().gte(0),
	name: z.string().trim().min(1).max(120),
	/** Why the experimenter forks. An empty string is the same as none. */
	purpose: z
		.string()
		.trim()
		.max(500)
		.nullish()
		.transform((purpose) => purpose || null),
	/** Applied to the fork before its first step, so they take effect at `step + 1`. */
	interventions: interventionsSchema,
});
export type ForkRunRequest = z.input<typeof forkRunRequestSchema>;

/** A run in a fork tree, with what a graph needs to place and label it. */
export const forkNodeSchema = z.object({
	runId: runIdSchema,
	name: z.string(),
	status: runStatusSchema,
	/** `null` for the root of the tree. */
	parentRunId: runIdSchema.nullable(),
	/** Step of the parent the run was forked at; `null` for the root. */
	forkStep: z.number().int().gte(0).nullable(),
	purpose: z.string().nullable(),
	createdAt: timeSchema,
	/** Steps the scenario plans. */
	steps: z.number().int().gte(0),
	/** Latest step played, the copied ones included. */
	playedSteps: z.number().int().gte(0),
});
export type ForkNode = z.infer<typeof forkNodeSchema>;

/** Every run connected by forks to a given run, oldest first, with the root of the tree. */
export const forkTreeSchema = z.object({
	rootRunId: runIdSchema,
	nodes: z.array(forkNodeSchema),
});
export type ForkTree = z.infer<typeof forkTreeSchema>;

import {
	createRun,
	deleteRun,
	forkRun,
	getForkTree,
	getObservations,
	stepRun,
	updateRun,
} from "@experiments/engine";
import { observationSchema } from "@experiments/types";
import { runIdSchema } from "@experiments/types/ids";
import {
	eventRecordSchema,
	forkRunRequestSchema,
	forkTreeSchema,
	runRecordSchema,
	stepRequestSchema,
	stepResultSchema,
	updateRunRequestSchema,
} from "@experiments/types/run";
import { scenarioConfigSchema } from "@experiments/types/scenario";
import type { FastifyPluginAsync } from "fastify";
import z from "zod";

const errorResponse = {
	type: "object",
	properties: { error: { type: "string" } },
} as const;

const idParams = z
	.object({ id: runIdSchema })
	.toJSONSchema({ target: "draft-7" });

const stepParams = z
	.object({ id: runIdSchema, step: z.coerce.number().int().gte(1) })
	.toJSONSchema({ target: "draft-7" });

const runsRoutes: FastifyPluginAsync = async (app) => {
	app.get(
		"",
		{
			schema: {
				description: "Fetch all existing simulation runs",
				tags: ["runs"],
				response: {
					200: z.array(runRecordSchema).toJSONSchema(),
				},
			},
		},
		async (_request, reply) => {
			return reply.code(200).send(app.store.listRuns());
		},
	);

	app.post<{ Body: z.infer<typeof scenarioConfigSchema> }>(
		"",
		{
			schema: {
				description: "Create a run from a scenario",
				tags: ["runs"],
				body: scenarioConfigSchema.toJSONSchema({ target: "draft-7" }),
				response: {
					201: runRecordSchema.toJSONSchema(),
				},
			},
		},
		async (request, reply) => {
			const scenario = scenarioConfigSchema.parse(request.body);
			const run = createRun(app.store, scenario);
			return reply.code(201).send(run);
		},
	);

	app.get<{ Params: { id: string } }>(
		"/:id",
		{
			schema: {
				description: "Fetch a given Run by its id",
				tags: ["runs"],
				params: idParams,
				response: {
					200: runRecordSchema.toJSONSchema(),
					404: errorResponse,
				},
			},
		},
		async (request, reply) => {
			const run = app.store.getRun(runIdSchema.parse(request.params.id));
			if (run === undefined) {
				throw app.httpErrors.notFound(`Run ${request.params.id} not found`);
			}
			return reply.code(200).send(run);
		},
	);

	app.patch<{ Params: { id: string }; Body: unknown }>(
		"/:id",
		{
			schema: {
				description:
					"Rename a run, change its notes or archive it. Only the fields present change, and at least one must be. The name is also the name of the run's scenario. Nothing about the simulation changes: events, seed and status stay as they are. 404 if the run does not exist.",
				tags: ["runs"],
				params: idParams,
				body: updateRunRequestSchema.toJSONSchema({
					target: "draft-7",
					io: "input",
				}),
				response: {
					200: runRecordSchema.toJSONSchema(),
					400: errorResponse,
					404: errorResponse,
				},
			},
		},
		async (request, reply) => {
			const run = updateRun(
				app.store,
				runIdSchema.parse(request.params.id),
				updateRunRequestSchema.parse(request.body),
			);
			return reply.code(200).send(run);
		},
	);

	app.delete<{ Params: { id: string } }>(
		"/:id",
		{
			schema: {
				description:
					"Delete a run and its events. 409 while the run executes a step, and while other runs were forked from it (delete the forks first, or archive the run with PATCH). 404 if the run does not exist.",
				tags: ["runs"],
				params: idParams,
				response: {
					204: { type: "null" },
					404: errorResponse,
					409: errorResponse,
				},
			},
		},
		async (request, reply) => {
			deleteRun(app.store, runIdSchema.parse(request.params.id));
			return reply.code(204).send();
		},
	);

	app.post<{ Params: { id: string }; Body: unknown }>(
		"/:id/fork",
		{
			schema: {
				description:
					"Fork a run: create a new run that starts with a copy of this run's events up to a step (0 keeps only the arrivals), with the same scenario and seed, then diverges. The fork records its parent, the step and an optional purpose. Optional `interventions` are recorded in the fork right after the copied history and take effect at the step after `step`; the parent is never modified. 400 if an intervention cannot be applied, 404 if the run does not exist or the step was not played.",
				tags: ["runs"],
				params: idParams,
				body: forkRunRequestSchema.toJSONSchema({
					target: "draft-7",
					io: "input",
				}),
				response: {
					201: runRecordSchema.toJSONSchema(),
					400: errorResponse,
					404: errorResponse,
				},
			},
		},
		async (request, reply) => {
			const run = forkRun(
				app.store,
				runIdSchema.parse(request.params.id),
				forkRunRequestSchema.parse(request.body),
			);
			return reply.code(201).send(run);
		},
	);

	app.get<{ Params: { id: string } }>(
		"/:id/tree",
		{
			schema: {
				description:
					"The fork tree that contains a run: its ancestors, siblings and descendants, oldest first, with the id of the root. A run that was never forked and has no forks is a tree of one.",
				tags: ["runs"],
				params: idParams,
				response: {
					200: forkTreeSchema.toJSONSchema(),
					404: errorResponse,
				},
			},
		},
		async (request, reply) => {
			const tree = getForkTree(app.store, runIdSchema.parse(request.params.id));
			return reply.code(200).send(tree);
		},
	);

	app.get<{ Params: { id: string } }>(
		"/:id/events",
		{
			schema: {
				description: "Fetch all events from a given Run by its id",
				tags: ["runs"],
				params: idParams,
				response: {
					200: z.array(eventRecordSchema).toJSONSchema(),
					404: errorResponse,
				},
			},
		},
		async (request, reply) => {
			const runId = runIdSchema.parse(request.params.id);
			if (app.store.getRun(runId) === undefined) {
				throw app.httpErrors.notFound(`Run ${runId} not found`);
			}
			return reply.code(200).send(app.store.listEvents(runId));
		},
	);

	app.get<{ Params: { id: string; step: number } }>(
		"/:id/steps/:step/observations",
		{
			schema: {
				description:
					"What each agent observed when it proposed at a given step: the room history as it stood at the start of that step. 404 if the run or the step does not exist.",
				tags: ["runs"],
				params: stepParams,
				response: {
					200: z.array(observationSchema).toJSONSchema(),
					404: errorResponse,
				},
			},
		},
		async (request, reply) => {
			const observations = getObservations(
				app.store,
				runIdSchema.parse(request.params.id),
				request.params.step,
			);
			return reply.code(200).send(observations);
		},
	);

	app.post<{ Params: { id: string }; Body: unknown }>(
		"/:id/steps/next",
		{
			schema: {
				description:
					"Advance a run by one step. Returns the updated run and only the events this step added. The body is optional; when present it is `{ interventions }` (a system instruction for an llm agent, or the redaction of a message or proposal from one agent's view): they are recorded with the step, in one transaction, and take effect at this step. 400 if an intervention cannot be applied, 409 if the run is completed or already executing a step.",
				tags: ["runs"],
				params: idParams,
				// No `body` schema: Fastify rejects a request without a body when one
				// is declared, and this one is optional. Zod validates it below.
				response: {
					200: stepResultSchema.toJSONSchema(),
					400: errorResponse,
					404: errorResponse,
					409: errorResponse,
				},
			},
		},
		async (request, reply) => {
			const result = await stepRun(
				app.store,
				runIdSchema.parse(request.params.id),
				stepRequestSchema.parse(request.body ?? {}),
			);
			return reply.code(200).send(result);
		},
	);
};

export default runsRoutes;

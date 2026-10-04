import { createRun, getObservations, stepRun } from "@experiments/engine";
import { observationSchema } from "@experiments/types";
import { runIdSchema } from "@experiments/types/ids";
import {
	eventRecordSchema,
	runRecordSchema,
	stepResultSchema,
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

	app.post<{ Params: { id: string } }>(
		"/:id/steps/next",
		{
			schema: {
				description:
					"Advance a run by one step. Returns the updated run and only the events this step added. 409 if the run is completed or already executing a step.",
				tags: ["runs"],
				params: idParams,
				response: {
					200: stepResultSchema.toJSONSchema(),
					404: errorResponse,
					409: errorResponse,
				},
			},
		},
		async (request, reply) => {
			const result = await stepRun(
				app.store,
				runIdSchema.parse(request.params.id),
			);
			return reply.code(200).send(result);
		},
	);
};

export default runsRoutes;

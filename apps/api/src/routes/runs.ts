import { RunStore } from "@experiments/db";
import { createRun } from "@experiments/engine";
import { runIdSchema } from "@experiments/types/ids";
import { eventRecordSchema, runRecordSchema } from "@experiments/types/run";
import { scenarioConfigSchema } from "@experiments/types/scenario";
import type { FastifyPluginAsync } from "fastify";
import z from "zod";
import { resolvedDbPath } from "../paths.ts";

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
		async (request, reply) => {
			const store = new RunStore(resolvedDbPath);
			const runs = await store.listRuns();
			return reply.code(200).send(runs);
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
			const run = createRun(scenario, { dbPath: resolvedDbPath });
			return reply.code(201).send(run);
		},
	);

	app.get<{ Params: { id: string } }>(
		"/:id",
		{
			schema: {
				description: "Fetch a given Run by its id",
				tags: ["runs"],
				response: {
					200: runRecordSchema.toJSONSchema(),
				},
			},
		},
		async (request, reply) => {
			const { id } = request.params;
			const store = new RunStore(resolvedDbPath);
			const run = await store.getRun(runIdSchema.parse(id));
			return reply.code(200).send(run);
		},
	);
	app.get<{ Params: { id: string } }>(
		"/:id/events",
		{
			schema: {
				description: "Fetch all events from a given Run by its id",
				tags: ["runs"],
				response: {
					200: z.array(eventRecordSchema).toJSONSchema(),
				},
			},
		},
		async (request, reply) => {
			const { id } = request.params;
			const store = new RunStore(resolvedDbPath);
			const events = await store.listEvents(runIdSchema.parse(id));
			return reply.code(200).send(events);
		},
	);
};

export default runsRoutes;

import type { FastifyPluginAsync } from "fastify";

const zRoutes: FastifyPluginAsync = async (app) => {
	app.get(
		"/health",
		{
			schema: {
				description:
					"Catch-all probe. 'is the process alive and broadly working ?'",
				tags: ["health"],
				response: {
					200: {
						type: "object",
						properties: {
							status: { type: "string" },
							uptime: { type: "number" },
						},
					},
				},
			},
		},
		async (request, reply) => {
			return reply
				.code(200)
				.send({ status: "ready", uptime: process.uptime() });
		},
	);
	app.get(
		"/live",
		{
			schema: {
				description: "Liveness probe. 'Restart me if I'm not responding.'",
				tags: ["health"],
				response: {
					200: {
						type: "object",
						properties: {
							status: { type: "string" },
							uptime: { type: "number" },
						},
					},
				},
			},
		},
		async (request, reply) => {
			return reply
				.code(200)
				.send({ status: "ready", uptime: process.uptime() });
		},
	);
	app.get(
		"/ready",
		{
			schema: {
				description:
					"Readiness probe. 'I'm running but should not receive traffic right now.'",
				tags: ["health"],
				response: {
					200: {
						type: "object",
						properties: {
							status: { type: "string" },
							uptime: { type: "number" },
						},
					},
				},
			},
		},
		async (request, reply) => {
			return reply
				.code(200)
				.send({ status: "ready", uptime: process.uptime() });
		},
	);
};

export default zRoutes;

import { FastifyInstance } from "fastify";
import runsRoutes from "./runs.ts";
import zRoutes from "./z.routes.ts";

export async function registerRoutes(app: FastifyInstance) {
	await app.register(zRoutes, { prefix: "healthz" });
	await app.register(runsRoutes, { prefix: "runs" });
}

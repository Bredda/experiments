import sensible from "@fastify/sensible";
import { FastifyInstance } from "fastify";
import cors from "./cors";
import references from "./references";

export async function registerPlugins(app: FastifyInstance) {
	await app.register(cors);

	await app.register(sensible);
	//await app.register(redisPlugin);
	await app.register(references);
}

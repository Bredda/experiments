import sensible from "@fastify/sensible";
import { FastifyInstance } from "fastify";
import references from "./references";
import store from "./store";

export async function registerPlugins(app: FastifyInstance) {
	await app.register(sensible);
	//await app.register(redisPlugin);
	await app.register(references);
	await app.register(store);
}

import { env } from "@experiments/settings";
import swagger from "@fastify/swagger";
import fp from "fastify-plugin";

export default fp(
	async (app) => {
		const _host = env.API_HOST === "0.0.0.0" ? "localhost" : env.API_HOST;
		await app.register(swagger, {
			openapi: {
				openapi: "3.1.0",
				info: {
					title: "Gaiia API",
					description: "REST API exposing features for Gaiia app",
					version: "1.0.0",
				},
				servers: [{ url: `http://${_host}:${env.API_PORT}` }],
			},
		});
		await app.register(import("@scalar/fastify-api-reference"), {
			routePrefix: `/${env.API_REF_PATH}`,
		});
	},

	{ name: "references" },
);

import { env } from "@experiments/settings";
import cors from "@fastify/cors";
import fp from "fastify-plugin";

export default fp(
	async (app) => {
		app.log.debug({ origins: env.API_TRUSTED_ORIGIN }, "Allowed CORS origins");
		await app.register(cors, {
			origin: env.API_TRUSTED_ORIGIN,
			credentials: true,
		});
	},
	{ name: "cors" },
);

import { env } from "@experiments/settings";
import cors from "@fastify/cors";
import fp from "fastify-plugin";

console.log("API_TRUSTED_ORIGIN", env.API_TRUSTED_ORIGIN);
export default fp(
	async (app) => {
		await app.register(cors, {
			origin: env.API_TRUSTED_ORIGIN,
			credentials: true,
		});
	},
	{ name: "cors" },
);

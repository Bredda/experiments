import { RunStore } from "@experiments/db";
import fp from "fastify-plugin";
import { resolvedDbPath } from "../paths.ts";

declare module "fastify" {
	interface FastifyInstance {
		/** The single run store shared by all routes; closed when the app closes. */
		store: RunStore;
	}
}

export default fp(
	async (app) => {
		const store = new RunStore(resolvedDbPath);
		app.decorate("store", store);
		app.addHook("onClose", async () => store.close());
	},
	{ name: "store" },
);

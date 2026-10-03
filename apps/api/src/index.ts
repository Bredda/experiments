import "@experiments/ai"; // registers the "llm" agent behavior as a side effect
import { env } from "@experiments/settings";
import Fastify from "fastify";
import { errorHandler } from "./error-handler";
import { logger } from "./logger.ts";
import { registerPlugins } from "./plugins/index.ts";
import { registerRoutes } from "./routes/index.ts";

const app = Fastify({
	logger,
	genReqId: (req) =>
		(req.headers["x-request-id"] as string) ?? crypto.randomUUID(),
	requestIdLogLabel: "requestId",
});

app.setErrorHandler(errorHandler);

await registerPlugins(app);
await registerRoutes(app);

try {
	await app.listen({ port: env.API_PORT, host: env.API_HOST });
} catch (err) {
	app.log.error(err);
	process.exit(1);
}

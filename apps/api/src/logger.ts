import { env } from "@experiments/settings";
export const logger = {
	transport:
		env.ENV !== "production"
			? { target: "pino-pretty", options: { colorize: true } }
			: undefined,
	level: env.DEBUG ? "debug" : "info",
	timestamp: () => `,"time":"${new Date().toISOString()}"`,
	redact: {
		paths: ["req.headers.authorization", "req.headers.cookie", "body.password"],
		censor: "[REDACTED]",
	},
};

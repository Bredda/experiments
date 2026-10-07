import { z } from "zod";

export const configSchema = z.object({
	ENV: z.enum(["development", "production"]).default("development"),
	DEBUG: z.coerce.boolean().default(true),
	API_HOST: z.string().default("127.0.0.1"),
	API_REF_PATH: z.string().default("reference"),
	API_PORT: z
		.string()
		.default("8080")
		.transform((value) => Number(value)),
	API_TRUSTED_ORIGIN: z
		.string()
		.default(
			"http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:8080,http://localhost:8080",
		)
		.transform((value) => value.split(",")),
	DB_PATH: z.string().default("./simulation.db"),
	ANTHROPIC_API_KEY: z.string().regex(/^sk-ant-/, "Invalid Anthropic API key"),
});

export type Config = z.infer<typeof configSchema>;

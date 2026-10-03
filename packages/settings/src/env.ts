import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { type Config, configSchema } from "./schema";

loadDotenv({ path: path.resolve(import.meta.dirname, "../../../.env") });

export const env: Config = configSchema.parse(process.env);

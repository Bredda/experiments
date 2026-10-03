import { resolve } from "node:path";
import { env } from "@experiments/settings";

const monorepoRoot = resolve(import.meta.dirname, "../../../");

const resolvedDbPath = resolve(monorepoRoot, env.DB_PATH);
console.log("Db path:", resolvedDbPath);

export { resolvedDbPath };

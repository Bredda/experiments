import { readFileSync } from "node:fs";
import {
	type ScenarioConfig,
	scenarioConfigSchema,
} from "@experiments/types/scenario";
import { parse } from "yaml";

export function loadScenario(path: string): ScenarioConfig {
	const contents = readFileSync(path, "utf-8");
	const data = parse(contents);
	return scenarioConfigSchema.parse(data);
}

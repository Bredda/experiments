import { resolve } from "node:path";
import { env } from "@experiments/settings";
import { monorepoRoot } from "./paths";
import { createRun, loadScenario } from "./scenario";

export * from "./agents";
export { SimulationClock } from "./clock";
export { EventLog } from "./eventLog";
export * from "./memory";
export { Registry } from "./registry";
export { SeededRandom } from "./rng";
export { Room } from "./room";
export { RunConfig } from "./runConfig";
export * from "./scenario";
export * from "./scheduler";
export { Simulation } from "./simulation";

export async function run(
	argv: string[] = process.argv.slice(2),
): Promise<number> {
	const [command, scenarioArg] = argv;

	if (argv.length !== 2 || command !== "run" || !scenarioArg) {
		console.log("Usage: engine run <scenario.yaml>");
		return 1;
	}

	const scenarioPath = resolve(
		monorepoRoot,
		env.SCENARIOS_DIRECTORY,
		scenarioArg,
	);

	const scenario = loadScenario(scenarioPath);
	const created = createRun(scenario);

	console.log(`Run created: ${created.runId}`);

	return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	run().then((code) => process.exit(code));
}

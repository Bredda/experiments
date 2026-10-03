import { resolve } from "node:path";
import { RunStore } from "@experiments/db";
import { env } from "@experiments/settings";
import type { RunRecord } from "@experiments/types/run";
import type { ScenarioConfig } from "@experiments/types/scenario";
import { monorepoRoot } from "../paths";
import { buildRun } from "./factory";

/**
 * Creates and persists a run from a scenario, running its initial setup
 * (e.g. agents joining the room) but not stepping it forward. Advancing the
 * simulation is a separate, explicit action (step-by-step execution).
 */
export function createRun(
	scenario: ScenarioConfig,
	options?: { dbPath?: string },
): RunRecord {
	const dbPath = resolve(monorepoRoot, options?.dbPath ?? env.DB_PATH);

	const store = new RunStore(dbPath);

	try {
		if (scenario.rooms.length !== 1) {
			throw new Error(
				"The current simulation engine supports exactly one room",
			);
		}

		const { runId, simulation } = buildRun(scenario);

		const run = store.createRun({
			runId,
			name: scenario.name,
			seed: scenario.seed,
			scenario,
		});

		simulation.setup(store);

		return run;
	} finally {
		store.close();
	}
}

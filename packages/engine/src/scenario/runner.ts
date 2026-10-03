import { resolve } from "node:path";
import { RunStore } from "@experiments/db";
import { env } from "@experiments/settings";
import type { RunId } from "@experiments/types/ids";
import type { EventRecord, RunRecord } from "@experiments/types/run";
import type { ScenarioConfig } from "@experiments/types/scenario";
import { RunBusyError, RunCompletedError } from "../errors";
import { monorepoRoot } from "../paths";
import { buildRun, loadSimulation } from "./factory";

/**
 * Creates and persists a run from a scenario, running its initial setup
 * (e.g. agents joining the room) but not stepping it forward. Advancing the
 * simulation is a separate, explicit action: see `stepRun`.
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

		const { runId, simulation } = buildRun(scenario, { store });

		const run = store.createRun({
			runId,
			name: scenario.name,
			seed: scenario.seed,
			scenario,
		});

		simulation.setup();

		return run;
	} finally {
		store.close();
	}
}

// One step at a time per run: LLM-backed steps are slow enough for a second
// request to arrive while the first is still running.
const stepping = new Set<RunId>();

/**
 * Advances a run by one step and returns the updated run with only the events
 * that step added. The simulation is rebuilt from the store each time, so no
 * state is kept in the process between steps.
 */
export async function stepRun(
	store: RunStore,
	runId: RunId,
): Promise<{ run: RunRecord; events: EventRecord[] }> {
	if (stepping.has(runId)) {
		throw new RunBusyError(runId);
	}

	stepping.add(runId);

	try {
		const { run, simulation, lastEventId } = loadSimulation(store, runId);
		const totalSteps = run.scenario.steps;

		if (simulation.clock.step >= totalSteps) {
			if (run.status !== "completed") {
				store.updateRunStatus(runId, "completed");
			}
			throw new RunCompletedError(runId);
		}

		await simulation.step();

		// Status is derived from where the simulation is, not from the previous
		// status, so a run left stale by a crash fixes itself on the next step.
		store.updateRunStatus(
			runId,
			simulation.clock.step >= totalSteps ? "completed" : "running",
		);

		return {
			// Safe: loadSimulation just found this run.
			run: store.getRun(runId) as RunRecord,
			events: store.listEvents(runId, lastEventId),
		};
	} finally {
		stepping.delete(runId);
	}
}

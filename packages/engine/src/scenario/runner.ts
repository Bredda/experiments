import type { RunStore } from "@experiments/db";
import type { Observation } from "@experiments/types";
import { newRunId, type RunId } from "@experiments/types/ids";
import type {
	EventRecord,
	ForkTree,
	RunRecord,
	RunStatus,
} from "@experiments/types/run";
import type { ScenarioConfig } from "@experiments/types/scenario";
import {
	RunBusyError,
	RunCompletedError,
	RunNotFoundError,
	StepNotFoundError,
} from "../errors";
import { buildRun, loadSimulation } from "./factory";

/**
 * Creates and persists a run from a scenario, running its initial setup
 * (e.g. agents joining the room) but not stepping it forward. Advancing the
 * simulation is a separate, explicit action: see `stepRun`.
 */
export function createRun(
	store: RunStore,
	scenario: ScenarioConfig,
): RunRecord {
	if (scenario.rooms.length !== 1) {
		throw new Error("The current simulation engine supports exactly one room");
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
}

/**
 * Creates a run that starts with a copy of the parent's history up to `step`
 * (0 keeps only the arrivals) and then diverges: it has the parent's scenario
 * and seed, so it is stepped like any other run. The parent is not touched.
 * With deterministic agents the fork carries on exactly like its parent; with
 * LLM agents it is a new sample from `step` on.
 */
export function forkRun(
	store: RunStore,
	runId: RunId,
	options: { step: number; name: string; purpose?: string | null },
): RunRecord {
	const parent = store.getRun(runId);

	if (parent === undefined) {
		throw new RunNotFoundError(runId);
	}

	// Events are stored in order, so the last one is at the latest step played.
	const playedSteps = store.listEvents(runId).at(-1)?.step ?? 0;

	if (
		!Number.isInteger(options.step) ||
		options.step < 0 ||
		options.step > playedSteps
	) {
		throw new StepNotFoundError(runId, options.step);
	}

	// Same derivation as stepRun: the status follows where the clock is.
	const status: RunStatus =
		options.step >= parent.scenario.steps
			? "completed"
			: options.step === 0
				? "created"
				: "running";

	return store.createFork({
		runId: newRunId(),
		parentRunId: runId,
		step: options.step,
		purpose: options.purpose ?? null,
		name: options.name,
		seed: parent.seed,
		scenario: { ...parent.scenario, name: options.name },
		status,
	});
}

/**
 * The fork tree that contains a run: its ancestors, siblings and descendants,
 * with the root.
 */
export function getForkTree(store: RunStore, runId: RunId): ForkTree {
	const tree = store.getForkTree(runId);

	if (tree === undefined) {
		throw new RunNotFoundError(runId);
	}

	return tree;
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

/**
 * What every agent observed when it proposed at `step` (1 to the last step
 * played). Read-only: nothing is stepped or persisted.
 */
export function getObservations(
	store: RunStore,
	runId: RunId,
	step: number,
): Observation[] {
	const { simulation } = loadSimulation(store, runId);
	return simulation.observationsAt(step);
}

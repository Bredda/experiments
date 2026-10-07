import type { Observation } from "@experiments/types";
import type { AnyEvent } from "@experiments/types/events";
import type { Intervention } from "@experiments/types/interventions";
import type {
	EventRecord,
	ForkRunRequest,
	ForkTree,
	RunRecord,
	StepResult,
} from "@experiments/types/run";
import type { ScenarioConfig } from "@experiments/types/scenario";
import { apiFetch } from "./fetch";

export async function getRuns(): Promise<RunRecord[]> {
	return await apiFetch<RunRecord[]>(`runs`, {
		cache: "no-store",
	});
}

export async function createRun(scenario: ScenarioConfig): Promise<RunRecord> {
	return await apiFetch<RunRecord>(`runs`, {
		method: "POST",
		body: JSON.stringify(scenario),
	});
}

export async function getRun(runId: string): Promise<RunRecord> {
	return await apiFetch<RunRecord>(`runs/${runId}`, {
		cache: "no-store",
	});
}

export async function getRunEvents(runId: string): Promise<AnyEvent[]> {
	const records = await apiFetch<EventRecord[]>(`runs/${runId}/events`, {
		cache: "no-store",
	});
	return records.map((r) => r.payload);
}

/**
 * Advances the run by one step; resolves with the updated run and the events
 * the step added. `interventions` are recorded with the step and take effect
 * at it; with none, the request has no body.
 */
export async function stepRun(
	runId: string,
	interventions: readonly Intervention[] = [],
): Promise<StepResult> {
	return await apiFetch<StepResult>(`runs/${runId}/steps/next`, {
		method: "POST",
		body:
			interventions.length > 0 ? JSON.stringify({ interventions }) : undefined,
	});
}

/** What each agent observed when it proposed at `step` (1 to the last step played). */
export async function getStepObservations(
	runId: string,
	step: number,
): Promise<Observation[]> {
	return await apiFetch<Observation[]>(
		`runs/${runId}/steps/${step}/observations`,
		{ cache: "no-store" },
	);
}

/** Forks a run at `request.step`: the new run starts with a copy of the history up to there. */
export async function forkRun(
	runId: string,
	request: ForkRunRequest,
): Promise<RunRecord> {
	return await apiFetch<RunRecord>(`runs/${runId}/fork`, {
		method: "POST",
		body: JSON.stringify(request),
	});
}

/** Every run connected by forks to this one: ancestors, siblings and descendants. */
export async function getForkTree(runId: string): Promise<ForkTree> {
	return await apiFetch<ForkTree>(`runs/${runId}/tree`, {
		cache: "no-store",
	});
}

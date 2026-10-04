import type { Observation } from "@experiments/types";
import type { AnyEvent } from "@experiments/types/events";
import type {
	EventRecord,
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

/** Advances the run by one step; resolves with the updated run and the events the step added. */
export async function stepRun(runId: string): Promise<StepResult> {
	return await apiFetch<StepResult>(`runs/${runId}/steps/next`, {
		method: "POST",
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

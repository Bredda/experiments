import type { AnyEvent } from "@experiments/types/events";
import type { EventRecord, RunRecord } from "@experiments/types/run";
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

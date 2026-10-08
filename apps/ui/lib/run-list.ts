import type { RunRecord } from "@experiments/types/run";

/** How many runs of the list were forked directly from each run (runs with none are absent). */
export function forkCounts(runs: readonly RunRecord[]): Map<string, number> {
	const counts = new Map<string, number>();

	for (const run of runs) {
		if (run.fork !== null) {
			counts.set(
				run.fork.parentRunId,
				(counts.get(run.fork.parentRunId) ?? 0) + 1,
			);
		}
	}

	return counts;
}

/** Whether the run answers a search: its name, id or notes contain the text. */
export function matchesRunQuery(run: RunRecord, query: string): boolean {
	const text = query.trim().toLowerCase();

	return (
		text === "" ||
		run.name.toLowerCase().includes(text) ||
		run.runId.toLowerCase().includes(text) ||
		run.notes.toLowerCase().includes(text)
	);
}

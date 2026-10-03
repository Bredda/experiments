import type { Candidate } from "@experiments/types/scheduler";
import type { SeededRandom } from "../rng";

export function candidateUrgency(candidate: Candidate): number {
	return candidate.action.type === "speak" ? candidate.action.urgency : 0;
}

export abstract class Scheduler {
	abstract select(
		candidates: readonly Candidate[],
		rng: SeededRandom,
	): Candidate;
}

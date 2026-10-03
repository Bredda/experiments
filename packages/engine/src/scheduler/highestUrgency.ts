import type { Candidate } from "@experiments/types/scheduler";
import type { SeededRandom } from "../rng";
import { candidateUrgency, Scheduler } from "./base";

export class HighestUrgencyScheduler extends Scheduler {
	select(candidates: readonly Candidate[], _rng: SeededRandom): Candidate {
		if (candidates.length === 0) {
			throw new Error("No candidates");
		}

		return candidates.reduce((best, candidate) =>
			candidateUrgency(candidate) > candidateUrgency(best) ? candidate : best,
		);
	}
}

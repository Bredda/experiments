import type { Candidate } from "@experiments/types/scheduler";
import type { SeededRandom } from "../rng";
import { candidateUrgency, Scheduler } from "./base";

export class WeightedRandomScheduler extends Scheduler {
	select(candidates: readonly Candidate[], rng: SeededRandom): Candidate {
		if (candidates.length === 0) {
			throw new Error("No candidates");
		}

		const weights = candidates.map((candidate) =>
			Math.max(0, candidateUrgency(candidate)),
		);
		const total = weights.reduce((sum, weight) => sum + weight, 0);

		if (total <= 0) {
			return rng.choice(candidates);
		}

		return rng.weightedChoice(candidates, weights);
	}
}

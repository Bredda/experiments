import type { RunId } from "@experiments/types/ids";
import { SeededRandom } from "./rng";

export class RunConfig {
	readonly runId: RunId;
	readonly seed: string;

	constructor(params: { runId: RunId; seed?: string }) {
		this.runId = params.runId;
		this.seed = params.seed ?? "42";
		// Fail fast on an invalid seed instead of at the first step.
		new SeededRandom(this.seed);
	}

	/**
	 * Randomness for one step. Derived from (seed, step) rather than consumed
	 * sequentially, so a step behaves the same whether the simulation ran
	 * continuously or was rebuilt from storage right before it.
	 */
	rngForStep(step: number): SeededRandom {
		return new SeededRandom(this.seed, step);
	}
}

import type { RunId } from "@experiments/types/ids";
import { SeededRandom } from "./rng";

export class RunConfig {
	readonly runId: RunId;
	readonly seed: string;
	readonly rng: SeededRandom;

	constructor(params: { runId: RunId; seed?: string }) {
		this.runId = params.runId;
		this.seed = params.seed ?? "42";
		this.rng = new SeededRandom(this.seed);
	}
}

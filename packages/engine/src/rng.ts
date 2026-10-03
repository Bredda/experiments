import { SEED_PATTERN } from "@experiments/types/scenario";

/** xmur3 string hash → 32-bit unsigned int (same author as mulberry32). */
function hashSeed(seed: string): number {
	let h = 1779033703 ^ seed.length;
	for (let i = 0; i < seed.length; i++) {
		h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
		h = (h << 13) | (h >>> 19);
	}
	h = Math.imul(h ^ (h >>> 16), 2246822507);
	h = Math.imul(h ^ (h >>> 13), 3266489909);
	return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Small seeded PRNG (mulberry32) so simulation runs are reproducible from a
 * seed, mirroring Python's `random.Random(seed)`.
 */
export class SeededRandom {
	#state: number;

	/**
	 * `stream` derives an independent sequence from the same seed (for example
	 * one per simulation step), so a stream can be recreated without replaying
	 * the draws that came before it.
	 */
	constructor(seed: string, stream?: number) {
		if (!SEED_PATTERN.test(seed)) {
			throw new Error(`Invalid seed "${seed}": expected only 0-9 and A-Z`);
		}
		this.#state = hashSeed(stream === undefined ? seed : `${seed}:${stream}`);
	}

	random(): number {
		this.#state |= 0;
		this.#state = (this.#state + 0x6d2b79f5) | 0;
		let t = this.#state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	choice<T>(items: readonly T[]): T {
		if (items.length === 0) {
			throw new Error("Cannot choose from an empty sequence");
		}
		const index = Math.floor(this.random() * items.length);
		return items[Math.min(index, items.length - 1)] as T;
	}

	/** Picks a single weighted item, mirroring Python's `random.choices(items, weights=weights, k=1)[0]`. */
	weightedChoice<T>(items: readonly T[], weights: readonly number[]): T {
		if (items.length === 0) {
			throw new Error("Cannot choose from an empty sequence");
		}

		const total = weights.reduce((sum, weight) => sum + weight, 0);
		let target = this.random() * total;

		for (let i = 0; i < items.length; i++) {
			target -= weights[i] as number;
			if (target < 0) {
				return items[i] as T;
			}
		}

		return items[items.length - 1] as T;
	}
}

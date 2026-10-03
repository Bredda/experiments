import { describe, expect, it } from "vitest";
import { SeededRandom } from "./rng";

function draws(rng: SeededRandom, count = 5) {
	return Array.from({ length: count }, () => rng.random());
}

describe("SeededRandom", () => {
	it("repeats the same sequence for the same seed", () => {
		expect(draws(new SeededRandom("ABC123"))).toEqual(
			draws(new SeededRandom("ABC123")),
		);
	});

	it("derives an independent, reproducible stream per step", () => {
		const step1 = draws(new SeededRandom("ABC123", 1));

		expect(draws(new SeededRandom("ABC123", 1))).toEqual(step1);
		expect(draws(new SeededRandom("ABC123", 2))).not.toEqual(step1);
		expect(draws(new SeededRandom("ABC123"))).not.toEqual(step1);
	});

	it("rejects seeds outside 0-9 A-Z", () => {
		expect(() => new SeededRandom("abc")).toThrow(/Invalid seed/);
	});
});

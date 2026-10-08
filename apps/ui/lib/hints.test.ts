import { describe, expect, it } from "vitest";
import { parseSeenHints, serializeSeenHints } from "./hints";

describe("parseSeenHints", () => {
	it("reads what serializeSeenHints wrote", () => {
		const seen = new Set(["b", "a"]);

		expect(parseSeenHints(serializeSeenHints(seen))).toEqual(seen);
	});

	it("sees nothing without a stored value", () => {
		expect(parseSeenHints(null).size).toBe(0);
	});

	it("ignores a value that is not a list of ids", () => {
		for (const raw of ["not json", '{"a":1}', "42", "null"]) {
			expect(parseSeenHints(raw).size).toBe(0);
		}
		expect(parseSeenHints('["a", 1, null, "b"]')).toEqual(new Set(["a", "b"]));
	});
});

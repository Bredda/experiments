import { describe, expect, it } from "vitest";
import { upstreamUrl } from "./proxy";

describe("upstreamUrl", () => {
	it("appends the segments to the api address", () => {
		expect(upstreamUrl("http://api:8080", ["runs", "abc", "tree"])?.href).toBe(
			"http://api:8080/runs/abc/tree",
		);
	});

	it("keeps the path of the base and ignores a trailing slash", () => {
		expect(upstreamUrl("http://host/v1/", ["runs"])?.href).toBe(
			"http://host/v1/runs",
		);
	});

	it("keeps the query string", () => {
		expect(upstreamUrl("http://api:8080", ["runs"], "?a=1&b=2")?.href).toBe(
			"http://api:8080/runs?a=1&b=2",
		);
	});

	it("rejects segments that could leave the api", () => {
		for (const bad of ["..", ".", "", "a/b", "a\\b"]) {
			expect(upstreamUrl("http://api:8080", ["runs", bad])).toBeNull();
		}
	});

	it("rejects an empty path", () => {
		expect(upstreamUrl("http://api:8080", [])).toBeNull();
	});

	it("encodes what the segments hold", () => {
		expect(upstreamUrl("http://api:8080", ["runs", "a b?"])?.pathname).toBe(
			"/runs/a%20b%3F",
		);
	});
});

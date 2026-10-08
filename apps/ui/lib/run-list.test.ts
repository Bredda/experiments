import type { RunRecord } from "@experiments/types/run";
import { describe, expect, it } from "vitest";
import { forkCounts, matchesRunQuery } from "./run-list";

function run(runId: string, overrides: Partial<RunRecord> = {}): RunRecord {
	return {
		runId,
		name: runId,
		notes: "",
		archived: false,
		fork: null,
		...overrides,
	} as RunRecord;
}

const fork = (parentRunId: string) =>
	({ parentRunId, step: 1, purpose: null }) as unknown as RunRecord["fork"];

describe("forkCounts", () => {
	it("counts the direct forks of each run", () => {
		const counts = forkCounts([
			run("a"),
			run("b", { fork: fork("a") }),
			run("c", { fork: fork("a") }),
			run("d", { fork: fork("b") }),
		]);

		expect(counts.get("a")).toBe(2);
		expect(counts.get("b")).toBe(1);
		expect(counts.get("c")).toBeUndefined();
	});

	it("is empty without forks", () => {
		expect(forkCounts([run("a"), run("b")]).size).toBe(0);
	});
});

describe("matchesRunQuery", () => {
	const item = run("0a1b", {
		name: "Wide Flame",
		notes: "Scheduler A baseline",
	});

	it("matches the name, the id and the notes, ignoring case", () => {
		expect(matchesRunQuery(item, "flame")).toBe(true);
		expect(matchesRunQuery(item, "0A1B")).toBe(true);
		expect(matchesRunQuery(item, "scheduler a")).toBe(true);
	});

	it("matches everything when the search is blank", () => {
		expect(matchesRunQuery(item, "  ")).toBe(true);
	});

	it("rejects what appears nowhere", () => {
		expect(matchesRunQuery(item, "zzz")).toBe(false);
	});
});

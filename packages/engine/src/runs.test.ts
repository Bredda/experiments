import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { RunStore } from "@experiments/db";
import type { ScenarioConfig } from "@experiments/types/scenario";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RunBusyError, RunHasForksError, RunNotFoundError } from "./errors";
import { createRun, deleteRun, forkRun, stepRun, updateRun } from "./scenario";

const OLD_ID = "11111111-1111-4111-8111-111111111111";
const MISSING = "00000000-0000-4000-8000-000000000000" as never;

function scenario(): ScenarioConfig {
	return {
		name: "origin",
		seed: "ABC123",
		agents: [
			{ id: "alice", behavior: "mentioned" },
			{ id: "bob", behavior: "mentioned" },
		],
		rooms: [{ id: "main", members: ["alice", "bob"] }],
		scheduler: { type: "weighted_random" },
		steps: 6,
	};
}

let dir: string;
let store: RunStore;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "experiments-runs-"));
	store = new RunStore(join(dir, "test.db"));
});

afterEach(() => {
	store.close();
	rmSync(dir, { recursive: true, force: true });
});

describe("updateRun", () => {
	it("starts a run without notes, not archived", () => {
		const run = createRun(store, scenario());

		expect(run).toMatchObject({ notes: "", archived: false });
		expect(store.getRun(run.runId)).toMatchObject({
			notes: "",
			archived: false,
		});
	});

	it("renames the run and its scenario together", () => {
		const run = createRun(store, scenario());

		const updated = updateRun(store, run.runId, { name: "baseline" });

		expect(updated.name).toBe("baseline");
		expect(updated.scenario.name).toBe("baseline");
		expect(store.getRun(run.runId)?.scenario.name).toBe("baseline");
		expect(store.listRuns().map((r) => r.name)).toEqual(["baseline"]);
	});

	it("changes only the fields it is given", () => {
		const run = createRun(store, scenario());

		updateRun(store, run.runId, { notes: "scheduler A" });
		updateRun(store, run.runId, { archived: true });

		expect(store.getRun(run.runId)).toMatchObject({
			name: "origin",
			notes: "scheduler A",
			archived: true,
		});

		updateRun(store, run.runId, { archived: false });

		expect(store.getRun(run.runId)).toMatchObject({
			notes: "scheduler A",
			archived: false,
		});
	});

	it("does not touch the events or the status", async () => {
		const run = createRun(store, scenario());
		await stepRun(store, run.runId);
		const events = store.listEvents(run.runId);

		updateRun(store, run.runId, { name: "x", notes: "y", archived: true });

		expect(store.listEvents(run.runId)).toEqual(events);
		expect(store.getRun(run.runId)?.status).toBe("running");
	});

	it("keeps a fork's own name, notes and archiving apart from its parent's", () => {
		const parent = createRun(store, scenario());
		const fork = forkRun(store, parent.runId, { step: 0, name: "f" });

		updateRun(store, parent.runId, { notes: "parent", archived: true });

		expect(store.getRun(fork.runId)).toMatchObject({
			name: "f",
			notes: "",
			archived: false,
		});
	});

	it("rejects an unknown run", () => {
		expect(() => updateRun(store, MISSING, { name: "x" })).toThrow(
			RunNotFoundError,
		);
		expect(store.listRuns()).toEqual([]);
	});
});

describe("deleteRun", () => {
	it("deletes a run without forks, with its events and notes", async () => {
		const run = createRun(store, scenario());
		await stepRun(store, run.runId);
		updateRun(store, run.runId, { notes: "n", archived: true });

		deleteRun(store, run.runId);

		expect(store.getRun(run.runId)).toBeUndefined();
		expect(store.listEvents(run.runId)).toEqual([]);
		expect(store.listRuns()).toEqual([]);
	});

	it("refuses a run that has forks and deletes nothing", async () => {
		const parent = createRun(store, scenario());
		await stepRun(store, parent.runId);
		forkRun(store, parent.runId, { step: 1, name: "a" });
		forkRun(store, parent.runId, { step: 1, name: "b" });
		const events = store.listEvents(parent.runId);

		expect(() => deleteRun(store, parent.runId)).toThrow(RunHasForksError);
		expect(() => deleteRun(store, parent.runId)).toThrow(/2 forks/);

		expect(store.getRun(parent.runId)).toBeDefined();
		expect(store.listEvents(parent.runId)).toEqual(events);
		expect(store.listRuns()).toHaveLength(3);
	});

	it("deletes a fork, then its parent", async () => {
		const parent = createRun(store, scenario());
		const fork = forkRun(store, parent.runId, { step: 0, name: "f" });

		deleteRun(store, fork.runId);
		deleteRun(store, parent.runId);

		expect(store.listRuns()).toEqual([]);
	});

	it("refuses a run that is executing a step", async () => {
		const run = createRun(store, scenario());

		const step = stepRun(store, run.runId);

		expect(() => deleteRun(store, run.runId)).toThrow(RunBusyError);
		await step;
		expect(store.getRun(run.runId)).toBeDefined();
	});

	it("rejects an unknown run", () => {
		expect(() => deleteRun(store, MISSING)).toThrow(RunNotFoundError);
	});
});

describe("a database created before run_meta", () => {
	it("opens, and its runs have no notes and are not archived", () => {
		const path = join(dir, "old.db");
		const old = new DatabaseSync(path);
		old.exec(`
			CREATE TABLE runs (run_id TEXT PRIMARY KEY, name TEXT NOT NULL, seed TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
			CREATE TABLE scenarios (run_id TEXT PRIMARY KEY REFERENCES runs(run_id) ON DELETE CASCADE, scenario_json TEXT NOT NULL);
		`);
		old
			.prepare("INSERT INTO runs VALUES (?, ?, ?, ?, ?)")
			.run(OLD_ID, "old run", "ABC123", "created", "2026-01-01T00:00:00.000Z");
		old
			.prepare("INSERT INTO scenarios VALUES (?, ?)")
			.run(OLD_ID, JSON.stringify({ ...scenario(), name: "old run" }));
		old.close();

		using migrated = new RunStore(path);

		expect(migrated.listRuns()).toMatchObject([
			{ runId: OLD_ID, notes: "", archived: false },
		]);
		expect(
			migrated.updateRun(OLD_ID as never, { notes: "now", archived: true }),
		).toMatchObject({ notes: "now", archived: true });
	});
});

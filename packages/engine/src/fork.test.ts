import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunStore } from "@experiments/db";
import type { AnyEvent } from "@experiments/types/events";
import type { RunId } from "@experiments/types/ids";
import type { ScenarioConfig } from "@experiments/types/scenario";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RunNotFoundError, StepNotFoundError } from "./errors";
import { createRun, forkRun, getForkTree, stepRun } from "./scenario";

function scenario(overrides: Partial<ScenarioConfig> = {}): ScenarioConfig {
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
		...overrides,
	};
}

/** Event ids are execution-specific; everything else must be reproducible. */
function normalize(events: readonly AnyEvent[]) {
	return events.map(({ id: _id, ...rest }) => rest);
}

let dir: string;
let store: RunStore;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "experiments-fork-"));
	store = new RunStore(join(dir, "test.db"));
});

afterEach(() => {
	store.close();
	rmSync(dir, { recursive: true, force: true });
});

function storedEvents(runId: RunId) {
	return store.listEvents(runId).map((record) => record.payload);
}

async function playedRun(steps: number, config: Partial<ScenarioConfig> = {}) {
	const run = createRun(store, scenario(config));
	for (let i = 0; i < steps; i++) {
		await stepRun(store, run.runId);
	}
	return run;
}

describe("forkRun", () => {
	it("starts from a copy of the parent's history up to the step, and records where it comes from", async () => {
		const parent = await playedRun(4);

		const fork = forkRun(store, parent.runId, {
			step: 2,
			name: "origin - fork #1",
			purpose: "what if",
		});

		expect(fork.runId).not.toBe(parent.runId);
		expect(fork.name).toBe("origin - fork #1");
		expect(fork.scenario.name).toBe("origin - fork #1");
		expect(fork.seed).toBe(parent.seed);
		expect(fork.status).toBe("running");
		expect(fork.fork).toEqual({
			parentRunId: parent.runId,
			step: 2,
			purpose: "what if",
		});
		expect(store.getRun(fork.runId)?.fork).toEqual(fork.fork);
		expect(parent.fork).toBeNull();

		const copied = storedEvents(fork.runId);
		expect(copied).toEqual(
			storedEvents(parent.runId).filter((e) => e.step <= 2),
		);
		expect(Math.max(...copied.map((e) => e.step))).toBe(2);
	});

	it("forks at step 0 into a fresh run that only holds the arrivals", async () => {
		const parent = await playedRun(3);

		const fork = forkRun(store, parent.runId, { step: 0, name: "again" });

		expect(fork.status).toBe("created");
		expect(fork.fork?.purpose).toBeNull();
		expect(storedEvents(fork.runId).map((e) => e.type)).toEqual([
			"agent.joined",
			"agent.joined",
		]);

		const next = await stepRun(store, fork.runId);
		expect(next.events.every((record) => record.step === 1)).toBe(true);
	});

	it("is completed when forked at the last step", async () => {
		const parent = await playedRun(2, { steps: 2 });

		const fork = forkRun(store, parent.runId, { step: 2, name: "end" });

		expect(fork.status).toBe("completed");
	});

	it("carries on like its parent with deterministic agents", async () => {
		const parent = await playedRun(6);
		const fork = forkRun(store, parent.runId, { step: 3, name: "same" });

		for (let i = 3; i < 6; i++) {
			await stepRun(store, fork.runId);
		}

		expect(store.getRun(fork.runId)?.status).toBe("completed");
		expect(normalize(storedEvents(fork.runId))).toEqual(
			normalize(storedEvents(parent.runId)),
		);
	});

	it("leaves the parent untouched, whatever happens to the fork", async () => {
		const parent = await playedRun(3);
		const before = store.listEvents(parent.runId);

		const fork = forkRun(store, parent.runId, { step: 1, name: "f" });
		await stepRun(store, fork.runId);

		expect(store.listEvents(parent.runId)).toEqual(before);
		expect(store.getRun(parent.runId)?.status).toBe("running");
	});

	it("rejects an unknown run and a step that was not played", async () => {
		const parent = await playedRun(2);

		expect(() =>
			forkRun(store, "00000000-0000-4000-8000-000000000000" as RunId, {
				step: 0,
				name: "x",
			}),
		).toThrow(RunNotFoundError);
		for (const step of [3, -1, 1.5]) {
			expect(() => forkRun(store, parent.runId, { step, name: "x" })).toThrow(
				StepNotFoundError,
			);
		}
		expect(getForkTree(store, parent.runId).nodes).toHaveLength(1);
	});
});

describe("getForkTree", () => {
	it("is the same tree from the root, a sibling or a descendant", async () => {
		const root = await playedRun(3);
		const a = forkRun(store, root.runId, { step: 1, name: "a", purpose: "pa" });
		const b = forkRun(store, root.runId, { step: 2, name: "b" });
		const c = forkRun(store, a.runId, { step: 1, name: "c", purpose: "pc" });
		const other = await playedRun(1);

		const trees = [root, a, b, c].map((run) => getForkTree(store, run.runId));

		for (const tree of trees) {
			expect(tree).toEqual(trees[0]);
		}
		expect(trees[0]?.rootRunId).toBe(root.runId);
		expect(trees[0]?.nodes.map((node) => node.runId)).toEqual([
			root.runId,
			a.runId,
			b.runId,
			c.runId,
		]);
		expect(
			getForkTree(store, other.runId).nodes.map((node) => node.runId),
		).toEqual([other.runId]);
	});

	it("describes each run: parent, fork step, purpose, planned and played steps", async () => {
		const root = await playedRun(3);
		const fork = forkRun(store, root.runId, {
			step: 2,
			name: "f",
			purpose: "p",
		});

		const { nodes } = getForkTree(store, fork.runId);

		expect(nodes[0]).toMatchObject({
			runId: root.runId,
			parentRunId: null,
			forkStep: null,
			purpose: null,
			steps: 6,
			playedSteps: 3,
			status: "running",
		});
		expect(nodes[1]).toMatchObject({
			runId: fork.runId,
			name: "f",
			parentRunId: root.runId,
			forkStep: 2,
			purpose: "p",
			steps: 6,
			playedSteps: 2,
		});
	});

	it("rejects an unknown run", () => {
		expect(() =>
			getForkTree(store, "00000000-0000-4000-8000-000000000000" as RunId),
		).toThrow(RunNotFoundError);
	});
});

describe("deleteRun", () => {
	it("deletes a fork without touching its parent", async () => {
		const parent = await playedRun(2);
		const fork = forkRun(store, parent.runId, { step: 1, name: "f" });

		store.deleteRun(fork.runId);

		expect(store.getRun(fork.runId)).toBeUndefined();
		expect(store.listEvents(fork.runId)).toEqual([]);
		expect(getForkTree(store, parent.runId).nodes).toHaveLength(1);
	});

	it("refuses to delete a run that has forks and loses nothing", async () => {
		const parent = await playedRun(2);
		const fork = forkRun(store, parent.runId, { step: 1, name: "f" });
		const events = store.listEvents(parent.runId);

		expect(() => store.deleteRun(parent.runId)).toThrow();

		expect(store.getRun(parent.runId)).toBeDefined();
		expect(store.listEvents(parent.runId)).toEqual(events);
		expect(getForkTree(store, fork.runId).nodes).toHaveLength(2);
	});
});

import type { ForkNode } from "@experiments/types/run";
import { describe, expect, it } from "vitest";
import { layoutForkTree, suggestForkName } from "./fork-tree";

let counter = 0;

function node(
	runId: string,
	parentRunId: string | null,
	forkStep: number | null,
	overrides: Partial<ForkNode> = {},
): ForkNode {
	counter += 1;
	return {
		runId: runId as ForkNode["runId"],
		name: runId,
		status: "running",
		parentRunId: parentRunId as ForkNode["parentRunId"],
		forkStep,
		purpose: null,
		createdAt: new Date(2026, 0, 1, 0, 0, counter).toISOString(),
		steps: 10,
		playedSteps: 5,
		...overrides,
	};
}

describe("layoutForkTree", () => {
	it("places a run followed by its forks, ordered by fork step then creation", () => {
		const nodes = [
			node("root", null, null),
			node("late", "root", 4),
			node("early-b", "root", 1),
			node("early-a", "root", 1, {
				createdAt: new Date(2025, 0, 1).toISOString(),
			}),
			node("grandchild", "early-b", 3),
		];

		const { rows } = layoutForkTree(nodes);

		expect(rows.map((r) => r.node.runId)).toEqual([
			"root",
			"early-a",
			"early-b",
			"grandchild",
			"late",
		]);
		expect(rows.map((r) => r.row)).toEqual([0, 1, 2, 3, 4]);
		expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 2, 1]);
	});

	it("points each run at the row of its parent and starts its lane at the fork step", () => {
		const { rows } = layoutForkTree([
			node("root", null, null),
			node("a", "root", 2),
			node("b", "a", 5),
		]);

		expect(rows.map((r) => r.parentRow)).toEqual([null, 0, 1]);
		expect(rows.map((r) => r.startStep)).toEqual([0, 2, 5]);
	});

	it("takes the longest plan as the width of the graph", () => {
		const { maxSteps } = layoutForkTree([
			node("root", null, null, { steps: 6 }),
			node("a", "root", 2, { steps: 12 }),
		]);

		expect(maxSteps).toBe(12);
	});

	it("treats a run whose parent is missing as a root, and handles no run", () => {
		expect(
			layoutForkTree([node("orphan", "gone", 3)]).rows.map((r) => r.parentRow),
		).toEqual([null]);
		expect(layoutForkTree([])).toEqual({ rows: [], maxSteps: 0 });
	});
});

describe("suggestForkName", () => {
	it("numbers the next fork of the origin after its existing ones", () => {
		const nodes = [
			node("root", null, null),
			node("a", "root", 1),
			node("b", "root", 2),
			node("c", "a", 1),
		];

		expect(suggestForkName({ runId: "root", name: "Quiet Room" }, nodes)).toBe(
			"Quiet Room - fork #3",
		);
		expect(suggestForkName({ runId: "b", name: "b" }, nodes)).toBe(
			"b - fork #1",
		);
	});
});

import type { ForkNode } from "@experiments/types/run";

export type ForkRow = {
	node: ForkNode;
	/** Position from the top, in depth-first order: a run is followed by its forks. */
	row: number;
	depth: number;
	/** Row of the run this one was forked from; `null` for the root. */
	parentRow: number | null;
	/** Step the lane starts at: the fork step, or 0 for the root. */
	startStep: number;
};

export type ForkLayout = {
	rows: ForkRow[];
	/** Last step any run plans, for the width of the graph. */
	maxSteps: number;
};

/** Forks of a run in the order they branch off, then in the order they were made. */
function byForkStep(a: ForkNode, b: ForkNode): number {
	return (
		(a.forkStep ?? 0) - (b.forkStep ?? 0) ||
		a.createdAt.localeCompare(b.createdAt)
	);
}

/**
 * Places the runs of a fork tree one per row, depth first, each run followed
 * by its forks ordered by the step they branch off at. A run whose parent is
 * not in `nodes` is treated as a root, so a partial list still draws.
 */
export function layoutForkTree(nodes: readonly ForkNode[]): ForkLayout {
	const ids = new Set(nodes.map((node) => node.runId));
	const children = new Map<string, ForkNode[]>();
	const roots: ForkNode[] = [];

	for (const node of nodes) {
		if (node.parentRunId !== null && ids.has(node.parentRunId)) {
			const siblings = children.get(node.parentRunId) ?? [];
			siblings.push(node);
			children.set(node.parentRunId, siblings);
		} else {
			roots.push(node);
		}
	}

	const rows: ForkRow[] = [];
	const visit = (node: ForkNode, depth: number, parentRow: number | null) => {
		const row = rows.length;
		rows.push({ node, row, depth, parentRow, startStep: node.forkStep ?? 0 });
		for (const child of (children.get(node.runId) ?? []).sort(byForkStep)) {
			visit(child, depth + 1, row);
		}
	};

	for (const root of roots.sort(byForkStep)) {
		visit(root, 0, null);
	}

	return {
		rows,
		maxSteps: Math.max(0, ...nodes.map((node) => node.steps)),
	};
}

/** `<origin> - fork #n`, n being one more than the forks the origin already has. */
export function suggestForkName(
	origin: { runId: string; name: string },
	nodes: readonly ForkNode[],
): string {
	const forks = nodes.filter((node) => node.parentRunId === origin.runId);
	return `${origin.name} - fork #${forks.length + 1}`;
}

"use client";

import type { ForkTree } from "@experiments/types/run";
import { GitBranchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RunStatusBadge } from "@/components/runs/status-badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { getForkTree } from "@/lib/api";
import { type ForkRow, layoutForkTree } from "@/lib/fork-tree";

const ROW_HEIGHT = 64;
const AXIS_HEIGHT = 28;
const STEP_WIDTH = 40;
const PADDING = 20;
const CORNER = 12;

type State =
	| { status: "loading" }
	| { status: "ready"; tree: ForkTree }
	| { status: "error"; message: string };

/** Fetched each time the sheet opens: forks may have been made since. */
function useForkTree(runId: string, open: boolean): State {
	const [state, setState] = useState<State>({ status: "loading" });

	useEffect(() => {
		if (!open) return;

		let cancelled = false;
		setState({ status: "loading" });
		getForkTree(runId)
			.then((tree) => {
				if (!cancelled) setState({ status: "ready", tree });
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setState({
						status: "error",
						message:
							error instanceof Error
								? error.message
								: "Failed to load the fork tree.",
					});
				}
			});

		return () => {
			cancelled = true;
		};
	}, [runId, open]);

	return state;
}

export function ForkTreeSheet({ runId }: { runId: string }) {
	const [open, setOpen] = useState(false);
	const state = useForkTree(runId, open);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger render={<Button variant="ghost" size="sm" />}>
				<HugeiconsIcon icon={GitBranchIcon} data-icon="inline-start" />
				Forks
			</SheetTrigger>
			<SheetContent
				side="right"
				className="data-[side=right]:w-screen data-[side=right]:sm:max-w-none"
			>
				<SheetHeader className="border-b">
					<SheetTitle>Fork tree</SheetTitle>
					<SheetDescription>
						Each run is a lane over the steps. A fork leaves its parent at the
						step it was made at.
					</SheetDescription>
				</SheetHeader>
				<div className="min-h-0 flex-1 overflow-auto">
					{state.status === "loading" && (
						<p className="p-6 text-muted-foreground">Loading…</p>
					)}
					{state.status === "error" && (
						<p className="p-6 text-destructive">{state.message}</p>
					)}
					{state.status === "ready" && (
						<ForkGraph tree={state.tree} currentRunId={runId} />
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}

function ForkGraph({
	tree,
	currentRunId,
}: {
	tree: ForkTree;
	currentRunId: string;
}) {
	const router = useRouter();
	const { rows, maxSteps } = layoutForkTree(tree.nodes);
	const x = (step: number) => PADDING + step * STEP_WIDTH;
	const y = (row: number) => AXIS_HEIGHT + row * ROW_HEIGHT + ROW_HEIGHT / 2;
	const width = x(maxSteps) + PADDING;
	const height = AXIS_HEIGHT + rows.length * ROW_HEIGHT;
	// Every step for a short run; every fifth otherwise, so labels stay readable.
	const labelEvery = maxSteps > 30 ? 5 : 1;
	const open = (runId: string) => router.push(`/runs/${runId}`);

	return (
		<div className="flex w-max min-w-full">
			<div className="sticky left-0 z-10 w-80 shrink-0 border-r bg-popover">
				<div style={{ height: AXIS_HEIGHT }} className="border-b" />
				{rows.map((row) => (
					<RowLabel
						key={row.node.runId}
						row={row}
						current={row.node.runId === currentRunId}
						onOpen={open}
					/>
				))}
			</div>
			<svg
				width="100%"
				height={height}
				style={{ minWidth: width }}
				role="img"
				aria-label="Fork tree graph"
				className="flex-1"
			>
				{Array.from({ length: maxSteps + 1 }, (_, step) => step).map((step) => (
					<g key={step}>
						<line
							x1={x(step)}
							x2={x(step)}
							y1={AXIS_HEIGHT}
							y2={height}
							className="stroke-border"
							strokeDasharray="2 4"
						/>
						{step % labelEvery === 0 && (
							<text
								x={x(step)}
								y={AXIS_HEIGHT - 10}
								textAnchor="middle"
								className="fill-muted-foreground text-[10px]"
							>
								{step}
							</text>
						)}
					</g>
				))}
				{rows.map((row) => (
					<Lane
						key={row.node.runId}
						row={row}
						parent={row.parentRow === null ? undefined : rows[row.parentRow]}
						current={row.node.runId === currentRunId}
						x={x}
						y={y}
					/>
				))}
			</svg>
		</div>
	);
}

function RowLabel({
	row,
	current,
	onOpen,
}: {
	row: ForkRow;
	current: boolean;
	onOpen: (runId: string) => void;
}) {
	const { node } = row;
	return (
		<button
			type="button"
			onClick={() => onOpen(node.runId)}
			style={{ height: ROW_HEIGHT, paddingLeft: 16 + row.depth * 12 }}
			className={`flex w-full flex-col justify-center gap-0.5 pr-4 text-left hover:bg-muted ${
				current ? "bg-muted" : ""
			}`}
			aria-current={current ? "true" : undefined}
		>
			<span className="flex items-center gap-2">
				<span className="truncate font-medium text-sm">{node.name}</span>
				<RunStatusBadge status={node.status} />
			</span>
			<span className="truncate text-muted-foreground text-xs">
				{node.forkStep === null
					? "Original run"
					: `Forked at step ${node.forkStep}`}
				{node.purpose ? ` · ${node.purpose}` : ""}
			</span>
		</button>
	);
}

function Lane({
	row,
	parent,
	current,
	x,
	y,
}: {
	row: ForkRow;
	parent: ForkRow | undefined;
	current: boolean;
	x: (step: number) => number;
	y: (row: number) => number;
}) {
	const { node } = row;
	const cy = y(row.row);
	const played = Math.max(row.startStep, node.playedSteps);
	const stroke = current ? "stroke-primary" : "stroke-foreground";
	const fill = current ? "fill-primary" : "fill-foreground";

	return (
		<g>
			{current && (
				<rect
					x={0}
					y={cy - ROW_HEIGHT / 2}
					width="100%"
					height={ROW_HEIGHT}
					className="fill-muted"
				/>
			)}
			{parent && (
				<path
					d={`M ${x(row.startStep)} ${y(parent.row)} V ${cy - CORNER} Q ${x(row.startStep)} ${cy} ${x(row.startStep) + CORNER} ${cy}`}
					fill="none"
					strokeWidth={2}
					className={stroke}
				/>
			)}
			{/* Planned but not played yet. */}
			<line
				x1={x(played)}
				x2={x(node.steps)}
				y1={cy}
				y2={cy}
				strokeWidth={2}
				strokeDasharray="4 4"
				className="stroke-muted-foreground/60"
			/>
			{x(played) > x(row.startStep) + (parent ? CORNER : 0) && (
				<line
					x1={x(row.startStep) + (parent ? CORNER : 0)}
					x2={x(played)}
					y1={cy}
					y2={cy}
					strokeWidth={2}
					className={stroke}
				/>
			)}
			{parent && (
				<circle
					cx={x(row.startStep)}
					cy={y(parent.row)}
					r={4}
					className={fill}
				/>
			)}
			<circle cx={x(played)} cy={cy} r={5} className={fill}>
				<title>{`${node.name}: step ${played} of ${node.steps}`}</title>
			</circle>
		</g>
	);
}

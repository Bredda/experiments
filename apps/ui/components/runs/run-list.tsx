"use client";

import type { RunRecord, RunStatus } from "@experiments/types/run";
import { runStatusSchema } from "@experiments/types/run";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { ItemGroup } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { forkCounts, matchesRunQuery } from "@/lib/run-list";
import { RunItem } from "./run-item";
import { STATUS_LABELS } from "./status-badge";

type StatusFilter = RunStatus | "all";
type SortKey = "newest" | "oldest" | "name-asc" | "name-desc";

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
	all: "All statuses",
	...STATUS_LABELS,
};

const SORT_LABELS: Record<SortKey, string> = {
	newest: "Newest first",
	oldest: "Oldest first",
	"name-asc": "Name A → Z",
	"name-desc": "Name Z → A",
};

const SORTERS: Record<SortKey, (a: RunRecord, b: RunRecord) => number> = {
	newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
	oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
	"name-asc": (a, b) => a.name.localeCompare(b.name),
	"name-desc": (a, b) => b.name.localeCompare(a.name),
};

export function RunList({ runs }: { runs: RunRecord[] }) {
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<StatusFilter>("all");
	const [sort, setSort] = useState<SortKey>("newest");
	const [showArchived, setShowArchived] = useState(false);

	const forks = useMemo(() => forkCounts(runs), [runs]);
	const archivedCount = runs.filter((run) => run.archived).length;
	// Archived runs are out of the way unless asked for.
	const listed = showArchived ? runs : runs.filter((run) => !run.archived);
	const visibleRuns = useMemo(
		() =>
			listed
				.filter(
					(run) =>
						(status === "all" || run.status === status) &&
						matchesRunQuery(run, search),
				)
				.sort(SORTERS[sort]),
		[listed, search, status, sort],
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
				<InputGroup className="col-span-2 sm:col-span-1">
					<InputGroupAddon>
						<HugeiconsIcon icon={Search01Icon} />
					</InputGroupAddon>
					<InputGroupInput
						type="search"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search by name, id or notes"
						aria-label="Search runs by name, id or notes"
					/>
				</InputGroup>
				<Select
					items={STATUS_FILTER_LABELS}
					value={status}
					onValueChange={(value) => setStatus(value as StatusFilter)}
				>
					<SelectTrigger
						className="w-full sm:w-36"
						aria-label="Filter by status"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{(["all", ...runStatusSchema.options] as const).map((value) => (
							<SelectItem key={value} value={value}>
								{STATUS_FILTER_LABELS[value]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					items={SORT_LABELS}
					value={sort}
					onValueChange={(value) => setSort(value as SortKey)}
				>
					<SelectTrigger className="w-full sm:w-36" aria-label="Sort runs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{(Object.keys(SORT_LABELS) as SortKey[]).map((value) => (
							<SelectItem key={value} value={value}>
								{SORT_LABELS[value]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex items-center justify-between gap-2">
				<p className="text-muted-foreground text-xs">
					{visibleRuns.length === runs.length
						? `${runs.length} ${runs.length === 1 ? "run" : "runs"}`
						: `${visibleRuns.length} of ${runs.length} runs`}
				</p>
				{archivedCount > 0 && (
					<Button
						variant={showArchived ? "secondary" : "ghost"}
						size="xs"
						aria-pressed={showArchived}
						onClick={() => setShowArchived((shown) => !shown)}
					>
						{showArchived ? "Hide" : "Show"} archived ({archivedCount})
					</Button>
				)}
			</div>

			<ScrollArea className="min-h-0 flex-1">
				{visibleRuns.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						No runs found.
					</p>
				) : (
					<ItemGroup className="gap-2 pr-3">
						{visibleRuns.map((run) => (
							<RunItem
								key={run.runId}
								run={run}
								forks={forks.get(run.runId) ?? 0}
							/>
						))}
					</ItemGroup>
				)}
			</ScrollArea>
		</div>
	);
}

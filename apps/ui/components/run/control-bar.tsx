import type { RunRecord } from "@experiments/types/run";
import { PanelLeftIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { RunStatusBadge } from "@/components/runs/status-badge";
import { Button } from "@/components/ui/button";

export function ControlBar({
	run,
	step,
	pending,
	eventsOpen,
	onToggleEvents,
	onNextStep,
}: {
	run: RunRecord;
	step: number;
	pending: boolean;
	eventsOpen: boolean;
	onToggleEvents: () => void;
	onNextStep: () => void;
}) {
	return (
		<div className="flex h-11 shrink-0 items-center gap-3 border-b px-4">
			<Button
				variant={eventsOpen ? "secondary" : "ghost"}
				size="icon-sm"
				onClick={onToggleEvents}
				aria-label={eventsOpen ? "Hide event viewer" : "Show event viewer"}
				aria-pressed={eventsOpen}
			>
				<HugeiconsIcon icon={PanelLeftIcon} />
			</Button>
			<span className="truncate font-medium text-sm">{run.name}</span>
			<RunStatusBadge status={run.status} />
			<span className="text-muted-foreground text-xs">
				Step {step} / {run.scenario.steps}
			</span>
			<span className="font-mono text-muted-foreground text-xs">
				#{run.seed}
			</span>
			<div className="ml-auto">
				{run.status !== "completed" && (
					<Button size="sm" onClick={onNextStep} disabled={pending}>
						{pending ? "Running step…" : "Next step"}
					</Button>
				)}
			</div>
		</div>
	);
}

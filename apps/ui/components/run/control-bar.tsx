import type { RunRecord } from "@experiments/types/run";
import {
	NextIcon,
	PanelLeftIcon,
	PauseIcon,
	PlayIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { RunStatusBadge } from "@/components/runs/status-badge";
import { Button } from "@/components/ui/button";

export function ControlBar({
	run,
	step,
	pending,
	playing,
	pausing,
	eventsOpen,
	onToggleEvents,
	onNextStep,
	onPlay,
	onPause,
}: {
	run: RunRecord;
	step: number;
	pending: boolean;
	playing: boolean;
	pausing: boolean;
	eventsOpen: boolean;
	onToggleEvents: () => void;
	onNextStep: () => void;
	onPlay: () => void;
	onPause: () => void;
}) {
	return (
		<div className="flex h-11 shrink-0 items-center gap-3 border-b bg-card px-4">
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
			<div className="ml-auto flex items-center gap-2">
				{run.status !== "completed" && (
					<>
						<Button
							variant="outline"
							size="sm"
							onClick={onNextStep}
							disabled={pending || playing}
						>
							<HugeiconsIcon icon={NextIcon} data-icon="inline-start" />
							Next step
						</Button>
						{playing ? (
							<Button size="sm" onClick={onPause} disabled={pausing}>
								<HugeiconsIcon icon={PauseIcon} data-icon="inline-start" />
								{pausing ? "Pausing…" : "Pause"}
							</Button>
						) : (
							<Button size="sm" onClick={onPlay} disabled={pending}>
								<HugeiconsIcon icon={PlayIcon} data-icon="inline-start" />
								Play
							</Button>
						)}
					</>
				)}
			</div>
		</div>
	);
}

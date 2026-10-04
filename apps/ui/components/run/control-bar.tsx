import type { RunRecord } from "@experiments/types/run";
import {
	ArrowLeft01Icon,
	ArrowRight01Icon,
	GitForkIcon,
	NextIcon,
	PanelLeftIcon,
	PauseIcon,
	PlayIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { RunStatusBadge } from "@/components/runs/status-badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ForkTreeSheet } from "./fork-tree-sheet";

export function ControlBar({
	run,
	step,
	latestStep,
	live,
	onCursor,
	onLive,
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
	/** The step the view shows: the cursor, or the latest step when live. */
	step: number;
	latestStep: number;
	live: boolean;
	/** Moves the view to a played step, without touching the execution. */
	onCursor: (step: number) => void;
	onLive: () => void;
	pending: boolean;
	playing: boolean;
	pausing: boolean;
	eventsOpen: boolean;
	onToggleEvents: () => void;
	onNextStep: () => void;
	onPlay: () => void;
	onPause: () => void;
}) {
	const completed = run.status === "completed";

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
			<span className="font-mono text-muted-foreground text-xs">
				#{run.seed}
			</span>
			<div className="ml-auto flex items-center gap-3">
				<RunStatusBadge status={run.status} />
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						nativeButton={false}
						render={<Link href={`/runs/${run.runId}/fork?step=${step}`} />}
					>
						<HugeiconsIcon icon={GitForkIcon} data-icon="inline-start" />
						Fork at step {step}
					</Button>
					<ForkTreeSheet runId={run.runId} />
				</div>
				{/* Sized for the widest label ("Step 10 / 10") so the controls
				    next to it do not move when the step gains a digit. */}
				<span
					className="text-right text-muted-foreground text-xs tabular-nums"
					style={{
						minWidth: `${6 + 2 * String(run.scenario.steps).length + 3}ch`,
					}}
				>
					Step {step} / {run.scenario.steps}
				</span>
				<div className="flex items-center gap-1.5">
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => onCursor(step - 1)}
						disabled={step <= 0}
						aria-label="Previous step"
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} />
					</Button>
					<Slider
						className="data-horizontal:w-40"
						min={0}
						max={Math.max(latestStep, 1)}
						step={1}
						value={[step]}
						disabled={latestStep === 0}
						onValueChange={(value) => {
							const next = Array.isArray(value) ? value[0] : value;
							if (next !== undefined) onCursor(next);
						}}
						aria-label="Step cursor"
					/>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => onCursor(step + 1)}
						disabled={step >= latestStep}
						aria-label="Next played step"
					>
						<HugeiconsIcon icon={ArrowRight01Icon} />
					</Button>
					<Button
						variant={live ? "secondary" : "outline"}
						size="sm"
						onClick={onLive}
						disabled={live}
					>
						Live
					</Button>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={onNextStep}
						disabled={completed || pending || playing}
					>
						<HugeiconsIcon icon={NextIcon} data-icon="inline-start" />
						Next step
					</Button>
					{playing ? (
						<Button
							size="sm"
							className="min-w-24"
							onClick={onPause}
							disabled={pausing}
						>
							<HugeiconsIcon icon={PauseIcon} data-icon="inline-start" />
							{pausing ? "Pausing…" : "Pause"}
						</Button>
					) : (
						<Button
							size="sm"
							className="min-w-24"
							onClick={onPlay}
							disabled={completed || pending}
						>
							<HugeiconsIcon icon={PlayIcon} data-icon="inline-start" />
							Play
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}

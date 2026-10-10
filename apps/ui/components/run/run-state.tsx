import type { RunStatus } from "@experiments/types/run";
import { Radio01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { RunStatusBadge } from "@/components/runs/status-badge";
import { Button } from "@/components/ui/button";
import { Hint } from "./hint";

/**
 * What the run is doing and what the view shows, in one place: the status of
 * the run, plus, while the time cursor is on a past step, a way back to live.
 * Live is the default view, so it has no marker of its own.
 */
export function RunState({
	status,
	live,
	step,
	onLive,
}: {
	status: RunStatus;
	live: boolean;
	/** The step the view shows. */
	step: number;
	onLive: () => void;
}) {
	return (
		<div className="flex items-center gap-1.5">
			<RunStatusBadge status={status} />
			{!live && (
				<Hint label={`Viewing step ${step}: go back to the latest step`}>
					<Button variant="outline" size="xs" onClick={onLive}>
						<HugeiconsIcon icon={Radio01Icon} data-icon="inline-start" />
						Back to live
					</Button>
				</Hint>
			)}
		</div>
	);
}

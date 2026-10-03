import type { RunRecord } from "@experiments/types/run";
import { Separator } from "@/components/ui/separator";

export function RunHeader({
	run,
	eventsLength,
}: {
	run: RunRecord;
	eventsLength: number;
}) {
	return (
		<header className="fixed inset-x-0 top-0 z-50 h-14 border-b bg-background/95 backdrop-blur">
			<div className="flex h-full items-center justify-between px-6">
				<div className="flex min-w-0 items-center gap-4">
					<div className="text-sm font-semibold">experiments</div>

					<Separator orientation="vertical" className="h-5" />

					<div className="min-w-0">
						<div className="truncate text-sm font-medium">
							{run.scenario.name}
						</div>

						<div className="truncate text-xs text-muted-foreground">
							Run {run.runId}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-4 text-xs text-muted-foreground">
					<span>seed {run.scenario.seed}</span>
					<span>{eventsLength} events</span>
				</div>
			</div>
		</header>
	);
}

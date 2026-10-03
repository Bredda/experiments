"use client";

import type { AnyEvent } from "@experiments/types/events";
import type { RunRecord } from "@experiments/types/run";
import { useState } from "react";
import { RunStatusBadge } from "@/components/runs/status-badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { getRun, getRunEvents, stepRun } from "@/lib/api";
import { ApiError } from "@/lib/fetch";
import { EventPanel } from "./event-panel";
import { RunEvents } from "./events";

function currentStep(events: AnyEvent[]) {
	return events.reduce((max, event) => Math.max(max, event.step), 0);
}

export function RunViewer({
	run: initialRun,
	events: initialEvents,
}: {
	run: RunRecord;
	events: AnyEvent[];
}) {
	const [run, setRun] = useState(initialRun);
	const [events, setEvents] = useState(initialEvents);
	const [event, setEvent] = useState<AnyEvent | null>(null);
	const [pending, setPending] = useState(false);

	const handleSelectEvent = (eventId: string) => {
		const event = events.find((e) => e.id === eventId);
		if (!event) {
			const message = `Unknown event ${eventId}`;
			console.error(message);
			throw Error(message);
		}
		setEvent(event);
	};

	const handleNextStep = async () => {
		setPending(true);
		try {
			const result = await stepRun(run.runId);
			setRun(result.run);
			setEvents((current) => {
				const known = new Set(current.map((e) => e.id));
				const added = result.events
					.map((record) => record.payload)
					.filter((e) => !known.has(e.id));
				return [...current, ...added];
			});
		} catch (error) {
			toast.add({
				type: "error",
				description:
					error instanceof Error ? error.message : "Failed to run the step.",
			});
			// 409: the run moved on elsewhere (another tab, or already completed).
			if (error instanceof ApiError && error.status === 409) {
				try {
					const [freshRun, freshEvents] = await Promise.all([
						getRun(run.runId),
						getRunEvents(run.runId),
					]);
					setRun(freshRun);
					setEvents(freshEvents);
				} catch {
					// Keep the current view; the toast already explains the failure.
				}
			}
		} finally {
			setPending(false);
		}
	};

	return (
		<div className="flex h-full flex-col">
			<div className="flex h-11 shrink-0 items-center gap-3 border-b px-4">
				<span className="truncate font-medium text-sm">{run.name}</span>
				<RunStatusBadge status={run.status} />
				<span className="text-muted-foreground text-xs">
					Step {currentStep(events)} / {run.scenario.steps}
				</span>
				<span className="font-mono text-muted-foreground text-xs">
					#{run.seed}
				</span>
				<div className="ml-auto">
					{run.status !== "completed" && (
						<Button size="sm" onClick={handleNextStep} disabled={pending}>
							{pending ? "Running step…" : "Next step"}
						</Button>
					)}
				</div>
			</div>
			<div className="grid min-h-0 flex-1 grid-cols-[420px_minmax(0,1fr)_360px]">
				<aside className="min-h-0 border-r">
					<RunEvents
						events={events}
						onSelect={handleSelectEvent}
						selected={event?.id}
					/>
				</aside>
				<section className="min-h-0 overflow-hidden">This will be main</section>
				<aside className="min-h-0 border-r">
					{event ? (
						<EventPanel event={event} events={events} className="h-full" />
					) : (
						<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
							Select an event
						</div>
					)}
				</aside>
			</div>
		</div>
	);
}

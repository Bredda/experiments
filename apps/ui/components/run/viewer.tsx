"use client";

import type { AnyEvent } from "@experiments/types/events";
import type { RunRecord } from "@experiments/types/run";
import { useMemo, useState } from "react";
import { toast } from "@/components/ui/toast";
import { getRun, getRunEvents, stepRun } from "@/lib/api";
import { ApiError } from "@/lib/fetch";
import { roomSummaries } from "@/lib/run-view";
import { Chat } from "./chat";
import { ControlBar } from "./control-bar";
import { RunEvents } from "./events";
import { Inspector } from "./inspector";
import { RoomStrip } from "./room-strip";
import type { RunSelection } from "./selection";

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
	const [selection, setSelection] = useState<RunSelection | null>(null);
	const [eventsOpen, setEventsOpen] = useState(true);
	// null means all rooms. A run with a single room has no "All rooms" card,
	// so that room is the filter from the start.
	const [roomFilter, setRoomFilter] = useState<string | null>(
		initialRun.scenario.rooms.length === 1
			? (initialRun.scenario.rooms[0]?.id ?? null)
			: null,
	);
	const rooms = useMemo(() => roomSummaries(run, events), [run, events]);
	const [pending, setPending] = useState(false);

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
			<ControlBar
				run={run}
				step={currentStep(events)}
				pending={pending}
				eventsOpen={eventsOpen}
				onToggleEvents={() => setEventsOpen((open) => !open)}
				onNextStep={handleNextStep}
			/>
			<div className="flex min-h-0 flex-1">
				{eventsOpen && (
					<aside className="min-h-0 w-80 shrink-0 border-r">
						<RunEvents
							events={events}
							onSelect={(id) => setSelection({ type: "event", id })}
							selected={selection?.type === "event" ? selection.id : null}
						/>
					</aside>
				)}
				<section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4">
					<RoomStrip
						rooms={rooms}
						selected={roomFilter}
						onSelect={setRoomFilter}
					/>
					<div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
						<Chat
							events={events}
							roomId={roomFilter}
							selectedEventId={
								selection?.type === "event" ? selection.id : null
							}
							onSelectEvent={(id) => setSelection({ type: "event", id })}
						/>
					</div>
				</section>
				{selection && (
					<aside className="min-h-0 w-90 shrink-0 border-l">
						<Inspector
							selection={selection}
							events={events}
							onClose={() => setSelection(null)}
						/>
					</aside>
				)}
			</div>
		</div>
	);
}

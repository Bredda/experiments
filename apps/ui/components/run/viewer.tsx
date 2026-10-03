"use client";

import type { AnyEvent } from "@experiments/types/events";
import type { RunRecord } from "@experiments/types/run";
import { useMemo, useState } from "react";
import { roomSummaries } from "@/lib/run-view";
import { Chat } from "./chat";
import { ControlBar } from "./control-bar";
import { RunEvents } from "./events";
import { Inspector } from "./inspector";
import { RoomStrip } from "./room-strip";
import type { RunSelection } from "./selection";
import { useRunExecution } from "./use-run-execution";

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
	const { run, events, pending, playing, pausing, nextStep, play, pause } =
		useRunExecution(initialRun, initialEvents);
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

	return (
		<div className="flex h-full flex-col">
			<ControlBar
				run={run}
				step={currentStep(events)}
				pending={pending}
				playing={playing}
				pausing={pausing}
				onPlay={play}
				onPause={pause}
				eventsOpen={eventsOpen}
				onToggleEvents={() => setEventsOpen((open) => !open)}
				onNextStep={nextStep}
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
							selectedAgentId={
								selection?.type === "agent" ? selection.id : null
							}
							onSelectEvent={(id) => setSelection({ type: "event", id })}
							onSelectAgent={(id) => setSelection({ type: "agent", id })}
						/>
					</div>
				</section>
				{selection && (
					<aside className="min-h-0 w-90 shrink-0 border-l">
						<Inspector
							run={run}
							selection={selection}
							events={events}
							onSelect={setSelection}
							onClose={() => setSelection(null)}
						/>
					</aside>
				)}
			</div>
		</div>
	);
}

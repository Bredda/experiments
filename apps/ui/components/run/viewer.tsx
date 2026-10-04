"use client";

import type { AnyEvent } from "@experiments/types/events";
import type { RunRecord } from "@experiments/types/run";
import { useMemo, useState } from "react";
import {
	type EventFilter,
	eventsUntil,
	lastStep,
	NO_FILTER,
	roomSummaries,
} from "@/lib/run-view";
import { Chat } from "./chat";
import { ControlBar } from "./control-bar";
import { RunEvents } from "./events";
import { Inspector } from "./inspector";
import { RoomStrip } from "./room-strip";
import type { RunSelection } from "./selection";
import { useRunExecution } from "./use-run-execution";

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
	// null follows the run: the view is always at its latest step.
	const [eventFilter, setEventFilter] = useState<EventFilter>(NO_FILTER);
	const [cursor, setCursor] = useState<number | null>(null);
	const latestStep = lastStep(events);
	const step = Math.min(cursor ?? latestStep, latestStep);
	const shownEvents = useMemo(() => eventsUntil(events, step), [events, step]);
	const rooms = useMemo(
		() => roomSummaries(run, shownEvents),
		[run, shownEvents],
	);
	// A selection from a later step is not part of the view the cursor shows.
	const shownSelection =
		selection?.type === "event" &&
		!shownEvents.some((event) => event.id === selection.id)
			? null
			: selection;

	return (
		<div className="flex h-full flex-col">
			<ControlBar
				run={run}
				step={step}
				latestStep={latestStep}
				live={cursor === null || cursor >= latestStep}
				// Reaching the latest step means following the run again.
				onCursor={(next) =>
					setCursor(next >= latestStep ? null : Math.max(next, 0))
				}
				onLive={() => setCursor(null)}
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
							events={shownEvents}
							agentIds={run.scenario.agents.map((agent) => agent.id)}
							filter={eventFilter}
							onFilter={setEventFilter}
							onSelect={(id) => setSelection({ type: "event", id })}
							selected={
								shownSelection?.type === "event" ? shownSelection.id : null
							}
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
							events={shownEvents}
							roomId={roomFilter}
							selectedEventId={
								shownSelection?.type === "event" ? shownSelection.id : null
							}
							selectedAgentId={
								shownSelection?.type === "agent" ? shownSelection.id : null
							}
							onSelectEvent={(id) => setSelection({ type: "event", id })}
							onSelectAgent={(id) => setSelection({ type: "agent", id })}
						/>
					</div>
				</section>
				{shownSelection && (
					<aside className="min-h-0 w-90 shrink-0 border-l">
						<Inspector
							run={run}
							selection={shownSelection}
							events={shownEvents}
							step={step}
							onSelect={setSelection}
							onClose={() => setSelection(null)}
						/>
					</aside>
				)}
			</div>
		</div>
	);
}

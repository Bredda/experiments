import type { AnyEvent } from "@experiments/types/events";
import type { RunRecord } from "@experiments/types/run";

/** The latest step the events reach; 0 when there is nothing but arrivals. */
export function lastStep(events: readonly AnyEvent[]): number {
	return events.reduce((max, event) => Math.max(max, event.step), 0);
}

/** The run as it stood once `step` was over: step 0 keeps only the arrivals. */
export function eventsUntil(
	events: readonly AnyEvent[],
	step: number,
): AnyEvent[] {
	return events.filter((event) => event.step <= step);
}

/** agentId → roomId, as announced by the `agent.joined` events. */
export function agentRooms(events: readonly AnyEvent[]): Map<string, string> {
	const rooms = new Map<string, string>();
	for (const event of events) {
		if (event.type === "agent.joined") {
			rooms.set(event.agentId, event.roomId);
		}
	}
	return rooms;
}

/**
 * The room an event belongs to. Events that carry no room of their own
 * (silent proposals, prompts) take the room their agent joined.
 */
export function eventRoomId(
	event: AnyEvent,
	rooms: ReadonlyMap<string, string>,
): string | undefined {
	switch (event.type) {
		case "agent.joined":
		case "message.published":
			return event.roomId;
		case "action.proposed":
		case "action.selected":
			return event.action.type === "speak"
				? event.action.roomId
				: rooms.get(event.agentId);
		case "agent.prompt_built":
			return rooms.get(event.agentId);
	}
}

export type RoomSummary = {
	roomId: string;
	memberIds: string[];
	messageCount: number;
	lastSpeaker: string | undefined;
	/** Steps so far in which nobody spoke in this room. */
	silentSteps: number;
};

/** One summary per room of the scenario, in scenario order. */
export function roomSummaries(
	run: RunRecord,
	events: readonly AnyEvent[],
): RoomSummary[] {
	const rooms = agentRooms(events);
	const finalStep = lastStep(events);

	return run.scenario.rooms.map((room) => {
		const messages = events.filter(
			(event) =>
				event.type === "message.published" &&
				eventRoomId(event, rooms) === room.id,
		);
		const spokenSteps = new Set(messages.map((message) => message.step));
		let silentSteps = 0;
		for (let step = 1; step <= finalStep; step++) {
			if (!spokenSteps.has(step)) silentSteps++;
		}

		const lastMessage = messages.at(-1);

		return {
			roomId: room.id,
			memberIds: room.members,
			messageCount: messages.length,
			lastSpeaker:
				lastMessage?.type === "message.published"
					? lastMessage.agentId
					: undefined,
			silentSteps,
		};
	});
}

export type TimelineItem =
	| { kind: "step"; key: string; step: number; time: string }
	| { kind: "joined"; key: string; eventId: string; agentId: string }
	| {
			kind: "message";
			key: string;
			eventId: string;
			step: number;
			agentId: string;
			content: string;
	  }
	| {
			kind: "selection";
			key: string;
			eventId: string;
			step: number;
			selected: string;
			/** Every agent that proposed to speak in that room, highest urgency first. */
			candidates: { agentId: string; urgency: number }[];
	  }
	| { kind: "silence"; key: string; step: number };

/**
 * Chat-style reading of the event log: arrivals, then for each step a marker
 * followed by what was said, or by a silence marker when nobody spoke. A
 * selection marker explains who won when several agents wanted to speak.
 * `roomId` limits the view to one room; null shows every room.
 */
export function buildTimeline(
	events: readonly AnyEvent[],
	roomId: string | null,
): TimelineItem[] {
	const rooms = agentRooms(events);
	const inRoom = (event: AnyEvent) =>
		roomId === null || eventRoomId(event, rooms) === roomId;

	const finalStep = lastStep(events);
	const items: TimelineItem[] = [];

	for (const event of events) {
		if (event.type === "agent.joined" && inRoom(event)) {
			items.push({
				kind: "joined",
				key: event.id,
				eventId: event.id,
				agentId: event.agentId,
			});
		}
	}

	for (let step = 1; step <= finalStep; step++) {
		const stepEvents = events.filter((event) => event.step === step);
		const time = stepEvents[0]?.timestamp;
		if (time === undefined) continue;

		items.push({ kind: "step", key: `step-${step}`, step, time });

		let spoke = false;
		for (const event of stepEvents) {
			if (!inRoom(event)) continue;

			if (event.type === "action.selected") {
				const room = eventRoomId(event, rooms);
				const candidates = stepEvents
					.filter(
						(other) =>
							other.type === "action.proposed" &&
							other.action.type === "speak" &&
							eventRoomId(other, rooms) === room,
					)
					.map((other) => ({
						agentId: other.agentId,
						urgency:
							other.type === "action.proposed" && other.action.type === "speak"
								? other.action.urgency
								: 0,
					}))
					.sort((a, b) => b.urgency - a.urgency);

				if (candidates.length > 1) {
					items.push({
						kind: "selection",
						key: event.id,
						eventId: event.id,
						step,
						selected: event.agentId,
						candidates,
					});
				}
			}

			if (event.type === "message.published") {
				spoke = true;
				items.push({
					kind: "message",
					key: event.id,
					eventId: event.id,
					step,
					agentId: event.agentId,
					content: event.content,
				});
			}
		}

		if (!spoke) {
			items.push({ kind: "silence", key: `silence-${step}`, step });
		}
	}

	return items;
}

export type AgentProposal = {
	eventId: string;
	step: number;
	type: "speak" | "stay_silent";
	content: string | undefined;
	urgency: number | undefined;
	reasoning: string | undefined;
	/** The scheduler picked this agent at that step. */
	selected: boolean;
};

export type AgentSummary = {
	agentId: string;
	roomId: string | undefined;
	behavior: string;
	memory: string | undefined;
	messageCount: number;
	timesSelected: number;
	speakProposals: number;
	silentProposals: number;
	/** Latest first, at most `RECENT_PROPOSALS`. */
	recentProposals: AgentProposal[];
};

const RECENT_PROPOSALS = 5;

/** What the run shows about one agent; undefined if the scenario has no such agent. */
export function agentSummary(
	run: RunRecord,
	events: readonly AnyEvent[],
	agentId: string,
): AgentSummary | undefined {
	const config = run.scenario.agents.find((agent) => agent.id === agentId);
	if (config === undefined) return undefined;

	const selectedSteps = new Set(
		events
			.filter(
				(event) =>
					event.type === "action.selected" && event.agentId === agentId,
			)
			.map((event) => event.step),
	);

	const proposals: AgentProposal[] = [];
	let messageCount = 0;

	for (const event of events) {
		if (event.agentId !== agentId) continue;

		if (event.type === "message.published") messageCount++;

		if (event.type === "action.proposed") {
			const { action } = event;
			proposals.push({
				eventId: event.id,
				step: event.step,
				type: action.type,
				content: action.type === "speak" ? action.content : undefined,
				urgency: action.type === "speak" ? action.urgency : undefined,
				reasoning: action.reasoning,
				selected: selectedSteps.has(event.step),
			});
		}
	}

	return {
		agentId,
		roomId: agentRooms(events).get(agentId),
		behavior: config.behavior,
		memory: config.memory,
		messageCount,
		timesSelected: selectedSteps.size,
		speakProposals: proposals.filter((p) => p.type === "speak").length,
		silentProposals: proposals.filter((p) => p.type === "stay_silent").length,
		recentProposals: proposals.slice(-RECENT_PROPOSALS).reverse(),
	};
}

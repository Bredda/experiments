import type { AnyEvent } from "@experiments/types/events";
import type { RunRecord } from "@experiments/types/run";

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
	const lastStep = events.reduce((max, event) => Math.max(max, event.step), 0);

	return run.scenario.rooms.map((room) => {
		const messages = events.filter(
			(event) =>
				event.type === "message.published" &&
				eventRoomId(event, rooms) === room.id,
		);
		const spokenSteps = new Set(messages.map((message) => message.step));
		let silentSteps = 0;
		for (let step = 1; step <= lastStep; step++) {
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

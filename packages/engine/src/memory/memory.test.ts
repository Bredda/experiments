import {
	type AnyEvent,
	actionProposedSchema,
	messagePublishedSchema,
} from "@experiments/types/events";
import { type AgentId, newEventId, type RoomId } from "@experiments/types/ids";
import { roomViewSchema } from "@experiments/types/room";
import { describe, expect, it } from "vitest";
import { getMemory, LAST_N } from "./index";

const alice = "alice" as AgentId;
const bob = "bob" as AgentId;
const roomId = "main" as RoomId;
const time = "2026-01-01T00:00:00.000Z";

function message(step: number, agentId: AgentId, content: string): AnyEvent {
	return messagePublishedSchema.parse({
		id: newEventId(),
		timestamp: time,
		step,
		type: "message.published",
		agentId,
		roomId,
		content,
	});
}

function proposal(step: number, agentId: AgentId, reasoning: string): AnyEvent {
	return actionProposedSchema.parse({
		id: newEventId(),
		timestamp: time,
		step,
		type: "action.proposed",
		agentId,
		action: { type: "stay_silent", agentId, reasoning },
	});
}

function view(events: AnyEvent[]) {
	return roomViewSchema.parse({
		roomId,
		visibleEvents: events,
		members: [alice, bob],
	});
}

function slice(kind: "sliding_window" | "last_n", events: AnyEvent[]) {
	return getMemory(kind).buildSlice({
		agentId: alice,
		time: time as never,
		room: view(events),
	});
}

/** `count` steps, each with a message from bob and a proposal from each agent. */
function history(count: number): AnyEvent[] {
	return Array.from({ length: count }, (_, i) => [
		proposal(i + 1, alice, `alice-${i + 1}`),
		proposal(i + 1, bob, `bob-${i + 1}`),
		message(i + 1, bob, `message-${i + 1}`),
	]).flat();
}

describe("last_n memory", () => {
	it("keeps the last messages and the agent's own last proposals", () => {
		const result = slice("last_n", history(LAST_N + 3));

		expect(result.messages.map((m) => m.content)).toEqual(
			Array.from({ length: LAST_N }, (_, i) => `message-${i + 4}`),
		);
		expect(result.agentProposals.map((p) => p.action.reasoning)).toEqual(
			Array.from({ length: LAST_N }, (_, i) => `alice-${i + 4}`),
		);
	});

	it("never remembers what other agents proposed", () => {
		const result = slice("last_n", history(3));

		expect(result.agentProposals.every((p) => p.agentId === alice)).toBe(true);
	});

	it("keeps everything when there is less than N to remember", () => {
		const events = history(2);

		expect(slice("last_n", events)).toEqual(slice("sliding_window", events));
	});

	it("matches sliding_window apart from the truncation", () => {
		const events = history(LAST_N + 2);
		const full = slice("sliding_window", events);
		const windowed = slice("last_n", events);

		expect(full.messages).toHaveLength(LAST_N + 2);
		expect(windowed.currentRoomId).toBe(full.currentRoomId);
		expect(windowed.roomMembers).toEqual(full.roomMembers);
		expect(windowed.messages).toEqual(full.messages.slice(-LAST_N));
	});

	it("is deterministic", () => {
		const events = history(LAST_N + 1);

		expect(slice("last_n", events)).toEqual(slice("last_n", events));
	});
});

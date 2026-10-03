import { randomUUID } from "node:crypto";
import {
	type AnyEvent,
	actionProposedSchema,
	actionSelectedSchema,
	agentJoinedSchema,
	agentPromptBuiltSchema,
	messagePublishedSchema,
} from "@experiments/types/events";
import type { RunRecord } from "@experiments/types/run";
import { describe, expect, it } from "vitest";
import { agentRooms, eventRoomId, roomSummaries } from "./run-view";

const TIME = "2026-01-01T00:00:00.000Z";
const base = (step: number) => ({ id: randomUUID(), timestamp: TIME, step });

const joined = (agentId: string, roomId: string) =>
	agentJoinedSchema.parse({
		...base(0),
		type: "agent.joined",
		agentId,
		roomId,
	});

const proposedSilent = (agentId: string, step: number) =>
	actionProposedSchema.parse({
		...base(step),
		type: "action.proposed",
		agentId,
		action: { type: "stay_silent", agentId },
	});

const proposedSpeak = (agentId: string, roomId: string, step: number) =>
	actionProposedSchema.parse({
		...base(step),
		type: "action.proposed",
		agentId,
		action: { type: "speak", agentId, roomId, content: "hi" },
	});

const selected = (agentId: string, roomId: string, step: number) =>
	actionSelectedSchema.parse({
		...base(step),
		type: "action.selected",
		agentId,
		action: { type: "speak", agentId, roomId, content: "hi" },
	});

const published = (agentId: string, roomId: string, step: number) =>
	messagePublishedSchema.parse({
		...base(step),
		type: "message.published",
		agentId,
		roomId,
		content: "hi",
	});

const prompt = (agentId: string, step: number) =>
	agentPromptBuiltSchema.parse({
		...base(step),
		type: "agent.prompt_built",
		agentId,
		prompt: [{ role: "system", content: "x" }],
	});

function run(rooms: { id: string; members: string[] }[]): RunRecord {
	return {
		runId: randomUUID(),
		name: "test",
		seed: "ABC",
		status: "running",
		createdAt: TIME,
		scenario: {
			name: "test",
			seed: "ABC",
			agents: rooms.flatMap((room) =>
				room.members.map((id) => ({ id, behavior: "mentioned" as const })),
			),
			rooms,
			scheduler: { type: "highest_urgency" },
			steps: 5,
		},
	} as unknown as RunRecord;
}

describe("eventRoomId", () => {
	const events: AnyEvent[] = [joined("alice", "main"), joined("bob", "side")];
	const rooms = agentRooms(events);

	it("reads the room carried by the event or its speak action", () => {
		expect(eventRoomId(events[0] as AnyEvent, rooms)).toBe("main");
		expect(eventRoomId(published("alice", "main", 1), rooms)).toBe("main");
		expect(eventRoomId(proposedSpeak("alice", "main", 1), rooms)).toBe("main");
		expect(eventRoomId(selected("alice", "main", 1), rooms)).toBe("main");
	});

	it("falls back to the room the agent joined for events without a room", () => {
		expect(eventRoomId(proposedSilent("bob", 1), rooms)).toBe("side");
		expect(eventRoomId(prompt("alice", 1), rooms)).toBe("main");
	});

	it("has no room for an agent that never joined", () => {
		expect(eventRoomId(proposedSilent("ghost", 1), rooms)).toBeUndefined();
	});
});

describe("roomSummaries", () => {
	it("counts messages, last speaker and silent steps per room", () => {
		const events: AnyEvent[] = [
			joined("alice", "main"),
			joined("bob", "main"),
			joined("carol", "side"),
			// step 1: alice speaks in main, carol silent in side
			proposedSpeak("alice", "main", 1),
			proposedSilent("carol", 1),
			selected("alice", "main", 1),
			published("alice", "main", 1),
			// step 2: nobody speaks
			proposedSilent("alice", 2),
			proposedSilent("carol", 2),
			// step 3: bob speaks in main
			published("bob", "main", 3),
		];

		const [main, side] = roomSummaries(
			run([
				{ id: "main", members: ["alice", "bob"] },
				{ id: "side", members: ["carol"] },
			]),
			events,
		);

		expect(main).toEqual({
			roomId: "main",
			memberIds: ["alice", "bob"],
			messageCount: 2,
			lastSpeaker: "bob",
			silentSteps: 1,
		});
		expect(side).toEqual({
			roomId: "side",
			memberIds: ["carol"],
			messageCount: 0,
			lastSpeaker: undefined,
			silentSteps: 3,
		});
	});

	it("reports no silent step before the first step", () => {
		const [main] = roomSummaries(run([{ id: "main", members: ["alice"] }]), [
			joined("alice", "main"),
		]);

		expect(main?.silentSteps).toBe(0);
		expect(main?.messageCount).toBe(0);
	});
});

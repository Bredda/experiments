import { randomUUID } from "node:crypto";
import z from "zod";

// Agent/room ids can come from user-authored scenario files (e.g. "alice"),
// so they are opaque branded strings rather than uuid-shaped values.
export const agentIdSchema = z.string().brand("AgentId");
export type AgentId = z.infer<typeof agentIdSchema>;

export const roomIdSchema = z.string().brand("RoomId");
export type RoomId = z.infer<typeof roomIdSchema>;

export const eventIdSchema = z.uuid().brand("EventId");
export type EventId = z.infer<typeof eventIdSchema>;

export const runIdSchema = z.uuid().brand("RunId");
export type RunId = z.infer<typeof runIdSchema>;

export function newAgentId(): AgentId {
	return randomUUID() as AgentId;
}

export function newRoomId(): RoomId {
	return randomUUID() as RoomId;
}

export function newEventId(): EventId {
	return randomUUID() as EventId;
}

export function newRunId(): RunId {
	return randomUUID() as RunId;
}

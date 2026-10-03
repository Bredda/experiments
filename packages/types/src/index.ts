import z from "zod";
import { agentIdSchema } from "./ids";
import { MEMORY_KINDS, type MemoryType, memoryTypeSchema } from "./memory";
import { stepSchema, timeSchema } from "./primitives";
import { type RoomView, roomViewSchema } from "./room";

export * from "./ids";
export * from "./primitives";
export {
	MEMORY_KINDS,
	type MemoryType,
	memoryTypeSchema,
	type RoomView,
	roomViewSchema,
};

export const observationSchema = z.object({
	agentId: agentIdSchema,
	room: roomViewSchema,
	step: stepSchema,
	time: timeSchema,
});
export type Observation = z.infer<typeof observationSchema>;

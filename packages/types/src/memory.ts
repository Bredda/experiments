import z from "zod";
import { actionProposedSchema, messagePublishedSchema } from "./events";
import { roomIdSchema } from "./ids";
import { timeSchema } from "./primitives";

export const MEMORY_KINDS = ["sliding_window"] as const;
export const memoryTypeSchema = z.enum(MEMORY_KINDS);
export type MemoryType = (typeof MEMORY_KINDS)[number];

export const memorySliceSchema = z.object({
	currentRoomId: roomIdSchema,
	roomMembers: z.array(z.string()),
	currentTime: timeSchema,
	messages: z.array(messagePublishedSchema),
	agentProposals: z.array(actionProposedSchema),
});
export type MemorySlice = z.infer<typeof memorySliceSchema>;

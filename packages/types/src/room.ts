import z from "zod";
import { anyEventSchema } from "./events";
import { agentIdSchema, roomIdSchema } from "./ids";

export const roomViewSchema = z.object({
	roomId: roomIdSchema,
	visibleEvents: z.array(anyEventSchema),
	members: z.array(agentIdSchema),
});
export type RoomView = z.infer<typeof roomViewSchema>;

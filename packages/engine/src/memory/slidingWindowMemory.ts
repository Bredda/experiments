import type { Time } from "@experiments/types";
import type { AgentId } from "@experiments/types/ids";
import { type MemorySlice, memorySliceSchema } from "@experiments/types/memory";
import type { RoomView } from "@experiments/types/room";
import { Memory } from "./base";

export class SlidingWindowMemory extends Memory {
	buildSlice(params: {
		agentId: AgentId;
		time: Time;
		room: RoomView;
	}): MemorySlice {
		const availableEvents = params.room.visibleEvents;
		const messages = availableEvents.filter(
			(event) => event.type === "message.published",
		);
		const agentProposals = availableEvents.filter(
			(event) =>
				event.type === "action.proposed" && event.agentId === params.agentId,
		);

		return memorySliceSchema.parse({
			currentRoomId: params.room.roomId,
			currentTime: params.time,
			messages,
			agentProposals,
			roomMembers: params.room.members,
		});
	}
}

import type { Time } from "@experiments/types";
import type { AgentId } from "@experiments/types/ids";
import type { MemorySlice } from "@experiments/types/memory";
import type { RoomView } from "@experiments/types/room";
import { SlidingWindowMemory } from "./slidingWindowMemory";

/** How many messages, and how many of its own proposals, an agent remembers. */
export const LAST_N = 5;

/** Remembers only the last `LAST_N` messages and its own last `LAST_N` proposals. */
export class LastNMemory extends SlidingWindowMemory {
	override buildSlice(params: {
		agentId: AgentId;
		time: Time;
		room: RoomView;
	}): MemorySlice {
		const slice = super.buildSlice(params);

		return {
			...slice,
			messages: slice.messages.slice(-LAST_N),
			agentProposals: slice.agentProposals.slice(-LAST_N),
		};
	}
}

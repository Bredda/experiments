import type { MemoryType, Observation, Step, Time } from "@experiments/types";
import { observationSchema } from "@experiments/types";
import type { ActionProposal } from "@experiments/types/actions";
import type { AgentId, RoomId } from "@experiments/types/ids";
import type { RoomView } from "@experiments/types/room";

export abstract class Agent {
	readonly id: AgentId;
	readonly name: string;
	readonly roomId: RoomId;
	readonly memoryType?: MemoryType;

	constructor(
		id: AgentId,
		name: string,
		roomId: RoomId,
		memoryType?: MemoryType,
	) {
		this.id = id;
		this.name = name;
		this.roomId = roomId;
		this.memoryType = memoryType;
	}

	observe(params: { step: Step; time: Time; room: RoomView }): Observation {
		return observationSchema.parse({
			agentId: this.id,
			room: params.room,
			step: params.step,
			time: params.time,
		});
	}

	// LLM-backed behaviors (see @experiments/ai) call out over the network, so
	// this must allow async implementations; pure behaviors can just return a
	// plain ActionProposal.
	abstract propose(
		observation: Observation,
	): ActionProposal | Promise<ActionProposal>;
}

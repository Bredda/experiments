import type { AnyEvent } from "@experiments/types/events";
import type { AgentId, RoomId } from "@experiments/types/ids";
import { type RoomView, roomViewSchema } from "@experiments/types/room";

export class Room {
	readonly id: RoomId;
	readonly name: string;
	readonly members = new Set<AgentId>();

	constructor(params: { id: RoomId; name: string }) {
		this.id = params.id;
		this.name = params.name;
	}

	add(agentId: AgentId): void {
		this.members.add(agentId);
	}

	remove(agentId: AgentId): void {
		this.members.delete(agentId);
	}

	contains(agentId: AgentId): boolean {
		return this.members.has(agentId);
	}

	view(agentId: AgentId, events: readonly AnyEvent[]): RoomView {
		if (!this.contains(agentId)) {
			throw new Error(`Agent ${agentId} is not a member of room ${this.id}`);
		}

		return roomViewSchema.parse({
			roomId: this.id,
			visibleEvents: events,
			members: [...this.members],
		});
	}
}

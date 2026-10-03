import type { MemoryType } from "@experiments/types";
import type { AgentId, RoomId } from "@experiments/types/ids";
import type { Agent } from "../agent";
import { Registry } from "../registry";
import { MentionedAgent } from "./mentionedAgent";
import { SilentAgent } from "./silentAgent";

export type AgentBehaviorFactory = (
	agentId: AgentId,
	name: string,
	roomId: RoomId,
	memoryType?: MemoryType,
) => Agent;

export const agentBehaviorRegistry = new Registry<AgentBehaviorFactory>();

agentBehaviorRegistry.register(
	"mentioned",
	(agentId, name, roomId, memoryType) =>
		new MentionedAgent(agentId, name, roomId, memoryType),
);

agentBehaviorRegistry.register(
	"silent",
	(agentId, name, roomId, memoryType) =>
		new SilentAgent(agentId, name, roomId, memoryType),
);

import type { Time } from "@experiments/types";
import type {
	ActionProposed,
	MessagePublished,
} from "@experiments/types/events";
import type { AgentId } from "@experiments/types/ids";
import type { MemorySlice } from "@experiments/types/memory";
import type { RoomView } from "@experiments/types/room";

function buildChatMessage(message: MessagePublished): string {
	return `
<message name="${message.agentId}" timestamp="${message.timestamp}">
${message.content}
</message>
`;
}

function buildScratchpad(proposed: ActionProposed): string {
	return `
<item timestamp="${proposed.timestamp}">
${proposed.action.reasoning ?? ""}
</item>
`;
}

export function memorySliceToPrompt(slice: MemorySlice): {
	role: string;
	content: string;
} {
	const messages = slice.messages.map(buildChatMessage).join("");
	const scratchpad = slice.agentProposals.map(buildScratchpad).join("");

	return {
		role: "system",
		content: `
<memory>
Current time: ${slice.currentTime}
Current room:
    * name: ${slice.currentRoomId}
    * members: ${slice.roomMembers}
Your scratchpad so far:
${scratchpad}
Messages so far :
${messages}
</memory>
`,
	};
}

export abstract class Memory {
	abstract buildSlice(params: {
		agentId: AgentId;
		time: Time;
		room: RoomView;
	}): MemorySlice;
}

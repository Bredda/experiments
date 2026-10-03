import { Agent, getMemory, memorySliceToPrompt } from "@experiments/engine";
import { env } from "@experiments/settings";
import type { MemoryType, Observation } from "@experiments/types";
import type { ActionProposal, Prompt } from "@experiments/types/actions";
import type { AgentId, RoomId } from "@experiments/types/ids";
import { ChatAnthropic } from "@langchain/anthropic";
import { createAgent } from "langchain";
import { proposalSchema, toActionProposal } from "./proposal";

const model = new ChatAnthropic({
	model: "claude-haiku-4-5-20251001",
	apiKey: env.ANTHROPIC_API_KEY,
});

const reactAgent = createAgent({
	model,
	responseFormat: proposalSchema,
});

export class LLMAgent extends Agent {
	constructor(
		agentId: AgentId,
		name: string,
		roomId: RoomId,
		memoryType?: MemoryType,
	) {
		if (memoryType === undefined) {
			throw new Error("LLMAgent requires a memoryType to be specified.");
		}
		super(agentId, name, roomId, memoryType);
	}

	#buildBasePrompt() {
		return {
			role: "system",
			content: `You entered an empty chatbot. Your name is ${this.name}.`,
		};
	}

	#buildHistory(observation: Observation) {
		// Memory policy is retrieved lazily as it could evolve between steps.
		const memoryPolicy = getMemory(this.memoryType as MemoryType);
		const slice = memoryPolicy.buildSlice({
			agentId: observation.agentId,
			time: observation.time,
			room: observation.room,
		});
		return memorySliceToPrompt(slice);
	}

	async propose(observation: Observation): Promise<ActionProposal> {
		const prompt: Prompt = [
			this.#buildBasePrompt(),
			this.#buildHistory(observation),
			{ role: "user", content: "Propose your next action." },
		];

		const result = await reactAgent.invoke({ messages: prompt });
		const proposal = proposalSchema.parse(result.structuredResponse);

		return toActionProposal(proposal, this.id, this.roomId, prompt);
	}
}

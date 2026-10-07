import { Agent, getMemory } from "@experiments/engine";
import type { MemoryType, Observation } from "@experiments/types";
import type { ActionProposal } from "@experiments/types/actions";
import type { AgentId, RoomId } from "@experiments/types/ids";
import { buildPrompt } from "./prompt";
import { toActionProposal } from "./proposal";
import type { ProposalRunner } from "./runner";

export class LLMAgent extends Agent {
	readonly #runner: ProposalRunner;

	constructor(
		agentId: AgentId,
		name: string,
		roomId: RoomId,
		memoryType: MemoryType | undefined,
		runner: ProposalRunner,
	) {
		if (memoryType === undefined) {
			throw new Error("LLMAgent requires a memoryType to be specified.");
		}
		super(agentId, name, roomId, memoryType);
		this.#runner = runner;
	}

	async propose(observation: Observation): Promise<ActionProposal> {
		// Memory policy is retrieved lazily as it could evolve between steps.
		const memory = getMemory(this.memoryType as MemoryType).buildSlice({
			agentId: observation.agentId,
			time: observation.time,
			room: observation.room,
		});
		const prompt = buildPrompt({ name: this.name, memory });
		const proposal = await this.#runner(prompt);

		return toActionProposal(proposal, this.id, this.roomId, prompt);
	}
}

import { agentBehaviorRegistry } from "@experiments/engine";
import { anthropicRunner, DEFAULT_MODEL } from "./anthropicRunner";
import { LLMAgent } from "./llmAgent";

export { LLMAgent } from "./llmAgent";
export { buildPrompt } from "./prompt";
export { type Proposal, proposalSchema } from "./proposal";
export type { ProposalRunner } from "./runner";

agentBehaviorRegistry.register(
	"llm",
	({ agentId, name, roomId, memoryType }) =>
		new LLMAgent(
			agentId,
			name,
			roomId,
			memoryType,
			anthropicRunner(DEFAULT_MODEL),
		),
);

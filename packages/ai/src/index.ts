import { agentBehaviorRegistry } from "@experiments/engine";
import { DEFAULT_AGENT_MODEL } from "@experiments/types/scenario";
import { anthropicRunner } from "./anthropicRunner";
import { LLMAgent } from "./llmAgent";

export { LLMAgent } from "./llmAgent";
export { buildPrompt } from "./prompt";
export { type Proposal, proposalSchema } from "./proposal";
export type { ProposalRunner } from "./runner";

agentBehaviorRegistry.register(
	"llm",
	({ agentId, name, roomId, memoryType, persona, model }) =>
		new LLMAgent(agentId, name, roomId, memoryType, {
			runner: anthropicRunner(model ?? DEFAULT_AGENT_MODEL),
			persona,
		}),
);

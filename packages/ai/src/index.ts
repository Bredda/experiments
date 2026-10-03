import { agentBehaviorRegistry } from "@experiments/engine";
import { LLMAgent } from "./llmAgent";

export { LLMAgent } from "./llmAgent";
export { type Proposal, proposalSchema } from "./proposal";

agentBehaviorRegistry.register(
	"llm",
	(agentId, name, roomId, memoryType) =>
		new LLMAgent(agentId, name, roomId, memoryType),
);

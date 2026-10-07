import { env } from "@experiments/settings";
import { ChatAnthropic } from "@langchain/anthropic";
import { createAgent } from "langchain";
import { type Proposal, proposalSchema } from "./proposal";
import type { ProposalRunner } from "./runner";

export const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/** One runner per model id, built on first use and then shared. */
const runners = new Map<string, ProposalRunner>();

function createRunner(model: string): ProposalRunner {
	const reactAgent = createAgent({
		model: new ChatAnthropic({ model, apiKey: env.ANTHROPIC_API_KEY }),
		responseFormat: proposalSchema,
	});

	return async (prompt): Promise<Proposal> => {
		const result = await reactAgent.invoke({ messages: prompt });
		return proposalSchema.parse(result.structuredResponse);
	};
}

export function anthropicRunner(model: string): ProposalRunner {
	let runner = runners.get(model);

	if (runner === undefined) {
		runner = createRunner(model);
		runners.set(model, runner);
	}

	return runner;
}

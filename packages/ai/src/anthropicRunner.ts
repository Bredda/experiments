import { env } from "@experiments/settings";
import type { TokenUsage } from "@experiments/types/actions";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseMessage, UsageMetadata } from "@langchain/core/messages";
import { createAgent } from "langchain";
import { proposalSchema } from "./proposal";
import type { ProposalRunner, RunnerResult } from "./runner";

/** One runner per model id, built on first use and then shared. */
const runners = new Map<string, ProposalRunner>();

/** Tokens over every model answer of the call, or nothing if none reports them. */
function sumUsage(messages: BaseMessage[]): TokenUsage | undefined {
	let usage: TokenUsage | undefined;

	for (const message of messages) {
		// Only the model's own answers carry usage_metadata.
		const tokens =
			"usage_metadata" in message
				? (message.usage_metadata as UsageMetadata | undefined)
				: undefined;

		if (tokens === undefined) {
			continue;
		}

		usage = {
			inputTokens: (usage?.inputTokens ?? 0) + tokens.input_tokens,
			outputTokens: (usage?.outputTokens ?? 0) + tokens.output_tokens,
		};
	}

	return usage;
}

function createRunner(model: string): ProposalRunner {
	const reactAgent = createAgent({
		model: new ChatAnthropic({ model, apiKey: env.ANTHROPIC_API_KEY }),
		responseFormat: proposalSchema,
	});

	return async (prompt): Promise<RunnerResult> => {
		const result = await reactAgent.invoke({ messages: prompt });

		return {
			proposal: proposalSchema.parse(result.structuredResponse),
			call: { model, usage: sumUsage(result.messages) },
		};
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

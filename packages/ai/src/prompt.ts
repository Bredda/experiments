import { memorySliceToPrompt } from "@experiments/engine";
import type { Prompt } from "@experiments/types/actions";
import type { MemorySlice } from "@experiments/types/memory";

/**
 * Anthropic accepts a single system message, and only as the first one: the
 * agent's identity, its memory and the experimenter's instructions for this
 * step, if any, are sent together.
 */
export function buildPrompt(params: {
	name: string;
	persona?: string;
	memory: MemorySlice;
	instructions?: readonly string[];
}): Prompt {
	// Without a persona the prompt is the one agents have always had.
	const base = `${params.persona ?? "You entered an empty chatbot."} Your name is ${params.name}.`;
	const history = memorySliceToPrompt(params.memory);

	const instructions =
		params.instructions === undefined || params.instructions.length === 0
			? ""
			: `\n<instructions>\n${params.instructions.join("\n")}\n</instructions>\n`;

	return [
		{ role: "system", content: `${base}\n${history.content}${instructions}` },
		{ role: "user", content: "Propose your next action." },
	];
}

import { memorySliceToPrompt } from "@experiments/engine";
import type { Prompt } from "@experiments/types/actions";
import type { MemorySlice } from "@experiments/types/memory";

/**
 * Anthropic accepts a single system message, and only as the first one: the
 * agent's identity and its memory are sent together.
 */
export function buildPrompt(params: {
	name: string;
	persona?: string;
	memory: MemorySlice;
}): Prompt {
	// Without a persona the prompt is the one agents have always had.
	const base = `${params.persona ?? "You entered an empty chatbot."} Your name is ${params.name}.`;
	const history = memorySliceToPrompt(params.memory);

	return [
		{ role: "system", content: `${base}\n${history.content}` },
		{ role: "user", content: "Propose your next action." },
	];
}

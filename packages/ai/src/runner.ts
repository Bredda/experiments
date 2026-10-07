import type { ModelCall, Prompt } from "@experiments/types/actions";
import type { Proposal } from "./proposal";

/** What a model answered, and what the call behind it was. */
export type RunnerResult = { proposal: Proposal; call: ModelCall };

/** Turns a prompt into the model's proposal. The only part that calls a model. */
export type ProposalRunner = (prompt: Prompt) => Promise<RunnerResult>;

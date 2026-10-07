import type { Prompt } from "@experiments/types/actions";
import type { Proposal } from "./proposal";

/** Turns a prompt into the model's proposal. The only part that calls a model. */
export type ProposalRunner = (prompt: Prompt) => Promise<Proposal>;

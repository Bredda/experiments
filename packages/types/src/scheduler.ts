import z from "zod";
import { actionSchema } from "./actions";
import { agentIdSchema } from "./ids";

export const candidateSchema = z.object({
	agentId: agentIdSchema,
	action: actionSchema,
});
export type Candidate = z.infer<typeof candidateSchema>;

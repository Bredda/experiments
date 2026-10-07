import {
	type ActionProposal,
	actionProposal,
	type ModelCall,
	type Prompt,
	speak,
	staySilent,
} from "@experiments/types/actions";
import type { AgentId, RoomId } from "@experiments/types/ids";
import z from "zod";

export const proposalSchema = z.object({
	reasoning: z
		.string()
		.describe(
			"Your private reasoning scratchpad. Will always be available to you.",
		),
	proposedAction: z
		.enum(["speak", "stay_silent"])
		.describe("The action you wish to perform"),
	messageContent: z
		.string()
		.optional()
		.describe(
			"Content of the message you wish to send. Only when 'speak' action is selected",
		),
	urgency: z.number().gte(0).lte(1).describe("Your urgency to speak"),
	confidence: z
		.number()
		.gte(0)
		.lte(1)
		.describe("Your confidence in your proposed action"),
});
export type Proposal = z.infer<typeof proposalSchema>;

export function toActionProposal(
	proposal: Proposal,
	agentId: AgentId,
	roomId: RoomId,
	prompt?: Prompt,
	meta?: ModelCall,
): ActionProposal {
	if (proposal.proposedAction === "speak") {
		return actionProposal({
			action: speak({
				agentId,
				roomId,
				content: proposal.messageContent ?? "",
				reasoning: proposal.reasoning,
				urgency: proposal.urgency,
			}),
			confidence: proposal.confidence,
			prompt,
			meta,
		});
	}

	return actionProposal({
		action: staySilent({ agentId, reasoning: proposal.reasoning }),
		confidence: proposal.confidence,
		prompt,
		meta,
	});
}

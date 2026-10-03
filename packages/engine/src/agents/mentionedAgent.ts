import type { Observation } from "@experiments/types";
import type { ActionProposal } from "@experiments/types/actions";
import { actionProposal, speak, staySilent } from "@experiments/types/actions";
import { Agent } from "../agent";

export class MentionedAgent extends Agent {
	propose(observation: Observation): ActionProposal {
		const messages = observation.room.visibleEvents.filter(
			(event) => event.type === "message.published",
		);

		if (messages.length === 0) {
			return actionProposal({
				action: speak({
					agentId: this.id,
					roomId: this.roomId,
					content: `${this.name}: je suis là.`,
					urgency: 0.2,
				}),
			});
		}

		const lastMessage = messages[messages.length - 1];

		if (
			lastMessage !== undefined &&
			lastMessage.agentId !== this.id &&
			lastMessage.content.toLowerCase().includes(this.name.toLowerCase())
		) {
			return actionProposal({
				action: speak({
					agentId: this.id,
					roomId: this.roomId,
					content: `${this.name}: j'ai été mentionné.`,
					urgency: 0.9,
				}),
			});
		}

		return actionProposal({
			action: staySilent({ agentId: this.id }),
		});
	}
}

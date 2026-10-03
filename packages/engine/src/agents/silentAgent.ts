import type { Observation } from "@experiments/types";
import type { ActionProposal } from "@experiments/types/actions";
import { actionProposal, staySilent } from "@experiments/types/actions";
import { Agent } from "../agent";

export class SilentAgent extends Agent {
	propose(_observation: Observation): ActionProposal {
		return actionProposal({
			action: staySilent({ agentId: this.id }),
		});
	}
}

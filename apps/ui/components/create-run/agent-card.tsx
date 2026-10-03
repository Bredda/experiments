import { Trash } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { type Agent, BEHAVIOR_LABELS, MEMORY_LABELS } from "./schemas";

export function AgentCard({
	agent,
	onRemove,
}: {
	agent: Agent;
	onRemove: () => void;
}) {
	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>{agent.name}</CardTitle>
				<CardDescription>
					{BEHAVIOR_LABELS[agent.behavior]} · {MEMORY_LABELS[agent.memory]}
				</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						onClick={onRemove}
						aria-label={`Remove agent ${agent.name}`}
					>
						<HugeiconsIcon icon={Trash} />
					</Button>
				</CardAction>
			</CardHeader>
		</Card>
	);
}

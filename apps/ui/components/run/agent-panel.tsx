import type { AnyEvent } from "@experiments/types/events";
import type { RunRecord } from "@experiments/types/run";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type AgentProposal, agentSummary } from "@/lib/run-view";

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-md border bg-card px-3 py-2">
			<div className="font-medium text-lg leading-none">{value}</div>
			<div className="mt-1 text-muted-foreground text-xs">{label}</div>
		</div>
	);
}

function ProposalRow({
	proposal,
	onSelectEvent,
}: {
	proposal: AgentProposal;
	onSelectEvent: (eventId: string) => void;
}) {
	const detail = proposal.content ?? proposal.reasoning;

	return (
		<button
			type="button"
			onClick={() => onSelectEvent(proposal.eventId)}
			className="flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
		>
			<span className="flex items-center gap-2 text-muted-foreground">
				<span className="font-medium text-foreground">
					Step {proposal.step}
				</span>
				<span>
					{proposal.type === "speak"
						? `speak · urgency ${proposal.urgency?.toFixed(1)}`
						: "stayed silent"}
				</span>
				{proposal.selected && <Badge variant="secondary">selected</Badge>}
			</span>
			{detail && <span className="line-clamp-2">{detail}</span>}
		</button>
	);
}

/** Read-only detail of one agent: its configuration, activity and latest proposals. */
export function AgentPanel({
	run,
	events,
	agentId,
	onSelectEvent,
}: {
	run: RunRecord;
	events: AnyEvent[];
	agentId: string;
	onSelectEvent: (eventId: string) => void;
}) {
	const summary = agentSummary(run, events, agentId);

	if (summary === undefined) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
				Agent {agentId} not found
			</div>
		);
	}

	return (
		<ScrollArea className="h-full">
			<div className="space-y-5 p-4">
				<div className="space-y-2">
					<h2 className="font-medium text-base">{summary.agentId}</h2>
					<div className="flex flex-wrap gap-1.5">
						<Badge variant="outline">behavior: {summary.behavior}</Badge>
						{summary.memory && (
							<Badge variant="outline">memory: {summary.memory}</Badge>
						)}
						{summary.roomId && (
							<Badge variant="outline">room: {summary.roomId}</Badge>
						)}
					</div>
				</div>

				<div className="grid grid-cols-3 gap-2">
					<Stat label="messages" value={summary.messageCount} />
					<Stat label="selected" value={summary.timesSelected} />
					<Stat label="silent" value={summary.silentProposals} />
				</div>

				<div className="space-y-1">
					<h3 className="font-medium text-muted-foreground text-xs">
						Latest proposals
					</h3>
					{summary.recentProposals.length === 0 ? (
						<p className="px-3 py-2 text-muted-foreground text-xs">
							No proposal yet
						</p>
					) : (
						summary.recentProposals.map((proposal) => (
							<ProposalRow
								key={proposal.eventId}
								proposal={proposal}
								onSelectEvent={onSelectEvent}
							/>
						))
					)}
				</div>
			</div>
		</ScrollArea>
	);
}

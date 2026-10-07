import type { AnyEvent } from "@experiments/types/events";
import type { RunRecord } from "@experiments/types/run";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	type AgentProposal,
	agentSummary,
	observationSummary,
} from "@/lib/run-view";
import { useStepObservations } from "./use-observations";

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

/** What the agent was given when it proposed at `step`, as the engine rebuilt it. */
function ObservationSection({
	runId,
	events,
	agentId,
	step,
	onSelectEvent,
}: {
	runId: string;
	events: AnyEvent[];
	agentId: string;
	step: number;
	onSelectEvent: (eventId: string) => void;
}) {
	const state = useStepObservations(runId, step);
	const observation =
		state.status === "ready"
			? state.observations.find((o) => o.agentId === agentId)
			: undefined;
	const summary = observation && observationSummary(observation, events);

	return (
		<div className="space-y-2">
			<h3 className="font-medium text-muted-foreground text-xs">
				Observed at step {step}
			</h3>
			{state.status === "loading" && (
				<p className="px-3 text-muted-foreground text-xs">Loading…</p>
			)}
			{state.status === "error" && (
				<p className="px-3 text-destructive text-xs">{state.message}</p>
			)}
			{state.status === "ready" && summary === undefined && (
				<p className="px-3 text-muted-foreground text-xs">
					No observation for this agent
				</p>
			)}
			{summary && (
				<div className="space-y-2 rounded-md border bg-card p-3 text-xs">
					<p className="text-muted-foreground">
						Room {summary.roomId} · members {summary.members.join(", ")}
					</p>
					<p className="text-muted-foreground">
						{summary.messages.length} message
						{summary.messages.length === 1 ? "" : "s"} visible ·{" "}
						{summary.earlierProposals} earlier proposal
						{summary.earlierProposals === 1 ? "" : "s"}
					</p>
					{summary.messages.length > 0 && (
						<ul className="space-y-1">
							{summary.messages.map((message) => (
								<li key={message.eventId}>
									<button
										type="button"
										onClick={() => onSelectEvent(message.eventId)}
										className="w-full rounded px-1 py-0.5 text-left hover:bg-muted"
									>
										<span className="font-medium">{message.agentId}</span>{" "}
										<span className="text-muted-foreground">
											(step {message.step})
										</span>{" "}
										{message.content}
									</button>
								</li>
							))}
						</ul>
					)}
					{summary.promptEventId && (
						<button
							type="button"
							onClick={() => onSelectEvent(summary.promptEventId as string)}
							className="font-medium underline-offset-2 hover:underline"
						>
							View the prompt sent at this step
						</button>
					)}
				</div>
			)}
		</div>
	);
}

/** Read-only detail of one agent: its configuration, activity and latest proposals. */
export function AgentPanel({
	run,
	events,
	agentId,
	step,
	onSelectEvent,
}: {
	run: RunRecord;
	events: AnyEvent[];
	agentId: string;
	/** The step the cursor shows; 0 means nothing has been proposed yet. */
	step: number;
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
						{summary.model && (
							<Badge variant="outline">model: {summary.model}</Badge>
						)}
						{summary.roomId && (
							<Badge variant="outline">room: {summary.roomId}</Badge>
						)}
					</div>
					{summary.persona && (
						<p className="whitespace-pre-wrap text-muted-foreground text-xs">
							{summary.persona}
						</p>
					)}
				</div>

				<div className="grid grid-cols-3 gap-2">
					<Stat label="messages" value={summary.messageCount} />
					<Stat label="selected" value={summary.timesSelected} />
					<Stat label="silent" value={summary.silentProposals} />
				</div>

				{step >= 1 && (
					<ObservationSection
						runId={run.runId}
						events={events}
						agentId={agentId}
						step={step}
						onSelectEvent={onSelectEvent}
					/>
				)}

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

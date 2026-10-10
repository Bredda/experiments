import type { AnyEvent } from "@experiments/types/events";
import type { RunRecord } from "@experiments/types/run";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { agentsOverview } from "@/lib/run-view";
import { AgentPanel } from "./agent-panel";
import { EventPanel } from "./event-panel";
import type { InterveneControls } from "./intervene-panel";
import type { RunSelection } from "./selection";

function selectionTitle(selection: RunSelection | null) {
	if (selection === null) return "Inspector";
	return selection.type === "event" ? "Event" : `Agent · ${selection.id}`;
}

/** What the panel shows before anything is selected: how to fill it, and the agents to start from. */
function EmptyInspector({
	run,
	onSelect,
}: {
	run: RunRecord;
	onSelect: (selection: RunSelection) => void;
}) {
	return (
		<ScrollArea className="h-full">
			<div className="space-y-4 p-4">
				<p className="text-muted-foreground text-sm">
					Select an event, a message or an agent to inspect it.
				</p>
				<div className="space-y-1">
					<h3 className="font-medium text-muted-foreground text-xs">Agents</h3>
					<ul className="space-y-0.5">
						{agentsOverview(run).map((agent) => (
							<li key={agent.agentId}>
								<button
									type="button"
									onClick={() => onSelect({ type: "agent", id: agent.agentId })}
									className="flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
								>
									<span className="font-medium text-sm">{agent.agentId}</span>
									<span className="text-muted-foreground">
										{agent.behavior}
										{agent.memory ? ` · memory ${agent.memory}` : ""}
										{agent.model ? ` · ${agent.model}` : ""}
									</span>
								</button>
							</li>
						))}
					</ul>
				</div>
			</div>
		</ScrollArea>
	);
}

/**
 * Right-hand panel: the detail of the current selection, with a close button.
 * Without a selection it says what to select and lists the agents.
 */
export function Inspector({
	run,
	selection,
	events,
	step,
	onSelect,
	onClose,
	intervene,
}: {
	run: RunRecord;
	selection: RunSelection | null;
	events: AnyEvent[];
	/** The step the cursor shows. */
	step: number;
	onSelect: (selection: RunSelection) => void;
	onClose: () => void;
	intervene: InterveneControls;
}) {
	const event =
		selection?.type === "event"
			? events.find((e) => e.id === selection.id)
			: undefined;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-10 shrink-0 items-center justify-between border-b px-4">
				<span className="truncate font-medium text-sm">
					{selectionTitle(selection)}
				</span>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onClose}
					aria-label="Close inspector"
				>
					<HugeiconsIcon icon={Cancel01Icon} />
				</Button>
			</div>
			{event && (
				<div className="flex shrink-0 items-center gap-2 border-b px-4 py-1.5 text-xs">
					<span className="text-muted-foreground">Agent</span>
					<button
						type="button"
						onClick={() => onSelect({ type: "agent", id: event.agentId })}
						className="font-medium underline-offset-2 hover:underline"
					>
						{event.agentId}
					</button>
				</div>
			)}
			<div className="min-h-0 flex-1">
				{selection === null ? (
					<EmptyInspector run={run} onSelect={onSelect} />
				) : selection.type === "agent" ? (
					<AgentPanel
						run={run}
						events={events}
						agentId={selection.id}
						step={step}
						onSelectEvent={(id) => onSelect({ type: "event", id })}
						intervene={intervene}
					/>
				) : event ? (
					<EventPanel
						event={event}
						events={events}
						className="h-full"
						onSelectEvent={(id) => onSelect({ type: "event", id })}
					/>
				) : (
					<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
						Event not found
					</div>
				)}
			</div>
		</div>
	);
}

import type { AnyEvent } from "@experiments/types/events";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { EventPanel } from "./event-panel";
import type { RunSelection } from "./selection";

function selectionTitle(selection: RunSelection) {
	return selection.type === "event" ? "Event" : "Agent";
}

/** Right-hand panel: the detail of the current selection, with a close button. */
export function Inspector({
	selection,
	events,
	onClose,
}: {
	selection: RunSelection;
	events: AnyEvent[];
	onClose: () => void;
}) {
	const event =
		selection.type === "event"
			? events.find((e) => e.id === selection.id)
			: undefined;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-10 shrink-0 items-center justify-between border-b px-4">
				<span className="font-medium text-sm">{selectionTitle(selection)}</span>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onClose}
					aria-label="Close inspector"
				>
					<HugeiconsIcon icon={Cancel01Icon} />
				</Button>
			</div>
			<div className="min-h-0 flex-1">
				{event ? (
					<EventPanel event={event} events={events} className="h-full" />
				) : (
					<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
						{selection.type === "agent"
							? `Agent ${selection.id}`
							: "Event not found"}
					</div>
				)}
			</div>
		</div>
	);
}

import type { AnyEvent } from "@experiments/types/events";
import { ArrowRight } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "../ui/button";
import { FieldSeparator } from "../ui/field";

function formatTime(timestamp: string) {
	return new Date(timestamp).toLocaleTimeString("fr-FR", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function eventLabel(event: AnyEvent) {
	switch (event.type) {
		case "agent.joined":
			return `Agent joined - ${event.agentId} `;

		case "action.proposed":
			return `Proposed - ${event.agentId} - ${event.action?.type} `;

		case "action.selected":
			return `Selected  - ${event.agentId} - ${event.action?.type} `;

		case "message.published":
			return event.content ?? "Message published";

		default:
			return event.type;
	}
}

function groupByStep(events: AnyEvent[]) {
	return events.reduce(
		(acc, event) => {
			if (!acc[event.step]) {
				acc[event.step] = [];
			}
			acc[event.step].push(event);
			return acc;
		},
		[] as Array<AnyEvent[]>,
	);
}

function StepMetadatas({ events }: { events: AnyEvent[] }) {
	return (
		<div className="text-center text-xs text-muted-foreground">
			{formatTime(events[0].timestamp)} · {events.length} events
		</div>
	);
}

export function RunEvents({
	events,
	selected,
	onSelect,
}: {
	events: AnyEvent[];
	selected?: string | null;
	onSelect?: (eventId: string) => void;
}) {
	const groupedEvents = groupByStep(
		events.filter((event) => event.type !== "agent.prompt_built"),
	);
	// biome-ignore lint/suspicious/noExplicitAny: accepts any anchor/button click event
	const handleSelected = (e: any, eventId: string) => {
		e.preventDefault();
		onSelect?.(eventId);
	};
	return (
		<div className="h-full">
			<div className="p-4">
				<div>Toolbar</div>
				<div>
					<Button>button A</Button>
					<Button>button B</Button>
				</div>
			</div>
			<ScrollArea className="h-full">
				{groupedEvents.length === 0 ? (
					<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
						No events
					</div>
				) : (
					<div className="space-y-4 pt-4">
						{groupedEvents.map((item, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: steps are positional, the index is the step number
							<div className="space-y-2" key={index}>
								<FieldSeparator className="mb-2">Step {index}</FieldSeparator>
								<StepMetadatas events={item} />
								{item.map((event) => (
									<Item
										variant={selected === event.id ? "default" : "muted"}
										key={`event_${event.id}`}
										render={
											<Link
												href="#"
												onClick={(e) => handleSelected(e, event.id)}
											>
												<ItemContent>
													<ItemTitle>{eventLabel(event)}</ItemTitle>
												</ItemContent>
												<ItemActions>
													<HugeiconsIcon icon={ArrowRight} className="size-4" />
												</ItemActions>
											</Link>
										}
									/>
								))}
							</div>
						))}
					</div>
				)}
			</ScrollArea>
		</div>
	);
}

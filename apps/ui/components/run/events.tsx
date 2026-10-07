import type { AnyEvent } from "@experiments/types/events";
import { ArrowRight, FilterIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	appliesAtStep,
	EVENT_TYPES,
	type EventFilter,
	type EventType,
	filterEvents,
	NO_FILTER,
} from "@/lib/run-view";
import { cn } from "@/lib/utils";
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

		case "intervention.prompt_injected":
			return `Instruction - ${event.agentId} - applies at step ${appliesAtStep(event)}`;

		case "intervention.memory_redacted":
			return `Redacted - ${event.agentId} - applies at step ${appliesAtStep(event)}`;

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

function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
	const next = new Set(set);
	if (!next.delete(value)) next.add(value);
	return next;
}

function FilterMenu({
	agentIds,
	filter,
	onFilter,
}: {
	agentIds: string[];
	filter: EventFilter;
	onFilter: (filter: EventFilter) => void;
}) {
	const active = filter.agentIds.size + filter.types.size;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant={active > 0 ? "secondary" : "ghost"}
						size="icon-sm"
						aria-label="Filter events"
					/>
				}
			>
				<HugeiconsIcon icon={FilterIcon} />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Agents</DropdownMenuLabel>
					{agentIds.map((agentId) => (
						<DropdownMenuCheckboxItem
							key={agentId}
							checked={filter.agentIds.has(agentId)}
							onCheckedChange={() =>
								onFilter({
									...filter,
									agentIds: toggled(filter.agentIds, agentId),
								})
							}
						>
							{agentId}
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuLabel>Event types</DropdownMenuLabel>
					{EVENT_TYPES.map((type: EventType) => (
						<DropdownMenuCheckboxItem
							key={type}
							checked={filter.types.has(type)}
							onCheckedChange={() =>
								onFilter({ ...filter, types: toggled(filter.types, type) })
							}
						>
							{type}
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuGroup>
				{active > 0 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuCheckboxItem
							checked={false}
							onCheckedChange={() => onFilter(NO_FILTER)}
						>
							Reset filters
						</DropdownMenuCheckboxItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function RunEvents({
	events,
	agentIds,
	filter,
	onFilter,
	selected,
	onSelect,
}: {
	events: AnyEvent[];
	agentIds: string[];
	filter: EventFilter;
	onFilter: (filter: EventFilter) => void;
	selected?: string | null;
	onSelect?: (eventId: string) => void;
}) {
	// Prompts are long and have their own view: they only show when asked for.
	const filtered = filterEvents(events, filter);
	const shown =
		filter.types.size === 0
			? filtered.filter((event) => event.type !== "agent.prompt_built")
			: filtered;
	const groupedEvents = groupByStep(shown);
	// biome-ignore lint/suspicious/noExplicitAny: accepts any anchor/button click event
	const handleSelected = (e: any, eventId: string) => {
		e.preventDefault();
		onSelect?.(eventId);
	};
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-10 shrink-0 items-center justify-between border-b px-4">
				<span className="flex items-center gap-1 font-medium text-sm">
					<FilterMenu agentIds={agentIds} filter={filter} onFilter={onFilter} />
					Events
				</span>
				<span className="text-muted-foreground text-xs">
					{shown.length} / {events.length}
				</span>
			</div>
			<ScrollArea className="min-h-0 flex-1">
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
										variant="default"
										key={`event_${event.id}`}
										// The item's own anchor hover (bg-muted) would override a
										// plain class, so the selected look is forced with `!`.
										className={cn(
											selected === event.id &&
												"border-primary/50 bg-primary/10! hover:bg-primary/15!",
										)}
										render={
											<Link
												href="#"
												aria-current={
													selected === event.id ? "true" : undefined
												}
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

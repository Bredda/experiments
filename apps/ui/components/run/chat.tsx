"use client";

import type { AnyEvent } from "@experiments/types/events";
import {
	Eraser01Icon,
	MagicWand01Icon,
	Target01Icon,
	UserAdd01Icon,
	VolumeMute02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
	Message,
	MessageAvatar,
	MessageContent,
	MessageHeader,
} from "@/components/ui/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
	agentInitials,
	buildTimeline,
	type TimelineItem,
} from "@/lib/run-view";
import { cn } from "@/lib/utils";
import { Hint } from "./hint";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	timeZone: "UTC",
});

/** A marker that opens the event it comes from. */
function ClickableMarker({
	selected,
	onSelect,
	children,
}: {
	selected: boolean;
	onSelect: () => void;
	children: React.ReactNode;
}) {
	return (
		<Hint label="Open event details">
			<Marker
				render={
					<button
						type="button"
						onClick={onSelect}
						aria-pressed={selected}
						className={cn(
							"rounded-md px-1 py-0.5 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
							selected && "bg-muted text-foreground",
						)}
					/>
				}
			>
				{children}
			</Marker>
		</Hint>
	);
}

function TimelineEntry({
	item,
	selectedEventId,
	selectedAgentId,
	onSelectEvent,
	onSelectAgent,
}: {
	item: TimelineItem;
	selectedEventId: string | null;
	selectedAgentId: string | null;
	onSelectEvent: (eventId: string) => void;
	onSelectAgent: (agentId: string) => void;
}) {
	switch (item.kind) {
		case "step":
			return (
				<Marker variant="separator">
					<MarkerContent>
						Step {item.step} · {timeFormat.format(new Date(item.time))}
					</MarkerContent>
				</Marker>
			);

		case "joined":
			return (
				<ClickableMarker
					selected={selectedEventId === item.eventId}
					onSelect={() => onSelectEvent(item.eventId)}
				>
					<MarkerIcon>
						<HugeiconsIcon icon={UserAdd01Icon} />
					</MarkerIcon>
					<MarkerContent>{item.agentId} joined</MarkerContent>
				</ClickableMarker>
			);

		case "silence":
			return (
				<Marker>
					<MarkerIcon>
						<HugeiconsIcon icon={VolumeMute02Icon} />
					</MarkerIcon>
					<MarkerContent>Silence: nobody spoke</MarkerContent>
				</Marker>
			);

		case "selection":
			return (
				<ClickableMarker
					selected={selectedEventId === item.eventId}
					onSelect={() => onSelectEvent(item.eventId)}
				>
					<MarkerIcon>
						<HugeiconsIcon icon={Target01Icon} />
					</MarkerIcon>
					<MarkerContent>
						{item.selected} chosen over{" "}
						{item.candidates
							.filter((candidate) => candidate.agentId !== item.selected)
							.map((candidate) => candidate.agentId)
							.join(", ")}{" "}
						(
						{item.candidates
							.map(
								(candidate) =>
									`${candidate.agentId} ${candidate.urgency.toFixed(1)}`,
							)
							.join(" · ")}
						)
					</MarkerContent>
				</ClickableMarker>
			);

		case "intervention":
			return (
				<ClickableMarker
					selected={selectedEventId === item.eventId}
					onSelect={() => onSelectEvent(item.eventId)}
				>
					<MarkerIcon>
						<HugeiconsIcon
							icon={
								item.type === "intervention.memory_redacted"
									? Eraser01Icon
									: MagicWand01Icon
							}
						/>
					</MarkerIcon>
					<MarkerContent>
						{item.label} · applies at step {item.appliesAt}
					</MarkerContent>
				</ClickableMarker>
			);

		case "message":
			return (
				<Message>
					<MessageAvatar>
						<Hint label={`Inspect ${item.agentId}`}>
							<button
								type="button"
								onClick={() => onSelectAgent(item.agentId)}
								aria-label={`Inspect ${item.agentId}`}
								aria-pressed={selectedAgentId === item.agentId}
								className="rounded-full outline-none hover:ring-2 hover:ring-ring/40 focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-primary"
							>
								<Avatar size="sm">
									<AvatarFallback>{agentInitials(item.agentId)}</AvatarFallback>
								</Avatar>
							</button>
						</Hint>
					</MessageAvatar>
					<MessageContent>
						<MessageHeader>
							<Hint label={`Inspect ${item.agentId}`}>
								<button
									type="button"
									onClick={() => onSelectAgent(item.agentId)}
									className="rounded-sm underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
								>
									{item.agentId}
								</button>
							</Hint>
						</MessageHeader>
						<Bubble
							variant={selectedEventId === item.eventId ? "tinted" : "muted"}
						>
							<Hint label="Open event details">
								<BubbleContent
									render={
										<button
											type="button"
											onClick={() => onSelectEvent(item.eventId)}
										/>
									}
									className="whitespace-pre-wrap rounded-[inherit] outline-none transition-opacity hover:opacity-75 focus-visible:ring-2 focus-visible:ring-ring/50"
								>
									{item.content}
								</BubbleContent>
							</Hint>
						</Bubble>
					</MessageContent>
				</Message>
			);
	}
}

/** Chat-style timeline of a run, following the newest entry as steps are added. */
export function Chat({
	events,
	roomId,
	selectedEventId,
	selectedAgentId,
	onSelectEvent,
	onSelectAgent,
}: {
	events: AnyEvent[];
	roomId: string | null;
	selectedEventId: string | null;
	selectedAgentId: string | null;
	onSelectEvent: (eventId: string) => void;
	onSelectAgent: (agentId: string) => void;
}) {
	const items = useMemo(() => buildTimeline(events, roomId), [events, roomId]);

	if (items.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
				Nothing happened yet
			</div>
		);
	}

	return (
		<MessageScrollerProvider autoScroll defaultScrollPosition="end">
			<MessageScroller>
				<MessageScrollerViewport>
					<MessageScrollerContent className="gap-3 p-4">
						{items.map((item) => (
							<MessageScrollerItem key={item.key} messageId={item.key}>
								<TimelineEntry
									item={item}
									selectedEventId={selectedEventId}
									selectedAgentId={selectedAgentId}
									onSelectEvent={onSelectEvent}
									onSelectAgent={onSelectAgent}
								/>
							</MessageScrollerItem>
						))}
					</MessageScrollerContent>
				</MessageScrollerViewport>
				<MessageScrollerButton variant="secondary" size="icon-sm" />
			</MessageScroller>
		</MessageScrollerProvider>
	);
}

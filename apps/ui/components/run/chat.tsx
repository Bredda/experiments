"use client";

import type { AnyEvent } from "@experiments/types/events";
import {
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
import { buildTimeline, type TimelineItem } from "@/lib/run-view";
import { cn } from "@/lib/utils";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	timeZone: "UTC",
});

function initials(name: string) {
	return name.slice(0, 2).toUpperCase();
}

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
		<Marker
			render={
				<button
					type="button"
					onClick={onSelect}
					aria-pressed={selected}
					className={cn(
						"rounded-md px-1 py-0.5 transition-colors hover:text-foreground",
						selected && "bg-muted text-foreground",
					)}
				/>
			}
		>
			{children}
		</Marker>
	);
}

function TimelineEntry({
	item,
	selectedEventId,
	onSelectEvent,
}: {
	item: TimelineItem;
	selectedEventId: string | null;
	onSelectEvent: (eventId: string) => void;
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

		case "message":
			return (
				<Message>
					<MessageAvatar>
						<Avatar size="sm">
							<AvatarFallback>{initials(item.agentId)}</AvatarFallback>
						</Avatar>
					</MessageAvatar>
					<MessageContent>
						<MessageHeader>{item.agentId}</MessageHeader>
						<Bubble
							variant={selectedEventId === item.eventId ? "tinted" : "muted"}
						>
							<BubbleContent
								render={
									<button
										type="button"
										onClick={() => onSelectEvent(item.eventId)}
									/>
								}
								className="whitespace-pre-wrap"
							>
								{item.content}
							</BubbleContent>
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
	onSelectEvent,
}: {
	events: AnyEvent[];
	roomId: string | null;
	selectedEventId: string | null;
	onSelectEvent: (eventId: string) => void;
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
									onSelectEvent={onSelectEvent}
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

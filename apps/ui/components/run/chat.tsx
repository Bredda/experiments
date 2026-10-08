"use client";

import type { AnyEvent } from "@experiments/types/events";
import { interventionSchema } from "@experiments/types/interventions";
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
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "@/components/ui/toast";
import {
	agentInitials,
	buildTimeline,
	messageRedactionTargets,
	type TimelineItem,
} from "@/lib/run-view";
import { cn } from "@/lib/utils";
import { Hint } from "./hint";
import type { InterveneControls } from "./intervene-panel";

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

/** Shown while the pointer is over the entry or focus is inside it, and always without a pointer. */
const REVEALED_ON_HOVER =
	"opacity-0 transition-opacity group-hover/marker:opacity-100 group-hover/message:opacity-100 focus-within:opacity-100 has-aria-expanded:opacity-100 [@media(hover:none)]:opacity-100";

/** At the end of a step separator: replay the run from there, or fork it there. */
function StepActions({
	step,
	onGoToStep,
	onForkAt,
}: {
	step: number;
	onGoToStep: (step: number) => void;
	onForkAt: (step: number) => void;
}) {
	return (
		<span
			className={cn(
				"absolute right-0 flex gap-1 bg-background pl-2",
				REVEALED_ON_HOVER,
			)}
		>
			<Hint label={`Show the run as it was at step ${step}`}>
				<Button variant="ghost" size="xs" onClick={() => onGoToStep(step)}>
					Go to step {step}
				</Button>
			</Hint>
			<Hint label={`Start a new run from step ${step}`}>
				<Button variant="ghost" size="xs" onClick={() => onForkAt(step)}>
					Fork here
				</Button>
			</Hint>
		</span>
	);
}

/** What the menu items do, in the words of the intervene tab. */
function redactionConsequence({ target }: InterveneControls) {
	if (!target.available) {
		return `The run ends at step ${target.step}: there is no next step to apply it to.`;
	}
	return target.mode === "queue"
		? `Removed from the agent's view at step ${target.appliesAt}, recorded with the next step.`
		: `Removed from the agent's view at step ${target.appliesAt} in a fork made at step ${target.step}.`;
}

function RedactItems({
	events,
	eventId,
	intervene,
}: {
	events: readonly AnyEvent[];
	eventId: string;
	intervene: InterveneControls;
}) {
	const { target, drafts, onAdd } = intervene;
	const drafted = (agentId: string) =>
		drafts.some(
			(draft) =>
				draft.type === "intervention.memory_redacted" &&
				draft.agentId === agentId &&
				draft.targetEventId === eventId,
		);

	return (
		<>
			<DropdownMenuGroup>
				<DropdownMenuLabel className="whitespace-normal">
					{redactionConsequence(intervene)}
				</DropdownMenuLabel>
			</DropdownMenuGroup>
			<DropdownMenuSeparator />
			{messageRedactionTargets(events, eventId).map((entry) => (
				<DropdownMenuItem
					key={entry.agentId}
					disabled={
						!target.available || entry.redacted || drafted(entry.agentId)
					}
					onClick={() => {
						onAdd(
							interventionSchema.parse({
								type: "intervention.memory_redacted",
								agentId: entry.agentId,
								targetEventId: eventId,
							}),
						);
						toast.add({
							type: "success",
							description:
								target.mode === "queue"
									? `Redaction from ${entry.agentId} queued for step ${target.appliesAt}.`
									: `Redaction from ${entry.agentId} added: use Fork to apply it at step ${target.appliesAt}.`,
						});
					}}
				>
					Redact from {entry.agentId}
					{entry.redacted
						? " (already redacted)"
						: drafted(entry.agentId)
							? " (pending)"
							: ""}
				</DropdownMenuItem>
			))}
		</>
	);
}

/** Under a message: inspect its author, or take it out of what an agent remembers. */
function MessageActions({
	agentId,
	eventId,
	events,
	intervene,
	onSelectAgent,
}: {
	agentId: string;
	eventId: string;
	events: readonly AnyEvent[];
	intervene: InterveneControls;
	onSelectAgent: (agentId: string) => void;
}) {
	return (
		<span className={cn("ml-2 inline-flex gap-1", REVEALED_ON_HOVER)}>
			<Button variant="ghost" size="xs" onClick={() => onSelectAgent(agentId)}>
				Inspect {agentId}
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="ghost" size="xs" />}>
					Redact from…
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-72">
					<RedactItems
						events={events}
						eventId={eventId}
						intervene={intervene}
					/>
				</DropdownMenuContent>
			</DropdownMenu>
		</span>
	);
}

function TimelineEntry({
	item,
	events,
	selectedEventId,
	selectedAgentId,
	onSelectEvent,
	onSelectAgent,
	onGoToStep,
	onForkAt,
	intervene,
}: {
	item: TimelineItem;
	events: readonly AnyEvent[];
	selectedEventId: string | null;
	selectedAgentId: string | null;
	onSelectEvent: (eventId: string) => void;
	onSelectAgent: (agentId: string) => void;
	onGoToStep: (step: number) => void;
	onForkAt: (step: number) => void;
	intervene: InterveneControls;
}) {
	switch (item.kind) {
		case "step":
			return (
				<Marker variant="separator">
					<MarkerContent>
						Step {item.step} · {timeFormat.format(new Date(item.time))}
					</MarkerContent>
					<StepActions
						step={item.step}
						onGoToStep={onGoToStep}
						onForkAt={onForkAt}
					/>
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
							<MessageActions
								agentId={item.agentId}
								eventId={item.eventId}
								events={events}
								intervene={intervene}
								onSelectAgent={onSelectAgent}
							/>
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
	onGoToStep,
	onForkAt,
	intervene,
}: {
	events: AnyEvent[];
	roomId: string | null;
	selectedEventId: string | null;
	selectedAgentId: string | null;
	onSelectEvent: (eventId: string) => void;
	onSelectAgent: (agentId: string) => void;
	/** Moves the time cursor to a step. */
	onGoToStep: (step: number) => void;
	/** Moves the time cursor to a step and opens the fork sheet there. */
	onForkAt: (step: number) => void;
	intervene: InterveneControls;
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
									events={events}
									selectedEventId={selectedEventId}
									selectedAgentId={selectedAgentId}
									onSelectEvent={onSelectEvent}
									onSelectAgent={onSelectAgent}
									onGoToStep={onGoToStep}
									onForkAt={onForkAt}
									intervene={intervene}
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

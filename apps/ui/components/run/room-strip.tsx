import { BubbleChatIcon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { RoomSummary } from "@/lib/run-view";
import { cn } from "@/lib/utils";

function RoomCard({
	title,
	selected,
	onSelect,
	children,
}: {
	title: string;
	selected: boolean;
	onSelect: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			aria-pressed={selected}
			className={cn(
				"flex w-44 shrink-0 flex-col gap-1.5 rounded-lg border bg-card p-3 text-left text-xs transition-colors hover:bg-muted/50",
				selected && "border-primary ring-1 ring-primary",
			)}
		>
			<span className="truncate font-medium text-sm">{title}</span>
			{children}
		</button>
	);
}

function Meta({
	icon,
	children,
}: {
	icon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
	children: React.ReactNode;
}) {
	return (
		<span className="flex items-center gap-1 text-muted-foreground">
			<HugeiconsIcon icon={icon} className="size-3.5" />
			{children}
		</span>
	);
}

/**
 * Rooms of the run as selectable cards; the selection filters the timeline.
 * `selected` is a room id, or null for all rooms. The "All rooms" card only
 * appears when there are several rooms to choose between.
 */
export function RoomStrip({
	rooms,
	selected,
	onSelect,
}: {
	rooms: RoomSummary[];
	selected: string | null;
	onSelect: (roomId: string | null) => void;
}) {
	const totalMessages = rooms.reduce((sum, r) => sum + r.messageCount, 0);
	const totalAgents = rooms.reduce((sum, r) => sum + r.memberIds.length, 0);

	return (
		<div className="flex gap-2 overflow-x-auto pb-1">
			{rooms.length > 1 && (
				<RoomCard
					title="All rooms"
					selected={selected === null}
					onSelect={() => onSelect(null)}
				>
					<Meta icon={UserIcon}>{totalAgents} agents</Meta>
					<Meta icon={BubbleChatIcon}>{totalMessages} messages</Meta>
				</RoomCard>
			)}
			{rooms.map((room) => (
				<RoomCard
					key={room.roomId}
					title={room.roomId}
					selected={selected === room.roomId}
					onSelect={() => onSelect(room.roomId)}
				>
					<Meta icon={UserIcon}>
						{room.memberIds.length}{" "}
						{room.memberIds.length === 1 ? "agent" : "agents"}
					</Meta>
					<Meta icon={BubbleChatIcon}>
						{room.messageCount}{" "}
						{room.messageCount === 1 ? "message" : "messages"}
						{room.lastSpeaker ? ` · last ${room.lastSpeaker}` : ""}
					</Meta>
					<span className="text-muted-foreground">
						{room.silentSteps} silent{" "}
						{room.silentSteps === 1 ? "step" : "steps"}
					</span>
				</RoomCard>
			))}
		</div>
	);
}

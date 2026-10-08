import { BubbleChatIcon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { agentInitials, type RoomSummary } from "@/lib/run-view";
import { cn } from "@/lib/utils";

/**
 * The card selects the room; `footer` sits under the room button rather than
 * inside it, since a button cannot hold other buttons.
 */
function RoomCard({
	title,
	selected,
	onSelect,
	children,
	footer,
}: {
	title: string;
	selected: boolean;
	onSelect: () => void;
	children: React.ReactNode;
	footer?: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex w-44 shrink-0 flex-col rounded-lg border bg-card text-xs transition-colors",
				selected && "border-primary ring-1 ring-primary",
			)}
		>
			<button
				type="button"
				onClick={onSelect}
				aria-pressed={selected}
				className="flex flex-col gap-1.5 rounded-lg p-3 text-left hover:bg-muted/50"
			>
				<span className="truncate font-medium text-sm">{title}</span>
				{children}
			</button>
			{footer}
		</div>
	);
}

/** One avatar per member, so an agent that never spoke can be opened too. */
function Members({
	memberIds,
	selectedAgentId,
	onSelectAgent,
}: {
	memberIds: string[];
	selectedAgentId: string | null;
	onSelectAgent: (agentId: string) => void;
}) {
	return (
		<div className="flex flex-wrap gap-1 px-3 pb-3">
			{memberIds.map((agentId) => (
				<button
					key={agentId}
					type="button"
					onClick={() => onSelectAgent(agentId)}
					aria-label={`Show ${agentId}`}
					aria-pressed={selectedAgentId === agentId}
					title={agentId}
					className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-primary"
				>
					<Avatar size="sm">
						<AvatarFallback>{agentInitials(agentId)}</AvatarFallback>
					</Avatar>
				</button>
			))}
		</div>
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
	selectedAgentId,
	onSelectAgent,
}: {
	rooms: RoomSummary[];
	selected: string | null;
	onSelect: (roomId: string | null) => void;
	selectedAgentId: string | null;
	onSelectAgent: (agentId: string) => void;
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
					footer={
						<Members
							memberIds={room.memberIds}
							selectedAgentId={selectedAgentId}
							onSelectAgent={onSelectAgent}
						/>
					}
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

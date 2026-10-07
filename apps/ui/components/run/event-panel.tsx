import type {
	ActionProposed,
	AgentJoined,
	AgentPromptBuilt,
	AnyEvent,
} from "@experiments/types/events";
import { modelCallLabel } from "@/lib/run-view";
import { cn } from "@/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";

function RenderAgentJoined({
	event,
	className,
}: {
	event: AgentJoined;
	className?: string;
}) {
	return (
		<Card className={cn(className)}>
			<CardHeader>
				<CardTitle>Agent joined: {event.agentId}</CardTitle>
				<CardDescription>
					id: {event.id} * {event.timestamp} * Step {event.step}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<p>No further data</p>
			</CardContent>
		</Card>
	);
}

function findPromptFor(events: AnyEvent[], event: ActionProposed) {
	return events.find(
		(e): e is AgentPromptBuilt =>
			e.type === "agent.prompt_built" &&
			e.step === event.step &&
			e.agentId === event.agentId,
	);
}

function RenderActionProposed({
	event,
	events,
	className,
}: {
	event: ActionProposed;
	events: AnyEvent[];
	className?: string;
}) {
	const prompt = findPromptFor(events, event);
	const modelCall = prompt && modelCallLabel(prompt);

	return (
		<Card className={cn(className)}>
			<CardHeader>
				<CardTitle>
					Proposed - {event.agentId} - {event.action?.type}
				</CardTitle>
				<CardDescription>
					id: {event.id} * {event.timestamp} * Step {event.step}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<pre className="text-xs whitespace-pre-wrap">
					{JSON.stringify(event.action, null, 2)}
				</pre>
				{prompt && (
					<div className="space-y-2">
						<p className="text-sm font-medium">Prompt used</p>
						{modelCall && (
							<p className="text-xs text-muted-foreground">{modelCall}</p>
						)}
						{prompt.prompt.map((message, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: prompt messages have no stable id and the list is static
							<div key={`message-${index}`} className="space-y-1">
								<p className="text-xs text-muted-foreground">{message.role}</p>
								<pre className="text-xs whitespace-pre-wrap">
									{message.content}
								</pre>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function RenderGenericEvent({
	event,
	className,
}: {
	event: AnyEvent;
	className?: string;
}) {
	return (
		<Card className={cn(className)}>
			<CardHeader>
				<CardTitle>{event.type}</CardTitle>
				<CardDescription>
					id: {event.id} * {event.timestamp} * Step {event.step}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<pre className="text-xs whitespace-pre-wrap">
					{JSON.stringify(event, null, 2)}
				</pre>
			</CardContent>
		</Card>
	);
}

export function EventPanel({
	event,
	events,
	className,
}: {
	event: AnyEvent;
	events: AnyEvent[];
	className?: string;
}) {
	return (
		<ScrollArea className={cn(className)}>
			{event.type === "agent.joined" && (
				<RenderAgentJoined event={event} className="h-full" />
			)}
			{event.type === "action.proposed" && (
				<RenderActionProposed
					event={event}
					events={events}
					className="h-full"
				/>
			)}
			{event.type !== "agent.joined" && event.type !== "action.proposed" && (
				<RenderGenericEvent event={event} className="h-full" />
			)}
		</ScrollArea>
	);
}

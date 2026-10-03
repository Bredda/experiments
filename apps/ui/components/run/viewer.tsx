"use client";

import type { AnyEvent } from "@experiments/types/events";
import { useState } from "react";
import { EventPanel } from "./event-panel";
import { RunEvents } from "./events";

export function RunViewer({ events }: { events: AnyEvent[] }) {
	const [event, setEvent] = useState<AnyEvent | null>(null);
	console.log(events);
	const handleSelectEvent = (eventId: string) => {
		const event = events.find((e) => e.id === eventId);
		if (!event) {
			const message = `Unknown event ${eventId}`;
			console.error(message);
			throw Error(message);
		}
		setEvent(event);
	};

	return (
		<main className="h-screen pt-14">
			<div className="grid h-full min-h-0 grid-cols-[420px_minmax(0,1fr)_360px]">
				<aside className="min-h-0 border-r">
					<RunEvents
						events={events}
						onSelect={handleSelectEvent}
						selected={event?.id}
					/>
				</aside>
				<section className="min-h-0 overflow-hidden">This will be main</section>
				<aside className="min-h-0 border-r">
					{event ? (
						<EventPanel event={event} events={events} className="h-full" />
					) : (
						<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
							Select an event
						</div>
					)}
				</aside>
			</div>
		</main>
	);
}

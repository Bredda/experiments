"use client";

import { HelpCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { markHintSeen, useHintSeen } from "@/lib/hints";
import { Hint } from "./hint";

const HINT_ID = "run-legend";

const ITEMS: { title: string; text: string }[] = [
	{
		title: "Inspect",
		text: "Click an event, a message or an agent to open it in the inspector on the right. Without a selection the inspector lists the agents.",
	},
	{
		title: "Replay",
		text: "Move the slider or use the arrows next to it to see the run as it was at a step. “Back to live” follows the run again.",
	},
	{
		title: "Run",
		text: "Next step plays one step, Play keeps going until the run ends or you pause it.",
	},
	{
		title: "Fork",
		text: "Fork starts a new run from the step you are looking at, to see what happens next from the same history. In the chat, “Fork here” on a step does the same from that step.",
	},
	{
		title: "Intervene",
		text: "Select an agent and open its Intervene tab to give it an instruction for one step, or remove a message from what it remembers (“Redact from…” on a message does the latter). Interventions go with the next step of a live run, or with a fork when you are on a past step.",
	},
	{
		title: "Rooms and events",
		text: "The cards above the chat filter it by room. The event viewer on the left is the raw log: it is the source of truth for everything else.",
	},
];

/** A “?” button in the control bar: a short legend of the page, marked “new” until it was opened once. */
export function Legend() {
	const [open, setOpen] = useState(false);
	const seen = useHintSeen(HINT_ID);

	return (
		<>
			<Hint label="How this page works">
				<Button
					variant="ghost"
					size="icon-sm"
					className="relative"
					onClick={() => {
						setOpen(true);
						markHintSeen(HINT_ID);
					}}
					aria-label={
						seen ? "How this page works" : "How this page works (new)"
					}
				>
					<HugeiconsIcon icon={HelpCircleIcon} />
					{!seen && (
						<span
							aria-hidden="true"
							data-testid="new-dot"
							className="absolute top-0.5 right-0.5 size-2 rounded-full bg-primary"
						/>
					)}
				</Button>
			</Hint>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>How this page works</DialogTitle>
						<DialogDescription>
							A run is replayed step by step: everything you see belongs to the
							step the slider is on.
						</DialogDescription>
					</DialogHeader>
					<dl className="space-y-3 text-sm">
						{ITEMS.map((item) => (
							<div key={item.title}>
								<dt className="font-medium">{item.title}</dt>
								<dd className="text-muted-foreground">{item.text}</dd>
							</div>
						))}
					</dl>
				</DialogContent>
			</Dialog>
		</>
	);
}

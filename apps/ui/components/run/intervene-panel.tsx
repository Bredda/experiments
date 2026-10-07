"use client";

import {
	type Intervention,
	interventionSchema,
} from "@experiments/types/interventions";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
	AgentSummary,
	InterventionTarget,
	RedactionCandidate,
} from "@/lib/run-view";

/** What the intervene tab needs to prepare interventions, and where they go. */
export type InterveneControls = {
	target: InterventionTarget;
	drafts: readonly Intervention[];
	onAdd: (intervention: Intervention) => void;
	onRemove: (index: number) => void;
};

/** The button label says the consequence: queued for the next step, or in a fork. */
function addLabel(target: InterventionTarget) {
	return target.mode === "queue"
		? `Queue for step ${target.appliesAt}`
		: `Add to a fork at step ${target.step}`;
}

function Consequence({ target }: { target: InterventionTarget }) {
	if (!target.available) {
		return (
			<p className="rounded-md border bg-card p-3 text-muted-foreground text-xs">
				The run ends at step {target.step}: there is no next step to apply an
				intervention to.
			</p>
		);
	}

	return (
		<p className="rounded-md border bg-card p-3 text-muted-foreground text-xs">
			{target.mode === "queue"
				? `Takes effect at step ${target.appliesAt}, recorded with the next step of this run.`
				: `Takes effect at step ${target.appliesAt} in a new run forked at step ${target.step}. This run is not modified.`}
		</p>
	);
}

function InstructionForm({
	agentId,
	target,
	onAdd,
}: {
	agentId: string;
	target: InterventionTarget;
	onAdd: (intervention: Intervention) => void;
}) {
	const [content, setContent] = useState("");
	const text = content.trim();

	return (
		<div className="space-y-2">
			<h3 className="font-medium text-muted-foreground text-xs">
				System instruction
			</h3>
			<Textarea
				value={content}
				onChange={(event) => setContent(event.target.value)}
				maxLength={2000}
				placeholder={`Added to ${agentId}'s prompt at step ${target.appliesAt} only`}
				aria-label="System instruction"
			/>
			<Button
				size="sm"
				disabled={text === "" || !target.available}
				onClick={() => {
					onAdd(
						interventionSchema.parse({
							type: "intervention.prompt_injected",
							agentId,
							content: text,
						}),
					);
					setContent("");
				}}
			>
				{addLabel(target)}
			</Button>
		</div>
	);
}

function RedactionRow({
	candidate,
	drafted,
	target,
	onRedact,
	onUndo,
}: {
	candidate: RedactionCandidate;
	drafted: boolean;
	target: InterventionTarget;
	onRedact: () => void;
	onUndo: () => void;
}) {
	return (
		<li className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
			<div className="min-w-0 flex-1 space-y-0.5">
				<p
					className={
						candidate.redacted
							? "text-muted-foreground line-through"
							: undefined
					}
				>
					{candidate.label}
				</p>
				<p className="text-muted-foreground">
					Step {candidate.step}
					{candidate.redacted && " · already redacted"}
				</p>
			</div>
			{candidate.redacted ? null : drafted ? (
				<Button variant="secondary" size="xs" onClick={onUndo}>
					<Badge variant="outline">pending</Badge>
					Undo
				</Button>
			) : (
				<Button
					variant="outline"
					size="xs"
					disabled={!target.available}
					onClick={onRedact}
				>
					Redact
				</Button>
			)}
		</li>
	);
}

/** The intervene tab of an agent: prepare drafts, which the control bar then applies. */
export function IntervenePanel({
	summary,
	candidates,
	controls,
}: {
	summary: AgentSummary;
	candidates: RedactionCandidate[];
	controls: InterveneControls;
}) {
	const { target, drafts, onAdd, onRemove } = controls;
	const draftedIndex = (eventId: string) =>
		drafts.findIndex(
			(draft) =>
				draft.type === "intervention.memory_redacted" &&
				draft.agentId === summary.agentId &&
				draft.targetEventId === eventId,
		);

	return (
		<div className="space-y-5 p-4">
			<Consequence target={target} />

			{summary.behavior === "llm" ? (
				<InstructionForm
					agentId={summary.agentId}
					target={target}
					onAdd={onAdd}
				/>
			) : (
				<p className="text-muted-foreground text-xs">
					{summary.agentId} is a {summary.behavior} agent: it has no prompt to
					add an instruction to.
				</p>
			)}

			<div className="space-y-2">
				<h3 className="font-medium text-muted-foreground text-xs">
					Redact from memory
				</h3>
				<p className="text-muted-foreground text-xs">
					What {summary.agentId} will see at step {target.appliesAt}: the
					messages of the room and its own proposals up to step {target.step}. A
					redacted item disappears from its view from then on.
				</p>
				{candidates.length === 0 ? (
					<p className="px-2 py-1.5 text-muted-foreground text-xs">
						Nothing to redact yet.
					</p>
				) : (
					<ul className="space-y-0.5 text-xs">
						{candidates.map((candidate) => {
							const index = draftedIndex(candidate.eventId);
							return (
								<RedactionRow
									key={candidate.eventId}
									candidate={candidate}
									drafted={index >= 0}
									target={target}
									onRedact={() =>
										onAdd(
											interventionSchema.parse({
												type: "intervention.memory_redacted",
												agentId: summary.agentId,
												targetEventId: candidate.eventId,
											}),
										)
									}
									onUndo={() => onRemove(index)}
								/>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}

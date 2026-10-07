import type { Time } from "@experiments/types";
import {
	type AnyEvent,
	interventionMemoryRedactedSchema,
	interventionPromptInjectedSchema,
} from "@experiments/types/events";
import { type AgentId, newEventId } from "@experiments/types/ids";
import type { Intervention } from "@experiments/types/interventions";
import type { AgentConfig } from "@experiments/types/scenario";
import { InvalidInterventionError } from "./errors";

/**
 * Interventions are facts recorded between two steps: an intervention
 * recorded at step N takes effect from step N + 1 (a system instruction at
 * N + 1 only, a redaction from N + 1 on). The readers below are the one place
 * that says how, so a live step, a replay and a view all agree.
 */

/** Interventions are the experimenter's, not part of the world: agents never see them. */
export function isInterventionEvent(event: AnyEvent): boolean {
	return (
		event.type === "intervention.prompt_injected" ||
		event.type === "intervention.memory_redacted"
	);
}

/** Ids of the events redacted from an agent's view, as of `history`. */
export function redactedEventIds(
	history: readonly AnyEvent[],
	agentId: AgentId,
): Set<string> {
	const ids = new Set<string>();

	for (const event of history) {
		if (
			event.type === "intervention.memory_redacted" &&
			event.agentId === agentId
		) {
			ids.add(event.targetEventId);
		}
	}

	return ids;
}

/** The system instructions an agent was given for `step`: those recorded right after the step before. */
export function instructionsAt(
	history: readonly AnyEvent[],
	agentId: AgentId,
	step: number,
): string[] {
	return history.flatMap((event) =>
		event.type === "intervention.prompt_injected" &&
		event.agentId === agentId &&
		event.step === step - 1
			? [event.content]
			: [],
	);
}

/**
 * Validates what the experimenter asked for against the run as it stands and
 * builds the events that record it, at `step` (the last played step).
 * `history` holds the events up to that step.
 */
export function buildInterventionEvents(params: {
	history: readonly AnyEvent[];
	agents: readonly Pick<AgentConfig, "id" | "behavior">[];
	/** The last played step: where the events are recorded. */
	step: number;
	time: Time;
	totalSteps: number;
	interventions: readonly Intervention[];
}): AnyEvent[] {
	const { history, agents, step, time, totalSteps, interventions } = params;

	if (interventions.length > 0 && step >= totalSteps) {
		throw new InvalidInterventionError(
			"the run has no next step to apply them to",
		);
	}

	const redacted = new Map<string, Set<string>>();
	const redactedFor = (agentId: AgentId) => {
		let ids = redacted.get(agentId);
		if (ids === undefined) {
			ids = redactedEventIds(history, agentId);
			redacted.set(agentId, ids);
		}
		return ids;
	};

	return interventions.map((intervention) => {
		const agent = agents.find(
			(candidate) => candidate.id === intervention.agentId,
		);

		if (agent === undefined) {
			throw new InvalidInterventionError(
				`agent ${intervention.agentId} is not in this run`,
			);
		}

		const base = { id: newEventId(), timestamp: time, step };

		switch (intervention.type) {
			case "intervention.prompt_injected": {
				if (agent.behavior !== "llm") {
					throw new InvalidInterventionError(
						`${agent.id} is not an llm agent, it has no prompt to add to`,
					);
				}

				return interventionPromptInjectedSchema.parse({
					...base,
					...intervention,
				});
			}

			case "intervention.memory_redacted": {
				const target = history.find(
					(event) => event.id === intervention.targetEventId,
				);
				// What an agent remembers: the messages it can see and its own proposals.
				const remembered =
					target?.type === "message.published" ||
					(target?.type === "action.proposed" &&
						target.agentId === intervention.agentId);

				if (!remembered) {
					throw new InvalidInterventionError(
						`${intervention.targetEventId} is not a message or a proposal of ${agent.id} up to step ${step}`,
					);
				}

				const ids = redactedFor(intervention.agentId);

				if (ids.has(intervention.targetEventId)) {
					throw new InvalidInterventionError(
						`${intervention.targetEventId} is already redacted from ${agent.id}`,
					);
				}
				ids.add(intervention.targetEventId);

				return interventionMemoryRedactedSchema.parse({
					...base,
					...intervention,
				});
			}
		}
	});
}

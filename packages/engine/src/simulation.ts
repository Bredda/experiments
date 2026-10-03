import type { RunStore } from "@experiments/db";
import { speakSchema } from "@experiments/types/actions";
import {
	type AnyEvent,
	actionProposedSchema,
	actionSelectedSchema,
	agentJoinedSchema,
	agentPromptBuiltSchema,
	messagePublishedSchema,
} from "@experiments/types/events";
import { newEventId, type RunId } from "@experiments/types/ids";
import { type Candidate, candidateSchema } from "@experiments/types/scheduler";
import type { Agent } from "./agent";
import { SimulationClock } from "./clock";
import { EventLog } from "./eventLog";
import type { Room } from "./room";
import type { RunConfig } from "./runConfig";
import type { Scheduler } from "./scheduler/base";

export class Simulation {
	readonly runId: RunId;
	readonly room: Room;
	readonly agents: readonly Agent[];
	readonly scheduler: Scheduler;
	readonly config: RunConfig;
	readonly clock: SimulationClock;
	readonly events: EventLog;
	readonly #store: RunStore | undefined;

	constructor(params: {
		runId: RunId;
		room: Room;
		agents: readonly Agent[];
		scheduler: Scheduler;
		config: RunConfig;
		clock?: SimulationClock;
		events?: EventLog;
		store?: RunStore;
	}) {
		this.runId = params.runId;
		this.room = params.room;
		this.agents = params.agents;
		this.scheduler = params.scheduler;
		this.config = params.config;
		this.clock = params.clock ?? new SimulationClock();
		this.events = params.events ?? new EventLog();
		this.#store = params.store;
	}

	/** Persists a batch atomically, then makes it visible in the in-memory log. */
	#commit(events: readonly AnyEvent[]): void {
		this.#store?.appendEvents(this.runId, events);
		this.events.extend(events);
	}

	/** Agents join the room. Only for a new run; use `restore` to resume one. */
	setup(): void {
		const joined: AnyEvent[] = [];

		for (const agent of this.agents) {
			this.room.add(agent.id);

			joined.push(
				agentJoinedSchema.parse({
					id: newEventId(),
					timestamp: this.clock.now,
					step: this.clock.step,
					agentId: agent.id,
					roomId: this.room.id,
					type: "agent.joined",
				}),
			);
		}

		this.#commit(joined);
	}

	/** Rebuilds in-memory state from the events already stored for this run. */
	restore(events: readonly AnyEvent[]): void {
		let lastStep = 0;

		for (const event of events) {
			if (event.type === "agent.joined") {
				this.room.add(event.agentId);
			}
			lastStep = Math.max(lastStep, event.step);
		}

		this.events.extend(events);
		this.clock.seek(lastStep);
	}

	exportEvents(path: string): void {
		this.events.writeJsonl(path);
	}

	/**
	 * Runs one step and returns the events it produced. A step is atomic: its
	 * events are persisted together once every agent has answered, and if any
	 * agent fails nothing is recorded and the clock does not advance.
	 */
	async step(): Promise<AnyEvent[]> {
		this.clock.advance();

		try {
			return await this.#runStep();
		} catch (error) {
			this.clock.rewind();
			throw error;
		}
	}

	async #runStep(): Promise<AnyEvent[]> {
		const stepEvents: AnyEvent[] = [];
		const candidates: Candidate[] = [];

		// Agents propose simultaneously: all of them observe the history as it
		// was at the start of the step, never each other's proposals.
		const history = this.events.toList();

		for (const agent of this.agents) {
			const observation = agent.observe({
				step: this.clock.step,
				time: this.clock.now,
				room: this.room.view(agent.id, history),
			});

			const proposal = await agent.propose(observation);

			if (proposal.prompt !== undefined) {
				stepEvents.push(
					agentPromptBuiltSchema.parse({
						id: newEventId(),
						timestamp: this.clock.now,
						step: this.clock.step,
						agentId: agent.id,
						prompt: proposal.prompt,
						type: "agent.prompt_built",
					}),
				);
			}

			stepEvents.push(
				actionProposedSchema.parse({
					id: newEventId(),
					timestamp: this.clock.now,
					step: this.clock.step,
					agentId: agent.id,
					action: proposal.action,
					type: "action.proposed",
				}),
			);

			if (proposal.action.type === "speak") {
				candidates.push(
					candidateSchema.parse({
						agentId: agent.id,
						action: proposal.action,
					}),
				);
			}
		}

		if (candidates.length > 0) {
			const selected = this.scheduler.select(
				candidates,
				this.config.rngForStep(this.clock.step),
			);

			stepEvents.push(
				actionSelectedSchema.parse({
					id: newEventId(),
					timestamp: this.clock.now,
					step: this.clock.step,
					agentId: selected.agentId,
					action: selected.action,
					type: "action.selected",
				}),
			);

			const selectedAction = speakSchema.safeParse(selected.action);

			if (selectedAction.success) {
				stepEvents.push(
					messagePublishedSchema.parse({
						id: newEventId(),
						timestamp: this.clock.now,
						step: this.clock.step,
						agentId: selectedAction.data.agentId,
						roomId: selectedAction.data.roomId,
						content: selectedAction.data.content,
						type: "message.published",
					}),
				);
			}
		}

		this.#commit(stepEvents);

		return stepEvents;
	}
}

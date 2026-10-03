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
	#store: RunStore | undefined;

	constructor(params: {
		runId: RunId;
		room: Room;
		agents: readonly Agent[];
		scheduler: Scheduler;
		config: RunConfig;
		clock?: SimulationClock;
		events?: EventLog;
	}) {
		this.runId = params.runId;
		this.room = params.room;
		this.agents = params.agents;
		this.scheduler = params.scheduler;
		this.config = params.config;
		this.clock = params.clock ?? new SimulationClock();
		this.events = params.events ?? new EventLog();
	}

	#append(event: AnyEvent): void {
		this.events.append(event);
		this.#store?.appendEvent(this.runId, event);
	}

	setup(store: RunStore): void {
		this.#store = store;

		for (const agent of this.agents) {
			this.room.add(agent.id);

			this.#append(
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
	}

	exportEvents(path: string): void {
		this.events.writeJsonl(path);
	}

	async step(): Promise<AnyEvent | undefined> {
		this.clock.advance();

		const candidates: Candidate[] = [];
		let lastEvent: AnyEvent | undefined;

		for (const agent of this.agents) {
			const roomView = this.room.view(agent.id, this.events.toList());

			const observation = agent.observe({
				step: this.clock.step,
				time: this.clock.now,
				room: roomView,
			});

			const proposal = await agent.propose(observation);

			if (proposal.prompt !== undefined) {
				this.#append(
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

			const event = actionProposedSchema.parse({
				id: newEventId(),
				timestamp: this.clock.now,
				step: this.clock.step,
				agentId: agent.id,
				action: proposal.action,
				type: "action.proposed",
			});

			this.#append(event);
			lastEvent = event;

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
			const selected = this.scheduler.select(candidates, this.config.rng);

			const selectedEvent = actionSelectedSchema.parse({
				id: newEventId(),
				timestamp: this.clock.now,
				step: this.clock.step,
				agentId: selected.agentId,
				action: selected.action,
				type: "action.selected",
			});

			// Matches the source simulation: selection/publication events are kept
			// in-memory only, not persisted through the store.
			this.events.append(selectedEvent);
			lastEvent = selectedEvent;

			const selectedAction = speakSchema.safeParse(selected.action);

			if (selectedAction.success) {
				const published = messagePublishedSchema.parse({
					id: newEventId(),
					timestamp: this.clock.now,
					step: this.clock.step,
					agentId: selectedAction.data.agentId,
					roomId: selectedAction.data.roomId,
					content: selectedAction.data.content,
					type: "message.published",
				});

				this.events.append(published);
				lastEvent = published;
			}
		}

		return lastEvent;
	}
}

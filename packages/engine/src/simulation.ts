import type { RunStore } from "@experiments/db";
import type { Observation } from "@experiments/types";
import { type ActionProposal, speakSchema } from "@experiments/types/actions";
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
import { StepNotFoundError } from "./errors";
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

	/**
	 * What each agent observed when it proposed at `step`: the history as it
	 * stood at the start of that step. Built by the same code as a real step,
	 * so a replay shows exactly what the agents were given.
	 */
	observationsAt(step: number): Observation[] {
		if (!Number.isInteger(step) || step < 1 || step > this.clock.step) {
			throw new StepNotFoundError(this.runId, step);
		}

		const history = this.events.toList().filter((event) => event.step < step);

		return this.agents.map((agent) =>
			this.#observe(agent, step, this.clock.timeAt(step), history),
		);
	}

	#observe(
		agent: Agent,
		step: number,
		time: string,
		history: readonly AnyEvent[],
	): Observation {
		return agent.observe({
			step,
			time,
			room: this.room.view(agent.id, history),
		});
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
		// was at the start of the step, never each other's proposals. Their
		// calls (slow for LLM-backed agents) therefore run concurrently.
		const history = this.events.toList();

		const results = await Promise.allSettled(
			this.agents.map(async (agent) => {
				const observation = this.#observe(
					agent,
					this.clock.step,
					this.clock.now,
					history,
				);
				return await agent.propose(observation);
			}),
		);

		// Calls already in flight are left to finish rather than cancelled, so a
		// failed step still pays for them; the first failure in agent order wins.
		const proposals: ActionProposal[] = [];
		for (const result of results) {
			if (result.status === "rejected") throw result.reason;
			proposals.push(result.value);
		}

		for (const [index, agent] of this.agents.entries()) {
			const proposal = proposals[index] as ActionProposal;

			if (proposal.prompt !== undefined) {
				stepEvents.push(
					agentPromptBuiltSchema.parse({
						id: newEventId(),
						timestamp: this.clock.now,
						step: this.clock.step,
						agentId: agent.id,
						prompt: proposal.prompt,
						model: proposal.meta?.model,
						usage: proposal.meta?.usage,
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

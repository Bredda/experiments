import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunStore } from "@experiments/db";
import type { ActionProposal } from "@experiments/types/actions";
import { actionProposal, speak } from "@experiments/types/actions";
import type { AnyEvent } from "@experiments/types/events";
import type { RunId } from "@experiments/types/ids";
import type { ScenarioConfig } from "@experiments/types/scenario";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Agent } from "./agent";
import { MentionedAgent } from "./agents";
import { RunBusyError, RunCompletedError, RunNotFoundError } from "./errors";
import { Room } from "./room";
import { RunConfig } from "./runConfig";
import { buildRun, createRun, stepRun } from "./scenario";
import { HighestUrgencyScheduler } from "./scheduler";
import { Simulation } from "./simulation";

function scenario(overrides: Partial<ScenarioConfig> = {}): ScenarioConfig {
	return {
		name: "test",
		seed: "ABC123",
		agents: [
			{ id: "alice", behavior: "mentioned" },
			{ id: "bob", behavior: "mentioned" },
			{ id: "charlie", behavior: "mentioned" },
		],
		rooms: [{ id: "main", members: ["alice", "bob", "charlie"] }],
		scheduler: { type: "weighted_random" },
		steps: 6,
		...overrides,
	};
}

/** Event ids are execution-specific; everything else must be reproducible. */
function normalize(events: readonly AnyEvent[]) {
	return events.map(({ id: _id, ...rest }) => rest);
}

let dir: string;
let store: RunStore;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "experiments-engine-"));
	store = new RunStore(join(dir, "test.db"));
});

afterEach(() => {
	store.close();
	rmSync(dir, { recursive: true, force: true });
});

function storedEvents(runId: RunId) {
	return store.listEvents(runId).map((record) => record.payload);
}

describe("stepRun", () => {
	it("moves a run from created to running to completed", async () => {
		const { runId, status } = createRun(store, scenario({ steps: 2 }));
		expect(status).toBe("created");

		const first = await stepRun(store, runId);
		expect(first.run.status).toBe("running");

		const second = await stepRun(store, runId);
		expect(second.run.status).toBe("completed");

		await expect(stepRun(store, runId)).rejects.toBeInstanceOf(
			RunCompletedError,
		);
	});

	it("returns only the events added by the step, selection and message included", async () => {
		const { runId } = createRun(store, scenario());
		const before = store.listEvents(runId).length;

		const { events } = await stepRun(store, runId);

		expect(store.listEvents(runId)).toHaveLength(before + events.length);
		expect(events.every((record) => record.step === 1)).toBe(true);

		const types = events.map((record) => record.type);
		expect(types).toContain("action.selected");
		expect(types).toContain("message.published");
	});

	it("records silent steps and keeps time advancing", async () => {
		const { runId } = createRun(
			store,
			scenario({
				agents: [{ id: "alice", behavior: "silent" }],
				rooms: [{ id: "main", members: ["alice"] }],
				steps: 2,
			}),
		);

		await stepRun(store, runId);
		await stepRun(store, runId);

		const events = storedEvents(runId);
		expect(events.filter((e) => e.type === "action.proposed")).toHaveLength(2);
		expect(events.some((e) => e.type === "message.published")).toBe(false);
		expect(Math.max(...events.map((e) => e.step))).toBe(2);
	});

	it("rejects an unknown run", async () => {
		await expect(
			stepRun(store, "00000000-0000-4000-8000-000000000000" as RunId),
		).rejects.toBeInstanceOf(RunNotFoundError);
	});

	it("allows a single step at a time per run", async () => {
		const { runId } = createRun(store, scenario());

		const results = await Promise.allSettled([
			stepRun(store, runId),
			stepRun(store, runId),
		]);

		const rejected = results.filter((r) => r.status === "rejected");
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
			RunBusyError,
		);
	});

	it("gives the same trajectory when rebuilt before every step as when run continuously", async () => {
		const config = scenario();

		// Continuous: one live Simulation for the whole run.
		const continuousStore = new RunStore(join(dir, "continuous.db"));
		const { runId: continuousId, simulation } = buildRun(config, {
			store: continuousStore,
		});
		continuousStore.createRun({
			runId: continuousId,
			name: config.name,
			seed: config.seed,
			scenario: config,
		});
		simulation.setup();
		for (let i = 0; i < config.steps; i++) {
			await simulation.step();
		}
		const continuous = continuousStore
			.listEvents(continuousId)
			.map((record) => record.payload);
		continuousStore.close();

		// Resumed: the simulation is rebuilt from the database for each step.
		const { runId } = createRun(store, config);
		for (let i = 0; i < config.steps; i++) {
			await stepRun(store, runId);
		}

		expect(normalize(storedEvents(runId))).toEqual(normalize(continuous));
	});
});

describe("Simulation.step", () => {
	class FailingAgent extends Agent {
		propose(): ActionProposal {
			throw new Error("model unavailable");
		}
	}

	it("persists nothing and does not advance when an agent fails", async () => {
		const runId = "11111111-1111-4111-8111-111111111111" as RunId;
		store.createRun({
			runId,
			name: "failing",
			seed: "ABC123",
			scenario: scenario(),
		});

		const room = new Room({ id: "main" as never, name: "main" });
		const alice = new MentionedAgent("alice" as never, "alice", room.id);
		const broken = new FailingAgent("bob" as never, "bob", room.id);

		const simulation = new Simulation({
			runId,
			room,
			agents: [alice, broken],
			scheduler: new HighestUrgencyScheduler(),
			config: new RunConfig({ runId, seed: "ABC123" }),
			store,
		});
		simulation.setup();

		const stored = store.listEvents(runId).length;

		await expect(simulation.step()).rejects.toThrow("model unavailable");

		expect(store.listEvents(runId)).toHaveLength(stored);
		expect(simulation.events).toHaveLength(stored);
		expect(simulation.clock.step).toBe(0);
	});

	it("keeps agents from seeing each other's proposals within a step", async () => {
		const runId = "22222222-2222-4222-8222-222222222222" as RunId;
		const seen: number[] = [];

		class Spy extends Agent {
			propose(observation: Parameters<Agent["propose"]>[0]): ActionProposal {
				seen.push(
					observation.room.visibleEvents.filter(
						(event) => event.type === "action.proposed",
					).length,
				);
				return actionProposal({
					action: speak({
						agentId: this.id,
						roomId: this.roomId,
						content: "hi",
					}),
				});
			}
		}

		const room = new Room({ id: "main" as never, name: "main" });
		const simulation = new Simulation({
			runId,
			room,
			agents: [
				new Spy("a" as never, "a", room.id),
				new Spy("b" as never, "b", room.id),
			],
			scheduler: new HighestUrgencyScheduler(),
			config: new RunConfig({ runId, seed: "ABC123" }),
		});
		simulation.setup();

		await simulation.step();

		expect(seen).toEqual([0, 0]);
	});

	describe("proposals", () => {
		/** An agent whose answer is released by the test. */
		class GatedAgent extends Agent {
			started = false;
			#release!: (outcome: "speak" | Error) => void;
			readonly #gate = new Promise<"speak" | Error>((resolve) => {
				this.#release = resolve;
			});

			release(outcome: "speak" | Error = "speak") {
				this.#release(outcome);
			}

			async propose(): Promise<ActionProposal> {
				this.started = true;
				const outcome = await this.#gate;
				if (outcome instanceof Error) throw outcome;
				return actionProposal({
					action: speak({
						agentId: this.id,
						roomId: this.roomId,
						content: this.name,
					}),
				});
			}
		}

		const tick = () => new Promise((resolve) => setImmediate(resolve));

		function setupGated(count: number) {
			const runId = "33333333-3333-4333-8333-333333333333" as RunId;
			store.createRun({
				runId,
				name: "gated",
				seed: "ABC123",
				scenario: scenario(),
			});

			const room = new Room({ id: "main" as never, name: "main" });
			const agents = Array.from(
				{ length: count },
				(_, i) => new GatedAgent(`agent${i}` as never, `agent${i}`, room.id),
			);
			const simulation = new Simulation({
				runId,
				room,
				agents,
				scheduler: new HighestUrgencyScheduler(),
				config: new RunConfig({ runId, seed: "ABC123" }),
				store,
			});
			simulation.setup();

			return { runId, agents, simulation };
		}

		it("calls every agent before any of them has answered", async () => {
			const { agents, simulation } = setupGated(3);

			const step = simulation.step();
			await tick();

			expect(agents.map((agent) => agent.started)).toEqual([true, true, true]);

			for (const agent of agents) agent.release();
			await step;
		});

		it("records proposals in agent order whatever the order they finish in", async () => {
			const { agents, simulation } = setupGated(3);

			const step = simulation.step();
			await tick();
			// The last agent answers first, the first one answers last.
			for (const agent of [...agents].reverse()) agent.release();
			const events = await step;

			expect(
				events
					.filter((event) => event.type === "action.proposed")
					.map((event) => event.agentId),
			).toEqual(["agent0", "agent1", "agent2"]);
		});

		it("waits for the calls in flight before failing, and records nothing", async () => {
			const { runId, agents, simulation } = setupGated(2);
			const stored = store.listEvents(runId).length;

			let settled = false;
			const step = simulation.step().then(
				() => "resolved",
				(error: Error) => {
					settled = true;
					return error.message;
				},
			);
			await tick();

			agents[1]?.release(new Error("model unavailable"));
			await tick();
			// The failure is known, but the first agent is still answering.
			expect(settled).toBe(false);

			agents[0]?.release();
			expect(await step).toBe("model unavailable");

			expect(store.listEvents(runId)).toHaveLength(stored);
			expect(simulation.clock.step).toBe(0);
		});
	});
});

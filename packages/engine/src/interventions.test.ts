import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunStore } from "@experiments/db";
import type { ActionProposal } from "@experiments/types/actions";
import { actionProposal, speak } from "@experiments/types/actions";
import type { AnyEvent } from "@experiments/types/events";
import type { AgentId, RunId } from "@experiments/types/ids";
import type { Intervention } from "@experiments/types/interventions";
import type { ScenarioConfig } from "@experiments/types/scenario";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Agent } from "./agent";
import { InvalidInterventionError, RunCompletedError } from "./errors";
import { buildInterventionEvents } from "./interventions";
import { Room } from "./room";
import { RunConfig } from "./runConfig";
import { createRun, forkRun, getObservations, stepRun } from "./scenario";
import { HighestUrgencyScheduler } from "./scheduler";
import { Simulation } from "./simulation";

const alice = "alice" as AgentId;
const bob = "bob" as AgentId;

function scenario(overrides: Partial<ScenarioConfig> = {}): ScenarioConfig {
	return {
		name: "test",
		seed: "ABC123",
		agents: [
			{ id: "alice", behavior: "mentioned" },
			{ id: "bob", behavior: "mentioned" },
		],
		rooms: [{ id: "main", members: ["alice", "bob"] }],
		scheduler: { type: "weighted_random" },
		steps: 6,
		...overrides,
	};
}

/**
 * Event ids are execution-specific, and so is the id a redaction points at:
 * everything else must be reproducible.
 */
function normalize(events: readonly AnyEvent[]) {
	return events.map((event) => {
		const { id: _id, ...rest } = event;
		if (rest.type === "intervention.memory_redacted") {
			const { targetEventId: _target, ...kept } = rest;
			return kept;
		}
		return rest;
	});
}

let dir: string;
let store: RunStore;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "experiments-interventions-"));
	store = new RunStore(join(dir, "test.db"));
});

afterEach(() => {
	store.close();
	rmSync(dir, { recursive: true, force: true });
});

function storedEvents(runId: RunId) {
	return store.listEvents(runId).map((record) => record.payload);
}

function firstMessage(runId: RunId) {
	const message = storedEvents(runId).find(
		(event) => event.type === "message.published",
	);
	if (message === undefined) throw new Error("nobody spoke");
	return message;
}

function redact(agentId: AgentId, targetEventId: string): Intervention {
	return {
		type: "intervention.memory_redacted",
		agentId,
		targetEventId: targetEventId as never,
	};
}

/** A run played to the end of step 1: both agents greeted, one was selected. */
async function afterFirstStep(config: Partial<ScenarioConfig> = {}) {
	const run = createRun(store, scenario(config));
	await stepRun(store, run.runId);
	return run;
}

function proposalsAt(runId: RunId, step: number, agentId: AgentId) {
	return storedEvents(runId).filter(
		(event) =>
			event.type === "action.proposed" &&
			event.step === step &&
			event.agentId === agentId,
	);
}

describe("memory redaction", () => {
	it("removes the item from that agent's view only, from the next step", async () => {
		const { runId } = await afterFirstStep();
		const message = firstMessage(runId);

		await stepRun(store, runId, {
			interventions: [redact(bob, message.id)],
		});

		// Bob no longer remembers anyone spoke, so he greets again; Alice does not.
		expect(proposalsAt(runId, 2, bob)[0]).toMatchObject({
			action: { type: "speak" },
		});
		expect(proposalsAt(runId, 2, alice)[0]).toMatchObject({
			action: { type: "stay_silent" },
		});

		const [seenByAlice, seenByBob] = getObservations(store, runId, 2);
		const ids = (events: AnyEvent[] | undefined) => events?.map((e) => e.id);
		expect(ids(seenByAlice?.room.visibleEvents)).toContain(message.id);
		expect(ids(seenByBob?.room.visibleEvents)).not.toContain(message.id);
	});

	it("is recorded at the step it follows, and never shown to the agents as an event", async () => {
		const { runId } = await afterFirstStep();
		const message = firstMessage(runId);

		await stepRun(store, runId, {
			interventions: [redact(bob, message.id)],
		});

		const recorded = storedEvents(runId).filter(
			(event) => event.type === "intervention.memory_redacted",
		);
		expect(recorded).toHaveLength(1);
		expect(recorded[0]).toMatchObject({
			step: 1,
			agentId: bob,
			targetEventId: message.id,
		});
		// Recorded before the step it affects, and the clock only moved once.
		expect(store.listEvents(runId).map((r) => r.step)).toEqual(
			[...store.listEvents(runId).map((r) => r.step)].sort(),
		);
		for (const observation of getObservations(store, runId, 2)) {
			expect(
				observation.room.visibleEvents.some((e) =>
					e.type.startsWith("intervention."),
				),
			).toBe(false);
		}
	});

	it("does not rewrite the past: the observation of the step it follows is unchanged", async () => {
		const { runId } = await afterFirstStep();
		await stepRun(store, runId);
		const message = firstMessage(runId);
		const before = getObservations(store, runId, 2);

		await stepRun(store, runId, {
			interventions: [redact(bob, message.id)],
		});

		expect(getObservations(store, runId, 2)).toEqual(before);
		const atThree = getObservations(store, runId, 3);
		expect(
			atThree[1]?.room.visibleEvents.some((e) => e.id === message.id),
		).toBe(false);
	});

	it("lets time advance every step, silent or not", async () => {
		const { runId } = await afterFirstStep({ steps: 3 });
		const message = firstMessage(runId);

		const first = await stepRun(store, runId, {
			interventions: [redact(alice, message.id)],
		});
		const second = await stepRun(store, runId);

		expect(first.run.status).toBe("running");
		expect(second.run.status).toBe("completed");
		expect(new Set(storedEvents(runId).map((e) => e.step))).toEqual(
			new Set([0, 1, 2, 3]),
		);
	});

	it("keeps a run reproducible: same scenario, seed and interventions, same trajectory", async () => {
		async function played() {
			const { runId } = await afterFirstStep();
			await stepRun(store, runId, {
				interventions: [redact(bob, firstMessage(runId).id)],
			});
			await stepRun(store, runId);
			return storedEvents(runId);
		}

		const first = await played();
		const second = await played();
		expect(normalize(second)).toEqual(normalize(first));

		// And the intervention is what makes the difference with a run without it.
		const plain = await afterFirstStep();
		await stepRun(store, plain.runId);
		await stepRun(store, plain.runId);
		expect(normalize(storedEvents(plain.runId))).not.toEqual(normalize(first));
	});
});

describe("validation", () => {
	it("rejects what cannot be applied and records nothing", async () => {
		const { runId } = await afterFirstStep();
		const message = firstMessage(runId);
		const stored = store.listEvents(runId).length;
		const aliceProposal = proposalsAt(runId, 1, alice)[0] as AnyEvent;
		const rejected: Intervention[][] = [
			// A prompt instruction needs an llm agent.
			[
				{
					type: "intervention.prompt_injected",
					agentId: alice,
					content: "be brief",
				},
			],
			// Unknown agent, unknown target, another agent's proposal.
			[redact("carol" as AgentId, message.id)],
			[redact(bob, "00000000-0000-4000-8000-000000000000")],
			[redact(bob, aliceProposal.id)],
			// The same item twice in one request.
			[redact(bob, message.id), redact(bob, message.id)],
		];

		for (const interventions of rejected) {
			await expect(
				stepRun(store, runId, { interventions }),
			).rejects.toBeInstanceOf(InvalidInterventionError);
		}

		expect(store.listEvents(runId)).toHaveLength(stored);
	});

	it("rejects redacting an item that is already redacted", async () => {
		const { runId } = await afterFirstStep();
		const message = firstMessage(runId);
		await stepRun(store, runId, { interventions: [redact(bob, message.id)] });

		await expect(
			stepRun(store, runId, { interventions: [redact(bob, message.id)] }),
		).rejects.toBeInstanceOf(InvalidInterventionError);
		// The other agent can still redact it.
		await stepRun(store, runId, { interventions: [redact(alice, message.id)] });
	});

	it("needs a next step to apply to", async () => {
		const run = createRun(store, scenario({ steps: 1 }));
		await stepRun(store, run.runId);

		await expect(
			stepRun(store, run.runId, {
				interventions: [redact(bob, firstMessage(run.runId).id)],
			}),
		).rejects.toBeInstanceOf(RunCompletedError);
		expect(() =>
			forkRun(store, run.runId, {
				step: 1,
				name: "end",
				interventions: [redact(bob, firstMessage(run.runId).id)],
			}),
		).toThrow(InvalidInterventionError);
	});
});

describe("system instructions", () => {
	const agents = [
		{ id: "alice", behavior: "llm" as const },
		{ id: "bob", behavior: "mentioned" as const },
	];
	const instruction: Intervention = {
		type: "intervention.prompt_injected",
		agentId: alice,
		content: "Answer only in French.",
	};

	class Recorder extends Agent {
		readonly seen: string[][] = [];
		propose(observation: Parameters<Agent["propose"]>[0]): ActionProposal {
			this.seen.push(observation.instructions);
			return actionProposal({
				action: speak({ agentId: this.id, roomId: this.roomId, content: "hi" }),
			});
		}
	}

	it("reach the agent for the next step only", async () => {
		const runId = "44444444-4444-4444-8444-444444444444" as RunId;
		const room = new Room({ id: "main" as never, name: "main" });
		const recorder = new Recorder(alice, "alice", room.id);
		const simulation = new Simulation({
			runId,
			room,
			agents: [recorder],
			scheduler: new HighestUrgencyScheduler(),
			config: new RunConfig({ runId, seed: "ABC123" }),
		});
		simulation.setup();
		await simulation.step();

		const events = buildInterventionEvents({
			history: simulation.events.toList(),
			agents,
			step: simulation.clock.step,
			time: simulation.clock.now,
			totalSteps: 6,
			interventions: [instruction],
		});
		await simulation.step(events);
		await simulation.step();

		expect(recorder.seen).toEqual([[], ["Answer only in French."], []]);
		expect(simulation.observationsAt(2)[0]?.instructions).toEqual([
			"Answer only in French.",
		]);
		expect(simulation.observationsAt(3)[0]?.instructions).toEqual([]);
		expect(events[0]).toMatchObject({ step: 1, agentId: alice });
	});

	it("record nothing when the step fails", async () => {
		const runId = "55555555-5555-4555-8555-555555555555" as RunId;
		store.createRun({ runId, name: "f", seed: "ABC123", scenario: scenario() });

		class Broken extends Agent {
			propose(): ActionProposal {
				throw new Error("model unavailable");
			}
		}

		const room = new Room({ id: "main" as never, name: "main" });
		const simulation = new Simulation({
			runId,
			room,
			agents: [new Broken(alice, "alice", room.id)],
			scheduler: new HighestUrgencyScheduler(),
			config: new RunConfig({ runId, seed: "ABC123" }),
			store,
		});
		simulation.setup();
		const stored = store.listEvents(runId).length;
		const events = buildInterventionEvents({
			history: simulation.events.toList(),
			agents,
			step: 0,
			time: simulation.clock.now,
			totalSteps: 6,
			interventions: [instruction],
		});

		await expect(simulation.step(events)).rejects.toThrow("model unavailable");

		expect(store.listEvents(runId)).toHaveLength(stored);
		expect(simulation.clock.step).toBe(0);
	});
});

describe("forkRun with interventions", () => {
	it("records them in the fork after the copied history, and leaves the parent alone", async () => {
		const parent = await afterFirstStep();
		await stepRun(store, parent.runId);
		const message = firstMessage(parent.runId);
		const parentBefore = store.listEvents(parent.runId);

		const fork = forkRun(store, parent.runId, {
			step: 1,
			name: "forgot",
			interventions: [redact(bob, message.id)],
		});

		const events = storedEvents(fork.runId);
		expect(events.slice(0, -1)).toEqual(
			storedEvents(parent.runId).filter((e) => e.step <= 1),
		);
		expect(events.at(-1)).toMatchObject({
			type: "intervention.memory_redacted",
			step: 1,
			agentId: bob,
			targetEventId: message.id,
		});
		expect(store.listEvents(parent.runId)).toEqual(parentBefore);

		// Its first step is the one the intervention takes effect at.
		await stepRun(store, fork.runId);
		expect(proposalsAt(fork.runId, 2, bob)[0]).toMatchObject({
			action: { type: "speak" },
		});
		expect(proposalsAt(parent.runId, 2, bob)[0]).toMatchObject({
			action: { type: "stay_silent" },
		});
	});

	it("rejects a target that does not exist yet at the fork step, creating nothing", async () => {
		const parent = await afterFirstStep();
		await stepRun(store, parent.runId);
		const laterProposal = proposalsAt(parent.runId, 2, bob)[0] as AnyEvent;
		const runs = store.listRuns().length;

		expect(() =>
			forkRun(store, parent.runId, {
				step: 1,
				name: "bad",
				interventions: [redact(bob, laterProposal.id)],
			}),
		).toThrow(InvalidInterventionError);
		expect(store.listRuns()).toHaveLength(runs);
	});
});

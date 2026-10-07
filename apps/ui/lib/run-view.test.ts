import { randomUUID } from "node:crypto";
import { observationSchema } from "@experiments/types";
import {
	type AnyEvent,
	actionProposedSchema,
	actionSelectedSchema,
	agentJoinedSchema,
	agentPromptBuiltSchema,
	interventionMemoryRedactedSchema,
	interventionPromptInjectedSchema,
	messagePublishedSchema,
} from "@experiments/types/events";
import type { RunRecord } from "@experiments/types/run";
import { describe, expect, it } from "vitest";
import {
	agentRooms,
	agentSummary,
	appliesAtStep,
	buildTimeline,
	EVENT_TYPES,
	eventRoomId,
	eventsUntil,
	filterEvents,
	interventionLabel,
	interventionTarget,
	lastStep,
	modelCallLabel,
	NO_FILTER,
	observationSummary,
	redactionCandidates,
	roomSummaries,
} from "./run-view";

const TIME = "2026-01-01T00:00:00.000Z";
const base = (step: number) => ({ id: randomUUID(), timestamp: TIME, step });

const joined = (agentId: string, roomId: string) =>
	agentJoinedSchema.parse({
		...base(0),
		type: "agent.joined",
		agentId,
		roomId,
	});

const proposedSilent = (agentId: string, step: number) =>
	actionProposedSchema.parse({
		...base(step),
		type: "action.proposed",
		agentId,
		action: { type: "stay_silent", agentId },
	});

const proposedSpeak = (agentId: string, roomId: string, step: number) =>
	actionProposedSchema.parse({
		...base(step),
		type: "action.proposed",
		agentId,
		action: { type: "speak", agentId, roomId, content: "hi" },
	});

const proposedSpeakWith = (
	agentId: string,
	roomId: string,
	step: number,
	urgency: number,
) =>
	actionProposedSchema.parse({
		...base(step),
		type: "action.proposed",
		agentId,
		action: { type: "speak", agentId, roomId, content: "hi", urgency },
	});

const selected = (agentId: string, roomId: string, step: number) =>
	actionSelectedSchema.parse({
		...base(step),
		type: "action.selected",
		agentId,
		action: { type: "speak", agentId, roomId, content: "hi" },
	});

const published = (agentId: string, roomId: string, step: number) =>
	messagePublishedSchema.parse({
		...base(step),
		type: "message.published",
		agentId,
		roomId,
		content: "hi",
	});

const prompt = (agentId: string, step: number) =>
	agentPromptBuiltSchema.parse({
		...base(step),
		type: "agent.prompt_built",
		agentId,
		prompt: [{ role: "system", content: "x" }],
	});

/** Recorded at `step`, the step it follows. */
const redacted = (agentId: string, targetEventId: string, step: number) =>
	interventionMemoryRedactedSchema.parse({
		...base(step),
		type: "intervention.memory_redacted",
		agentId,
		targetEventId,
	});

const instructed = (agentId: string, content: string, step: number) =>
	interventionPromptInjectedSchema.parse({
		...base(step),
		type: "intervention.prompt_injected",
		agentId,
		content,
	});

const promptWith = (
	agentId: string,
	step: number,
	call: {
		model?: string;
		usage?: { inputTokens: number; outputTokens: number };
	},
) =>
	agentPromptBuiltSchema.parse({
		...base(step),
		type: "agent.prompt_built",
		agentId,
		prompt: [{ role: "system", content: "x" }],
		...call,
	});

function run(rooms: { id: string; members: string[] }[]): RunRecord {
	return {
		runId: randomUUID(),
		name: "test",
		seed: "ABC",
		status: "running",
		createdAt: TIME,
		scenario: {
			name: "test",
			seed: "ABC",
			agents: rooms.flatMap((room) =>
				room.members.map((id) => ({ id, behavior: "mentioned" as const })),
			),
			rooms,
			scheduler: { type: "highest_urgency" },
			steps: 5,
		},
	} as unknown as RunRecord;
}

describe("eventRoomId", () => {
	const events: AnyEvent[] = [joined("alice", "main"), joined("bob", "side")];
	const rooms = agentRooms(events);

	it("reads the room carried by the event or its speak action", () => {
		expect(eventRoomId(events[0] as AnyEvent, rooms)).toBe("main");
		expect(eventRoomId(published("alice", "main", 1), rooms)).toBe("main");
		expect(eventRoomId(proposedSpeak("alice", "main", 1), rooms)).toBe("main");
		expect(eventRoomId(selected("alice", "main", 1), rooms)).toBe("main");
	});

	it("falls back to the room the agent joined for events without a room", () => {
		expect(eventRoomId(proposedSilent("bob", 1), rooms)).toBe("side");
		expect(eventRoomId(prompt("alice", 1), rooms)).toBe("main");
	});

	it("puts an intervention in the room of the agent it targets", () => {
		expect(eventRoomId(redacted("bob", randomUUID(), 1), rooms)).toBe("side");
		expect(eventRoomId(instructed("alice", "be brief", 1), rooms)).toBe("main");
	});

	it("has no room for an agent that never joined", () => {
		expect(eventRoomId(proposedSilent("ghost", 1), rooms)).toBeUndefined();
	});
});

describe("roomSummaries", () => {
	it("counts messages, last speaker and silent steps per room", () => {
		const events: AnyEvent[] = [
			joined("alice", "main"),
			joined("bob", "main"),
			joined("carol", "side"),
			// step 1: alice speaks in main, carol silent in side
			proposedSpeak("alice", "main", 1),
			proposedSilent("carol", 1),
			selected("alice", "main", 1),
			published("alice", "main", 1),
			// step 2: nobody speaks
			proposedSilent("alice", 2),
			proposedSilent("carol", 2),
			// step 3: bob speaks in main
			published("bob", "main", 3),
		];

		const [main, side] = roomSummaries(
			run([
				{ id: "main", members: ["alice", "bob"] },
				{ id: "side", members: ["carol"] },
			]),
			events,
		);

		expect(main).toEqual({
			roomId: "main",
			memberIds: ["alice", "bob"],
			messageCount: 2,
			lastSpeaker: "bob",
			silentSteps: 1,
		});
		expect(side).toEqual({
			roomId: "side",
			memberIds: ["carol"],
			messageCount: 0,
			lastSpeaker: undefined,
			silentSteps: 3,
		});
	});

	it("reports no silent step before the first step", () => {
		const [main] = roomSummaries(run([{ id: "main", members: ["alice"] }]), [
			joined("alice", "main"),
		]);

		expect(main?.silentSteps).toBe(0);
		expect(main?.messageCount).toBe(0);
	});
});

describe("buildTimeline", () => {
	const events: AnyEvent[] = [
		joined("alice", "main"),
		joined("bob", "main"),
		joined("carol", "side"),
		// step 1: alice and bob both want to speak in main, alice wins
		proposedSpeakWith("alice", "main", 1, 0.9),
		proposedSpeakWith("bob", "main", 1, 0.2),
		proposedSilent("carol", 1),
		selected("alice", "main", 1),
		published("alice", "main", 1),
		// step 2: nobody speaks
		proposedSilent("alice", 2),
		proposedSilent("bob", 2),
		proposedSilent("carol", 2),
	];

	const kinds = (room: string | null) =>
		buildTimeline(events, room).map((item) => item.kind);

	it("lists arrivals, then each step with what was said or a silence", () => {
		expect(kinds(null)).toEqual([
			"joined",
			"joined",
			"joined",
			"step",
			"selection",
			"message",
			"step",
			"silence",
		]);
	});

	it("explains the selection with every candidate, most urgent first", () => {
		const selection = buildTimeline(events, null).find(
			(item) => item.kind === "selection",
		);

		expect(selection).toMatchObject({
			selected: "alice",
			candidates: [
				{ agentId: "alice", urgency: 0.9 },
				{ agentId: "bob", urgency: 0.2 },
			],
		});
	});

	it("keeps only the chosen room, and shows its silent steps", () => {
		expect(kinds("main")).toEqual([
			"joined",
			"joined",
			"step",
			"selection",
			"message",
			"step",
			"silence",
		]);
		// carol's room never spoke: both steps are silent there.
		expect(kinds("side")).toEqual([
			"joined",
			"step",
			"silence",
			"step",
			"silence",
		]);
	});

	it("skips the selection marker when only one agent wanted to speak", () => {
		const lone: AnyEvent[] = [
			joined("alice", "main"),
			proposedSpeakWith("alice", "main", 1, 0.5),
			selected("alice", "main", 1),
			published("alice", "main", 1),
		];

		expect(buildTimeline(lone, null).map((item) => item.kind)).toEqual([
			"joined",
			"step",
			"message",
		]);
	});

	it("keeps the id of the event each item comes from", () => {
		const message = buildTimeline(events, null).find(
			(item) => item.kind === "message",
		);
		const source = events.find((event) => event.type === "message.published");

		expect(message).toMatchObject({ eventId: source?.id, content: "hi" });
	});
});

describe("buildTimeline interventions", () => {
	const hello = published("alice", "main", 1);
	const events: AnyEvent[] = [
		joined("alice", "main"),
		joined("bob", "main"),
		instructed("bob", "start formal", 0),
		proposedSpeak("alice", "main", 1),
		selected("alice", "main", 1),
		hello,
		redacted("bob", hello.id, 1),
		proposedSilent("alice", 2),
		proposedSilent("bob", 2),
	];

	it("puts an intervention after the step it follows, and before the first step when it follows none", () => {
		expect(buildTimeline(events, null).map((item) => item.kind)).toEqual([
			"joined",
			"joined",
			"intervention",
			"step",
			"message",
			"intervention",
			"step",
			"silence",
		]);
	});

	it("says which step it takes effect at and what it did", () => {
		const items = buildTimeline(events, null).filter(
			(item) => item.kind === "intervention",
		);

		expect(items).toMatchObject([
			{
				type: "intervention.prompt_injected",
				step: 0,
				appliesAt: 1,
				label: 'Instruction to bob: "start formal"',
			},
			{
				type: "intervention.memory_redacted",
				step: 1,
				appliesAt: 2,
				label: 'Redacted from bob: alice: "hi"',
			},
		]);
	});

	it("keeps the id of the intervention event, so a click opens it", () => {
		const [first] = buildTimeline(events, null).filter(
			(item) => item.kind === "intervention",
		);

		expect(first).toMatchObject({ eventId: events[2]?.id });
	});
});

describe("interventionLabel", () => {
	const proposal = proposedSilent("bob", 1);
	const history: AnyEvent[] = [published("alice", "main", 1), proposal];

	it("names what was redacted: a message, a proposal, or an event it cannot find", () => {
		const [message] = history as [AnyEvent];

		expect(interventionLabel(redacted("bob", message.id, 1), history)).toBe(
			'Redacted from bob: alice: "hi"',
		);
		expect(interventionLabel(redacted("bob", proposal.id, 1), history)).toBe(
			"Redacted from bob: its proposal at step 1",
		);
		expect(interventionLabel(redacted("bob", randomUUID(), 1), history)).toBe(
			"Redacted from bob: an event",
		);
	});

	it("applies at the step after the one it follows", () => {
		expect(appliesAtStep(instructed("bob", "x", 4))).toBe(5);
	});
});

describe("interventionTarget", () => {
	const at = (params: { live: boolean; completed: boolean; step: number }) =>
		interventionTarget({ ...params, scenarioSteps: 5 });

	it("queues for the next step on the live step of a run that is not over", () => {
		expect(at({ live: true, completed: false, step: 3 })).toEqual({
			mode: "queue",
			step: 3,
			appliesAt: 4,
			available: true,
		});
	});

	it("forks from a past step, whatever the state of the run", () => {
		expect(at({ live: false, completed: false, step: 2 }).mode).toBe("fork");
		expect(at({ live: false, completed: true, step: 2 }).mode).toBe("fork");
	});

	it("forks from the last step of a completed run, where there is nothing left to apply to", () => {
		expect(at({ live: true, completed: true, step: 5 })).toMatchObject({
			mode: "fork",
			available: false,
		});
		expect(at({ live: false, completed: true, step: 4 }).available).toBe(true);
	});
});

describe("redactionCandidates", () => {
	const hello = published("alice", "main", 1);
	const mine = proposedSpeak("bob", "main", 1);
	const theirs = proposedSilent("alice", 1);
	const later = published("alice", "main", 2);
	const events: AnyEvent[] = [
		joined("alice", "main"),
		joined("bob", "main"),
		mine,
		theirs,
		hello,
		later,
	];

	it("offers the room's messages and the agent's own proposals, newest first, never another agent's proposals", () => {
		const candidates = redactionCandidates(events, "bob");

		expect(candidates.map((c) => c.eventId)).toEqual([
			later.id,
			hello.id,
			mine.id,
		]);
		expect(candidates.map((c) => c.kind)).toEqual([
			"message",
			"message",
			"proposal",
		]);
	});

	it("includes what happened at the step the view shows, which its own observation does not yet", () => {
		expect(
			redactionCandidates(events, "bob").some((c) => c.eventId === later.id),
		).toBe(true);
	});

	it("flags what an earlier intervention already removed, for that agent only", () => {
		const log: AnyEvent[] = [...events, redacted("bob", hello.id, 2)];

		expect(
			redactionCandidates(log, "bob").find((c) => c.eventId === hello.id),
		).toMatchObject({ redacted: true });
		expect(
			redactionCandidates(log, "alice").find((c) => c.eventId === hello.id),
		).toMatchObject({ redacted: false });
	});

	it("has nothing to offer before anyone spoke or proposed", () => {
		expect(redactionCandidates([joined("bob", "main")], "bob")).toEqual([]);
	});
});

describe("agentSummary", () => {
	const events: AnyEvent[] = [
		joined("alice", "main"),
		joined("bob", "main"),
		proposedSpeakWith("alice", "main", 1, 0.9),
		proposedSpeakWith("bob", "main", 1, 0.2),
		selected("alice", "main", 1),
		published("alice", "main", 1),
		proposedSilent("alice", 2),
		proposedSilent("bob", 2),
	];
	const config = run([{ id: "main", members: ["alice", "bob"] }]);

	it("counts what the agent said, was selected for and kept silent about", () => {
		const alice = agentSummary(config, events, "alice");

		expect(alice).toMatchObject({
			agentId: "alice",
			roomId: "main",
			behavior: "mentioned",
			messageCount: 1,
			timesSelected: 1,
			speakProposals: 1,
			silentProposals: 1,
		});
		expect(agentSummary(config, events, "bob")).toMatchObject({
			messageCount: 0,
			timesSelected: 0,
		});
	});

	it("lists proposals latest first and flags the one that won", () => {
		const alice = agentSummary(config, events, "alice");

		expect(
			alice?.recentProposals.map((p) => [p.step, p.type, p.selected]),
		).toEqual([
			[2, "stay_silent", false],
			[1, "speak", true],
		]);
		expect(alice?.recentProposals[1]).toMatchObject({ urgency: 0.9 });
	});

	it("limits the proposals it keeps", () => {
		const many = Array.from({ length: 8 }, (_, i) =>
			proposedSilent("alice", i + 1),
		);

		expect(
			agentSummary(config, [joined("alice", "main"), ...many], "alice")
				?.recentProposals,
		).toHaveLength(5);
	});

	it("counts the interventions the agent received", () => {
		const withInterventions: AnyEvent[] = [
			...events,
			redacted("alice", randomUUID(), 2),
			instructed("alice", "x", 2),
			redacted("bob", randomUUID(), 2),
		];

		expect(agentSummary(config, withInterventions, "alice")).toMatchObject({
			interventionCount: 2,
			messageCount: 1,
		});
		expect(agentSummary(config, events, "alice")?.interventionCount).toBe(0);
	});

	it("knows nothing about an agent outside the scenario", () => {
		expect(agentSummary(config, events, "ghost")).toBeUndefined();
	});

	it("exposes the persona and model an llm agent was configured with", () => {
		const llm = {
			...config,
			scenario: {
				...config.scenario,
				agents: [
					{
						id: "alice",
						behavior: "llm",
						memory: "last_n",
						persona: "You are a terse pirate.",
						model: "claude-sonnet-5-5",
					},
					{ id: "bob", behavior: "mentioned" },
				],
			},
		} as unknown as RunRecord;

		expect(agentSummary(llm, events, "alice")).toMatchObject({
			persona: "You are a terse pirate.",
			model: "claude-sonnet-5-5",
		});
		expect(agentSummary(llm, events, "bob")).toMatchObject({
			persona: undefined,
			model: undefined,
		});
	});
});

describe("eventsUntil", () => {
	const events: AnyEvent[] = [
		joined("alice", "main"),
		proposedSilent("alice", 1),
		proposedSpeak("alice", "main", 2),
		published("alice", "main", 2),
		proposedSilent("alice", 3),
	];

	it("keeps only the arrivals at step 0", () => {
		expect(eventsUntil(events, 0)).toEqual([events[0]]);
	});

	it("keeps every event up to and including the step", () => {
		expect(eventsUntil(events, 2)).toEqual(events.slice(0, 4));
	});

	it("keeps silent steps, they are part of the trajectory", () => {
		expect(eventsUntil(events, 1)).toEqual(events.slice(0, 2));
		expect(lastStep(eventsUntil(events, 1))).toBe(1);
	});

	it("returns everything past the last step", () => {
		expect(eventsUntil(events, 99)).toEqual(events);
	});
});

describe("observationSummary", () => {
	const history: AnyEvent[] = [
		joined("alice", "main"),
		joined("bob", "main"),
		proposedSpeak("alice", "main", 1),
		proposedSilent("bob", 1),
		published("alice", "main", 1),
		proposedSilent("alice", 2),
	];
	const observation = (agentId: string, step: number) =>
		observationSchema.parse({
			agentId,
			step,
			time: TIME,
			room: {
				roomId: "main",
				members: ["alice", "bob"],
				visibleEvents: history.filter((event) => event.step < step),
			},
		});

	it("lists the messages visible at that step and the agent's own earlier proposals", () => {
		const summary = observationSummary(observation("alice", 3), history);

		expect(summary.messages.map((m) => m.agentId)).toEqual(["alice"]);
		expect(summary.earlierProposals).toBe(2);
		expect(summary.members).toEqual(["alice", "bob"]);
	});

	it("shows an empty room at the first step", () => {
		const summary = observationSummary(observation("bob", 1), history);

		expect(summary.messages).toEqual([]);
		expect(summary.earlierProposals).toBe(0);
	});

	it("shows the instructions the agent was given and what was removed from its view", () => {
		const said = history.find(
			(e) => e.type === "message.published",
		) as AnyEvent;
		const log: AnyEvent[] = [...history, redacted("alice", said.id, 2)];
		const withInstruction = observationSchema.parse({
			agentId: "alice",
			step: 3,
			time: TIME,
			room: { roomId: "main", members: ["alice", "bob"], visibleEvents: [] },
			instructions: ["Answer in French."],
		});

		const summary = observationSummary(withInstruction, log);

		expect(summary.instructions).toEqual(["Answer in French."]);
		expect(summary.redacted).toMatchObject([
			{ targetEventId: said.id, label: 'alice: "hi"' },
		]);
	});

	it("does not show a redaction before the step it takes effect at, nor another agent's", () => {
		const said = history.find(
			(e) => e.type === "message.published",
		) as AnyEvent;
		const log: AnyEvent[] = [
			...history,
			redacted("alice", said.id, 2),
			redacted("bob", said.id, 2),
		];

		expect(observationSummary(observation("alice", 2), log).redacted).toEqual(
			[],
		);
		expect(
			observationSummary(observation("alice", 3), log).redacted,
		).toHaveLength(1);
	});

	it("points at the prompt recorded for that agent and step, if any", () => {
		const built = prompt("alice", 3);
		const events = [...history, built, prompt("bob", 3)];

		expect(
			observationSummary(observation("alice", 3), events).promptEventId,
		).toBe(built.id);
		expect(
			observationSummary(observation("alice", 2), events).promptEventId,
		).toBeUndefined();
	});
});

describe("filterEvents", () => {
	const events: AnyEvent[] = [
		joined("alice", "main"),
		joined("bob", "main"),
		proposedSpeak("alice", "main", 1),
		proposedSilent("bob", 1),
		published("alice", "main", 1),
	];

	it("keeps everything when no filter is set", () => {
		expect(filterEvents(events, NO_FILTER)).toEqual(events);
	});

	it("keeps the events of the chosen agents", () => {
		const result = filterEvents(events, {
			...NO_FILTER,
			agentIds: new Set(["bob"]),
		});
		expect(result.map((e) => e.agentId)).toEqual(["bob", "bob"]);
	});

	it("keeps the chosen types, several at once", () => {
		const result = filterEvents(events, {
			...NO_FILTER,
			types: new Set(["agent.joined", "message.published"] as const),
		});
		expect(result.map((e) => e.type)).toEqual([
			"agent.joined",
			"agent.joined",
			"message.published",
		]);
	});

	it("combines agents and types", () => {
		const result = filterEvents(events, {
			agentIds: new Set(["alice"]),
			types: new Set(["action.proposed"] as const),
		});
		expect(result).toEqual([events[2]]);
	});
});

describe("EVENT_TYPES", () => {
	it("lists every event type the schema knows", () => {
		expect([...EVENT_TYPES].sort()).toEqual([
			"action.proposed",
			"action.selected",
			"agent.joined",
			"agent.prompt_built",
			"intervention.memory_redacted",
			"intervention.prompt_injected",
			"message.published",
		]);
	});
});

describe("modelCallLabel", () => {
	it("shows the model and the tokens the prompt event recorded", () => {
		expect(
			modelCallLabel(
				promptWith("alice", 1, {
					model: "claude-sonnet-5-5",
					usage: { inputTokens: 40, outputTokens: 7 },
				}),
			),
		).toBe("claude-sonnet-5-5 · 40 in / 7 out tokens");
	});

	it("shows what is there when only part of it was recorded", () => {
		expect(
			modelCallLabel(promptWith("alice", 1, { model: "claude-opus-5-5" })),
		).toBe("claude-opus-5-5");
		expect(
			modelCallLabel(
				promptWith("alice", 1, { usage: { inputTokens: 1, outputTokens: 2 } }),
			),
		).toBe("1 in / 2 out tokens");
	});

	it("has nothing to show for a prompt recorded without a model call", () => {
		expect(modelCallLabel(prompt("alice", 1))).toBeUndefined();
	});
});

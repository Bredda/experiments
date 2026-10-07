import { observationSchema } from "@experiments/types";
import {
	type ActionProposal,
	type ModelCall,
	type Prompt,
	speak,
} from "@experiments/types/actions";
import {
	type AnyEvent,
	actionProposedSchema,
	messagePublishedSchema,
} from "@experiments/types/events";
import { type AgentId, newEventId, type RoomId } from "@experiments/types/ids";
import { describe, expect, it } from "vitest";
import { LLMAgent } from "./llmAgent";
import type { Proposal } from "./proposal";
import type { ProposalRunner, RunnerResult } from "./runner";

// Importing the engine registers the built-in memory kinds.
import "@experiments/engine";

const alice = "alice" as AgentId;
const bob = "bob" as AgentId;
const roomId = "main" as RoomId;
const time = "2026-01-01T00:00:00.000Z";

const call: ModelCall = {
	model: "claude-sonnet-5-5",
	usage: { inputTokens: 40, outputTokens: 7 },
};

function message(step: number, content: string): AnyEvent {
	return messagePublishedSchema.parse({
		id: newEventId(),
		timestamp: time,
		step,
		type: "message.published",
		agentId: bob,
		roomId,
		content,
	});
}

function ownProposal(step: number, reasoning: string): AnyEvent {
	return actionProposedSchema.parse({
		id: newEventId(),
		timestamp: time,
		step,
		type: "action.proposed",
		agentId: alice,
		action: { type: "stay_silent", agentId: alice, reasoning },
	});
}

function observe(events: AnyEvent[], instructions?: string[]) {
	return observationSchema.parse({
		agentId: alice,
		step: events.length + 1,
		time,
		room: { roomId, visibleEvents: events, members: [alice, bob] },
		instructions,
	});
}

/** A runner that answers with `proposal` and remembers what it was asked. */
function fakeRunner(proposal: Proposal) {
	const prompts: Prompt[] = [];
	const runner: ProposalRunner = async (prompt): Promise<RunnerResult> => {
		prompts.push(prompt);
		return { proposal, call };
	};

	return { runner, prompts };
}

const speaks: Proposal = {
	reasoning: "Greeting is polite.",
	proposedAction: "speak",
	messageContent: "Hello bob",
	urgency: 0.8,
	confidence: 0.9,
};

const silent: Proposal = {
	reasoning: "Nothing to add.",
	proposedAction: "stay_silent",
	urgency: 0,
	confidence: 0.6,
};

function agent(
	runner: ProposalRunner,
	options: {
		persona?: string;
		memoryType?: "sliding_window" | "last_n";
	} = {},
) {
	return new LLMAgent(
		alice,
		"alice",
		roomId,
		"memoryType" in options ? options.memoryType : "sliding_window",
		{ runner, persona: options.persona },
	);
}

describe("LLMAgent prompt", () => {
	it("keeps the default opening when there is no persona", async () => {
		const { runner, prompts } = fakeRunner(silent);

		await agent(runner).propose(observe([]));

		expect(prompts[0]?.[0]?.content).toContain(
			"You entered an empty chatbot. Your name is alice.",
		);
	});

	it("replaces the default opening with the persona and keeps the name", async () => {
		const { runner, prompts } = fakeRunner(silent);

		await agent(runner, { persona: "You are a terse pirate." }).propose(
			observe([]),
		);

		const system = prompts[0]?.[0]?.content ?? "";
		expect(system).toContain("You are a terse pirate. Your name is alice.");
		expect(system).not.toContain("empty chatbot");
	});

	it("sends one system message first, then the user turn", async () => {
		const { runner, prompts } = fakeRunner(silent);

		await agent(runner).propose(observe([message(1, "hi alice")]));

		expect(prompts[0]?.map((part) => part.role)).toEqual(["system", "user"]);
	});

	it("puts what the memory kind lets the agent remember in the prompt", async () => {
		const events = Array.from({ length: 8 }, (_, i) =>
			message(i + 1, `line-${i + 1}`),
		);
		const full = fakeRunner(silent);
		const windowed = fakeRunner(silent);

		await agent(full.runner, { memoryType: "sliding_window" }).propose(
			observe(events),
		);
		await agent(windowed.runner, { memoryType: "last_n" }).propose(
			observe(events),
		);

		expect(full.prompts[0]?.[0]?.content).toContain("line-1");
		expect(windowed.prompts[0]?.[0]?.content).not.toContain("line-1");
		expect(windowed.prompts[0]?.[0]?.content).toContain("line-8");
	});

	it("is unchanged by an empty list of instructions", async () => {
		const without = fakeRunner(silent);
		const empty = fakeRunner(silent);

		await agent(without.runner).propose(observe([]));
		await agent(empty.runner).propose(observe([], []));

		expect(empty.prompts).toEqual(without.prompts);
		expect(without.prompts[0]?.[0]?.content).not.toContain("<instructions>");
	});

	it("adds the experimenter's instructions to the single system message", async () => {
		const { runner, prompts } = fakeRunner(silent);

		const proposal = await agent(runner).propose(
			observe([], ["Answer only in French.", "Be brief."]),
		);

		expect(prompts[0]?.map((part) => part.role)).toEqual(["system", "user"]);
		expect(prompts[0]?.[0]?.content).toContain(
			"<instructions>\nAnswer only in French.\nBe brief.\n</instructions>",
		);
		// The recorded prompt is the one sent, so the effect is traceable.
		expect(proposal.prompt).toEqual(prompts[0]);
	});

	it("includes the agent's own earlier reasoning", async () => {
		const { runner, prompts } = fakeRunner(silent);

		await agent(runner).propose(observe([ownProposal(1, "remember the plan")]));

		expect(prompts[0]?.[0]?.content).toContain("remember the plan");
	});
});

describe("LLMAgent proposal", () => {
	it("maps a speak answer to a speak action", async () => {
		const { runner } = fakeRunner(speaks);

		const proposal = await agent(runner).propose(observe([]));

		expect(proposal.action).toMatchObject(
			speak({
				agentId: alice,
				roomId,
				content: "Hello bob",
				reasoning: "Greeting is polite.",
				urgency: 0.8,
			}),
		);
		expect(proposal.confidence).toBe(0.9);
	});

	it("maps a stay_silent answer to a stay_silent action", async () => {
		const { runner } = fakeRunner(silent);

		const proposal = await agent(runner).propose(observe([]));

		expect(proposal.action).toMatchObject({
			type: "stay_silent",
			agentId: alice,
			reasoning: "Nothing to add.",
		});
	});

	it("returns the prompt it sent and the model call behind it", async () => {
		const { runner, prompts } = fakeRunner(speaks);

		const proposal: ActionProposal = await agent(runner).propose(observe([]));

		expect(proposal.prompt).toEqual(prompts[0]);
		expect(proposal.meta).toEqual(call);
	});

	it("does not swallow a failing model call", async () => {
		const failing: ProposalRunner = async () => {
			throw new Error("model unavailable");
		};

		await expect(agent(failing).propose(observe([]))).rejects.toThrow(
			"model unavailable",
		);
	});

	it("requires a memory kind", () => {
		const { runner } = fakeRunner(silent);

		expect(() => agent(runner, { memoryType: undefined })).toThrow(
			"requires a memoryType",
		);
	});
});

import {
	type ScenarioConfig,
	scenarioConfigSchema,
} from "@experiments/types/scenario";
import { describe, expect, it } from "vitest";

function scenario(agent: Record<string, unknown>): unknown {
	return {
		name: "test",
		seed: "ABC123",
		agents: [{ id: "alice", ...agent }],
		rooms: [{ id: "main", members: ["alice"] }],
		scheduler: { type: "highest_urgency" },
		steps: 3,
	} satisfies Record<string, unknown>;
}

describe("agent persona and model", () => {
	it("accepts both on an llm agent", () => {
		const parsed: ScenarioConfig = scenarioConfigSchema.parse(
			scenario({
				behavior: "llm",
				memory: "sliding_window",
				persona: "You are a terse engineer.",
				model: "claude-sonnet-5-5",
			}),
		);

		expect(parsed.agents[0]?.persona).toBe("You are a terse engineer.");
		expect(parsed.agents[0]?.model).toBe("claude-sonnet-5-5");
	});

	it("stays valid without them", () => {
		expect(() =>
			scenarioConfigSchema.parse(
				scenario({ behavior: "llm", memory: "sliding_window" }),
			),
		).not.toThrow();
	});

	it.each([
		{ persona: "You are a terse engineer." },
		{ model: "claude-sonnet-5-5" },
	])("rejects $persona$model on an agent that is not llm", (extra) => {
		const result = scenarioConfigSchema.safeParse(
			scenario({ behavior: "mentioned", ...extra }),
		);

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("only valid for");
	});

	it("rejects an unknown model and a blank persona", () => {
		for (const extra of [{ model: "gpt-5" }, { persona: "   " }]) {
			expect(
				scenarioConfigSchema.safeParse(scenario({ behavior: "llm", ...extra }))
					.success,
			).toBe(false);
		}
	});
});

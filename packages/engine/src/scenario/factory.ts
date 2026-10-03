import type { MemoryType } from "@experiments/types";
import type { AgentId, RoomId } from "@experiments/types/ids";
import { newRunId } from "@experiments/types/ids";
import type { ScenarioConfig } from "@experiments/types/scenario";
import type { Agent } from "../agent";
import { agentBehaviorRegistry } from "../agents/registry";
import { Room } from "../room";
import { RunConfig } from "../runConfig";
import { createScheduler } from "../scheduler/registry";
import { Simulation } from "../simulation";

function buildAgent(params: {
	agentId: string;
	behavior: string;
	roomId: RoomId;
	memory?: MemoryType;
}): Agent {
	const factory = agentBehaviorRegistry.get(params.behavior);
	return factory(
		params.agentId as AgentId,
		params.agentId,
		params.roomId,
		params.memory,
	);
}

export function buildRun(scenario: ScenarioConfig) {
	const runId = newRunId();
	const roomConfig = scenario.rooms[0];

	if (roomConfig === undefined) {
		throw new Error("Scenario has no rooms defined");
	}

	const roomId = roomConfig.id as RoomId;
	const room = new Room({ id: roomId, name: roomConfig.id });

	const agents = scenario.agents.map((agent) =>
		buildAgent({
			agentId: agent.id,
			behavior: agent.behavior,
			roomId,
			memory: agent.memory,
		}),
	);

	const simulation = new Simulation({
		runId,
		room,
		agents,
		scheduler: createScheduler(scenario.scheduler),
		config: new RunConfig({ runId, seed: scenario.seed }),
	});

	return { runId, simulation };
}

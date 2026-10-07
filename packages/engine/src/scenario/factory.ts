import type { RunStore } from "@experiments/db";
import type { MemoryType } from "@experiments/types";
import type { AgentId, RoomId, RunId } from "@experiments/types/ids";
import { newRunId } from "@experiments/types/ids";
import type { RunRecord } from "@experiments/types/run";
import type { ScenarioConfig } from "@experiments/types/scenario";
import type { Agent } from "../agent";
import { agentBehaviorRegistry } from "../agents/registry";
import { RunNotFoundError } from "../errors";
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
	return factory({
		agentId: params.agentId as AgentId,
		name: params.agentId,
		roomId: params.roomId,
		memoryType: params.memory,
	});
}

/** Builds a fresh, not yet started simulation from a scenario. */
export function buildRun(
	scenario: ScenarioConfig,
	options?: { runId?: RunId; store?: RunStore },
) {
	const runId = options?.runId ?? newRunId();
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
		store: options?.store,
	});

	return { runId, simulation };
}

/**
 * Rebuilds a simulation from what the store holds for a run, ready to take its
 * next step. `lastEventId` is the id of the latest stored event, so callers can
 * read back only what a step adds.
 */
export function loadSimulation(
	store: RunStore,
	runId: RunId,
): { run: RunRecord; simulation: Simulation; lastEventId: number } {
	const run = store.getRun(runId);

	if (run === undefined) {
		throw new RunNotFoundError(runId);
	}

	const records = store.listEvents(runId);
	const { simulation } = buildRun(run.scenario, { runId, store });

	simulation.restore(records.map((record) => record.payload));

	return { run, simulation, lastEventId: records.at(-1)?.id ?? 0 };
}

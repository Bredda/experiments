import type { RunStore } from "@experiments/db";
import type { AgentId, RoomId, RunId } from "@experiments/types/ids";
import { newRunId } from "@experiments/types/ids";
import type { RunRecord } from "@experiments/types/run";
import type { AgentConfig, ScenarioConfig } from "@experiments/types/scenario";
import type { Agent } from "../agent";
import { agentBehaviorRegistry } from "../agents/registry";
import { RunNotFoundError } from "../errors";
import { Room } from "../room";
import { RunConfig } from "../runConfig";
import { createScheduler } from "../scheduler/registry";
import { Simulation } from "../simulation";

function buildAgent(config: AgentConfig, roomId: RoomId): Agent {
	const factory = agentBehaviorRegistry.get(config.behavior);
	return factory({
		agentId: config.id as AgentId,
		name: config.id,
		roomId,
		memoryType: config.memory,
		persona: config.persona,
		model: config.model,
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

	const agents = scenario.agents.map((agent) => buildAgent(agent, roomId));

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

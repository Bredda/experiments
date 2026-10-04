# Engine reference

Code: `packages/engine/src`, schemas in `packages/types/src`, persistence in `packages/db/src`.

## Flow

```text
POST /runs body ──scenarioConfigSchema.parse──▶ ScenarioConfig
createRun:  buildRun ─▶ store.createRun ─▶ simulation.setup()          (agents join)
stepRun:    loadSimulation(store, runId) ─▶ simulation.step() ─▶ status update
```

`createRun` (`scenario/runner.ts`) persists the run and runs `setup()`; it does not step. `stepRun(store, runId)` advances one step and returns the updated run plus only the events that step added. It keeps no state between calls: `loadSimulation` rebuilds the simulation from the stored scenario and events (`Simulation.restore` re-joins agents, refills the event log, seeks the clock). Typed errors (`RunNotFoundError`, `RunCompletedError`, `RunBusyError`) are exported for adapters to map to HTTP codes. The engine currently supports exactly one room per scenario even though the schema allows several.

Run status is `created | running | completed` (`runStatusSchema`). `stepRun` sets `running` after the first step and `completed` once the clock reaches `scenario.steps`; one step at a time per run is enforced in-process.

## Simulation.step()

`step()` is async because agents may call out to an LLM, and it is **atomic**: all events are persisted in one transaction at the end, and if any agent throws nothing is recorded and the clock is rewound.

1. `clock.advance()`. Always, even if nothing happens afterwards.
2. All agents observe the history as of the start of the step (never each other's same-step proposals) and their `propose` calls run concurrently (`Promise.allSettled`). Calls already in flight are not cancelled when one fails: the step waits for all of them, throws the first failure in agent order, and records nothing. Events are then built in agent order, so the log does not depend on which call finished first.
3. If the proposal carries a `prompt`, emit `agent.prompt_built`. Always emit `action.proposed`.
4. Only `speak` proposals become scheduler candidates. `stay_silent` is recorded but never selected.
5. If there are candidates, `scheduler.select(candidates, rng)` picks one, then `action.selected` and `message.published` are emitted.

`Simulation.observationsAt(step)` (use case `getObservations(store, runId, step)`) rebuilds what every agent observed at a played step: the history with `event.step < step`, at the time of that step. It goes through the same private helper (`#observe`) as a real step, so replay cannot diverge from what the agents were given. Read-only; a step that was not played throws `StepNotFoundError` (404 over HTTP).

Randomness is `config.rngForStep(step)`, derived from `(seed, step)`, so a step gives the same result whether the simulation ran continuously or was rebuilt just before it.

## Events

All events share `id`, `timestamp` (simulation time, ISO), `step`, and a literal `type`. The union is `anyEventSchema` in `packages/types/src/events.ts`.

| type | Emitted when |
| --- | --- |
| `agent.joined` | `setup()` |
| `agent.prompt_built` | an agent returns a prompt (LLM agents) |
| `action.proposed` | every agent, every step |
| `action.selected` | the scheduler picks a candidate |
| `message.published` | the selected action is `speak` |

Every event is persisted to the `RunStore`.

Actions (`packages/types/src/actions.ts`): `speak` (with `urgency`, `relevance`, `socialCost`) and `stay_silent`, discriminated by `type`. An `ActionProposal` wraps an action with `confidence` and an optional `prompt`.

## Pluggable parts

| Part | Closed set (types) | Implementation (engine) |
| --- | --- | --- |
| Agent behavior | `AGENT_BEHAVIORS` in `types/src/scenario.ts` | `agents/registry.ts` (`agentBehaviorRegistry`) |
| Scheduler | `schedulerTypeSchema` in `types/src/scenario.ts` | `scheduler/registry.ts` (`schedulers` record) |
| Memory | `MEMORY_KINDS` in `types/src/memory.ts` | `memory/index.ts` (`registerMemory`) |

The `llm` behavior is registered by a side effect of importing `@experiments/ai`, which the engine cannot import. `apps/api` does that import; any other entry point that must run `llm` agents has to do the same.

## Scenarios

A scenario is a `ScenarioConfig` (`scenarioConfigSchema`, strict: unknown keys are rejected; rooms may only reference declared agents; seed is `0-9A-Z` only). It is not read from files: the UI builds it and sends it to `POST /runs`, and the run stores it as JSON.

## Persistence

`RunStore` (SQLite at `DB_PATH`, default `./simulation.db`) has three tables: `runs`, `scenarios` (scenario JSON per run), `events` (append-only, `payload_json` holds the full event). Event rows get an autoincrement `id`; `listEvents(runId, sinceId)` supports incremental reads.

`appendEvents` is transactional. `EventLog` is the in-memory log used to build room views and is only extended after a successful write. It can still dump JSONL via `exportEvents`, but JSONL files are no longer the run artifact.

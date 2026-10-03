# Engine reference

Code: `packages/engine/src`, schemas in `packages/types/src`, persistence in `packages/db/src`.

## Flow

```text
scenario YAML ──loadScenario (Zod)──▶ ScenarioConfig
ScenarioConfig ──buildRun──▶ Simulation (Room, Agents, Scheduler, RunConfig)
createRun: store.createRun(...) then simulation.setup(store)
```

`createRun` (`scenario/runner.ts`) persists the run and runs `setup()` (agents join the room, `agent.joined` events). It does not step the simulation. The engine currently supports exactly one room per scenario even though the schema allows several.

Run status is `created | running | completed` (`runStatusSchema`).

## Simulation.step()

`step()` is async because agents may call out to an LLM.

1. `clock.advance()`. Always, even if nothing happens afterwards.
2. For each agent: `room.view` → `agent.observe` → `await agent.propose`.
3. If the proposal carries a `prompt`, emit `agent.prompt_built`. Always emit `action.proposed`.
4. Only `speak` proposals become scheduler candidates. `stay_silent` is recorded but never selected.
5. If there are candidates, `scheduler.select(candidates, rng)` picks one, then `action.selected` and `message.published` are emitted.

## Events

All events share `id`, `timestamp` (simulation time, ISO), `step`, and a literal `type`. The union is `anyEventSchema` in `packages/types/src/events.ts`.

| type | Emitted when | Persisted to RunStore |
| --- | --- | --- |
| `agent.joined` | `setup()` | yes |
| `agent.prompt_built` | an agent returns a prompt (LLM agents) | yes |
| `action.proposed` | every agent, every step | yes |
| `action.selected` | the scheduler picks a candidate | no, in-memory `EventLog` only |
| `message.published` | the selected action is `speak` | no, in-memory `EventLog` only |

The last two rows reflect `Simulation.step()` today (see the comment there). Check before relying on them being queryable from the DB or API.

Actions (`packages/types/src/actions.ts`): `speak` (with `urgency`, `relevance`, `socialCost`) and `stay_silent`, discriminated by `type`. An `ActionProposal` wraps an action with `confidence` and an optional `prompt`.

## Pluggable parts

| Part | Closed set (types) | Implementation (engine) |
| --- | --- | --- |
| Agent behavior | `AGENT_BEHAVIORS` in `types/src/scenario.ts` | `agents/registry.ts` (`agentBehaviorRegistry`) |
| Scheduler | `schedulerTypeSchema` in `types/src/scenario.ts` | `scheduler/registry.ts` (`schedulers` record) |
| Memory | `MEMORY_KINDS` in `types/src/memory.ts` | `memory/index.ts` (`registerMemory`) |

The `llm` behavior is registered by a side effect of importing `@experiments/ai`, which the engine cannot import. A process that must run `llm` agents has to import that package itself.

## Scenarios

Scenarios live in `scenarios/*.yml` and are validated by `scenarioConfigSchema` (strict: unknown keys are rejected; rooms may only reference declared agents; seed is `0-9A-Z` only). Directory is `SCENARIOS_DIRECTORY`.

## Persistence

`RunStore` (SQLite at `DB_PATH`, default `./simulation.db`) has three tables: `runs`, `scenarios` (scenario JSON per run), `events` (append-only, `payload_json` holds the full event). Event rows get an autoincrement `id`; `listEvents(runId, sinceId)` supports incremental reads.

`EventLog` is the in-memory log used to build room views. It can still dump JSONL via `exportEvents`, but JSONL files are no longer the run artifact.

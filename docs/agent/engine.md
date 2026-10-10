# Engine reference

Code: `packages/engine/src`, schemas in `packages/types/src`, persistence in `packages/db/src`.

## Flow

```text
POST /runs body ──scenarioConfigSchema.parse──▶ ScenarioConfig
createRun:  buildRun ─▶ store.createRun ─▶ simulation.setup()          (agents join)
stepRun:    loadSimulation(store, runId) ─▶ buildInterventionEvents ─▶ simulation.step(interventions) ─▶ status update
```

`createRun` (`scenario/runner.ts`) persists the run and runs `setup()`; it does not step. `stepRun(store, runId)` advances one step and returns the updated run plus only the events that step added. It keeps no state between calls: `loadSimulation` rebuilds the simulation from the stored scenario and events (`Simulation.restore` re-joins agents, refills the event log, seeks the clock). Typed errors (`RunNotFoundError`, `RunCompletedError`, `RunBusyError`) are exported for adapters to map to HTTP codes. The engine currently supports exactly one room per scenario even though the schema allows several.

Run status is `created | running | completed` (`runStatusSchema`). `stepRun` sets `running` after the first step and `completed` once the clock reaches `scenario.steps`; one step at a time per run is enforced in-process.

## Forks

`forkRun(store, runId, { step, name, purpose, interventions? })` creates a run that starts with a **copy** of the parent's events up to `step` (inclusive; 0 keeps only the `agent.joined` arrivals), with the parent's scenario (renamed) and seed. Payloads are copied as they are, event ids included, so within one run ids stay unique and across runs the shared prefix is recognizable. The fork's status follows its step (`created` at 0, `completed` at `scenario.steps`, else `running`) and from there it is stepped like any run: `loadSimulation`, observations and export need no special case. A step outside 0..latest played step throws `StepNotFoundError`. The parent is never modified. With `interventions`, they are validated against the parent's history up to `step` and recorded in the fork right after the copy, in the same transaction (`RunStore.createFork` takes the extra `events`); they take effect at `step + 1`. Forking at the last step with interventions throws `InvalidInterventionError`, since there is no step left to apply them to. Because a fork copies the parent's events up to `step`, it also inherits the interventions its parent had recorded there; they are indistinguishable from the fork's own ones in the log (see the backlog).

Reproducibility of a fork: its history up to `step` is copied, not recomputed, so a fork is reproducible from scenario + seed + lineage. With deterministic agents it continues exactly like its parent (covered in `fork.test.ts`); with LLM agents it is a new sample from `step` on.

`getForkTree(store, runId)` returns the whole tree that contains a run (root, ancestors, siblings, descendants) as nodes with parent, fork step, purpose, planned and played steps.

## Simulation.step()

`step(interventions?)` is async because agents may call out to an LLM, and it is **atomic**: all events, interventions first, are persisted in one transaction at the end, and if any agent throws nothing is recorded and the clock is rewound.

1. `clock.advance()`. Always, even if nothing happens afterwards.
2. All agents observe the history as of the start of the step (never each other's same-step proposals), plus the interventions this step was given (see [Interventions](#interventions)) and their `propose` calls run concurrently (`Promise.allSettled`). Calls already in flight are not cancelled when one fails: the step waits for all of them, throws the first failure in agent order, and records nothing. Events are then built in agent order, so the log does not depend on which call finished first.
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
| `agent.prompt_built` | an agent returns a prompt (LLM agents); also carries `model` and `usage` (`inputTokens`, `outputTokens`) when the agent reports the model call, absent otherwise and on older runs |
| `action.proposed` | every agent, every step |
| `action.selected` | the scheduler picks a candidate |
| `message.published` | the selected action is `speak` |
| `intervention.prompt_injected` | the experimenter gives an `llm` agent a system instruction for the next step (`agentId`, `content`) |
| `intervention.memory_redacted` | the experimenter removes an event from one agent's view from the next step on (`agentId`, `targetEventId`) |

Every event is persisted to the `RunStore`.

## Interventions

An intervention is something the experimenter does to a run, recorded as an event so the run stays replayable and comparable. Two exist: a **system instruction** for one agent for one step, and the **redaction** of a message or of the agent's own proposal from that agent's view. Their request shapes (`interventionSchema`, discriminated by `type`) are in `packages/types/src/interventions.ts`; the recorded event is the same body plus `id`, `timestamp` and `step` (`events.ts`), so a request and the fact it becomes share one definition. Adding a type means a new member there, an event, and a reader in `packages/engine/src/interventions.ts`; nothing existing changes.

- **Recorded between steps.** An intervention recorded at step N has `step: N` and the timestamp of step N, and takes effect from step N + 1: an instruction at N + 1 only, a redaction from N + 1 on. It is stored after step N's events, so `restore`, the clock and the played-step bound are not moved by it. `observationsAt(s)` (history with `step < s`) therefore includes exactly what was in effect at `s`, and never an intervention recorded at `s` itself.
- **Applied atomically.** `stepRun(store, runId, { interventions })` validates them against the run, builds the events (`buildInterventionEvents`) and passes them to `Simulation.step`, which makes them part of the history the agents observe and commits them with the step's events: if a step fails, no intervention is recorded either. `forkRun(..., { interventions })` records them in the fork instead (see Forks). There is no server-side pending state: the ui keeps drafts and sends them with the step or the fork.
- **Validation** (`InvalidInterventionError`, 400 over HTTP): the agent exists; an instruction needs an `llm` agent (like `persona`, it is rejected on the other behaviors); a redaction target must be a `message.published`, or an `action.proposed` of that same agent, recorded at or before step N, and not already redacted for that agent; and there must be a next step, so interventions on a completed run are rejected.
- **What the agent sees.** Agents never see interventions as events: `Room.view` drops every `intervention.*` event and, for the observing agent, the events its redactions target. A redaction thus changes what the agent perceives, and memory inherits that, whatever its kind (memory stays stateless). A system instruction reaches the agent as `Observation.instructions` (those recorded at `observation.step - 1` for that agent), and `LLMAgent` appends them to the single system message in an `<instructions>` block, so they appear in the `agent.prompt_built` event of that step.
- **Reproducibility.** Interventions are part of the scenario's trajectory: the same scenario, seed and interventions give the same events (a redaction's `targetEventId` is an execution-specific id, like every event id, so compare behavior without ids).

Not built yet: inserting a memory that never existed, multimodal content, and interventions scripted in the scenario (`roadmap.md`, axis 4).

Actions (`packages/types/src/actions.ts`): `speak` (with `urgency`, `relevance`, `socialCost`) and `stay_silent`, discriminated by `type`. An `ActionProposal` wraps an action with `confidence` and an optional `prompt`.

## Pluggable parts

| Part | Closed set (types) | Implementation (engine) |
| --- | --- | --- |
| Agent behavior | `AGENT_BEHAVIORS` in `types/src/scenario.ts` | `agents/registry.ts` (`agentBehaviorRegistry`) |
| Scheduler | `schedulerTypeSchema` in `types/src/scenario.ts` | `scheduler/registry.ts` (`schedulers` record) |
| Memory | `MEMORY_KINDS` in `types/src/memory.ts` | `memory/index.ts` (`registerMemory`) |

Memory kinds: `sliding_window` keeps every message the agent can see and all of its own proposals; `last_n` keeps only the last `LAST_N` (5) of each. Memory is stateless: a slice is recomputed from the visible events at each step.

The `llm` behavior is registered by a side effect of importing `@experiments/ai`, which the engine cannot import. `apps/api` does that import; any other entry point that must run `llm` agents has to do the same.

## Scenarios

A scenario is a `ScenarioConfig` (`scenarioConfigSchema`, strict: unknown keys are rejected; rooms may only reference declared agents; seed is `0-9A-Z` only). An agent is `{ id, behavior, memory?, persona?, model? }`: `persona` (instructions that replace the default opening sentence of the prompt) and `model` (`AGENT_MODELS`, `DEFAULT_AGENT_MODEL` when absent) only exist for the `llm` behavior and are rejected on the others. Without them an `llm` agent gets the prompt and model it always had. It is not read from files: the UI builds it and sends it to `POST /runs`, and the run stores it as JSON.

## Persistence

`RunStore` (SQLite at `DB_PATH`, default `./simulation.db`) has five tables: `runs`, `scenarios` (scenario JSON per run), `events` (append-only, `payload_json` holds the full event), `forks` (`run_id`, `parent_run_id`, `step`, `purpose`: one row per forked run) and `run_meta` (`run_id`, `notes`, `archived`: what the experimenter says about a run; a run without a row has no notes and is not archived). `forks` and `run_meta` are separate tables so existing databases need no migration: they are created empty when the database is opened. There is no migration mechanism, so a change to an existing table's columns would need one. `createFork` writes the run, its scenario, its lineage and the copied events in one transaction, and `getForkTree` walks the lineage with recursive queries. `deleteRun` is transactional and fails, deleting nothing, while other runs were forked from the run.

The engine use cases around it, `updateRun` and `deleteRun` (`scenario/runner.ts`), are what the API calls. `updateRun` renames a run (the store also rewrites the name inside the stored scenario, as a fork does, so the two never disagree), sets its notes or archives it; it touches no event and is allowed while a step runs. `deleteRun` throws `RunNotFoundError`, `RunBusyError` while a step of that run executes, and `RunHasForksError` while other runs were forked from it: a fork copies its parent's history, so deleting the parent would leave its lineage pointing at nothing, and archiving is the way out. Deleting a fork first makes its parent deletable. Event rows get an autoincrement `id`; `listEvents(runId, sinceId)` supports incremental reads.

`appendEvents` is transactional. `EventLog` is the in-memory log used to build room views and is only extended after a successful write. It can still dump JSONL via `exportEvents`, but JSONL files are no longer the run artifact.

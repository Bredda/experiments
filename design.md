# experiments — Technical Design

## 1. Overview

`experiments` is an environment for running and inspecting multi-agent simulations. Its purpose is to make multi-agent behavior configurable, observable and reproducible, with a focus on interaction dynamics: observation, communication, silence, memory and scheduling.

It is not a generic production agent framework.

## 2. Architecture

A TypeScript monorepo (pnpm workspaces, Turborepo).

```text
apps/ui ──HTTP──▶ apps/api ──▶ packages/engine ──▶ packages/db (SQLite)
                                     ▲
                              packages/ai (LLM behaviors)

packages/types     Zod schemas shared by all workspaces
packages/settings  environment parsing
```

- `packages/types` is the single source of truth for events, actions, scenarios and run records. Schemas are Zod; types are inferred from them. The API converts them to JSON Schema for OpenAPI, and the UI imports them directly. There is no code generation.
- `packages/engine` owns simulation semantics and must not depend on HTTP, React, or an LLM provider. Persistence goes through `RunStore`.
- `packages/ai` registers LLM-backed agent behaviors into the engine. The engine never imports it.
- `apps/api` is a thin adapter: validation, serialization, HTTP.
- `apps/ui` talks to the API over HTTP only.

## 3. Simulation model

```text
agents observe → agents propose actions → scheduler selects → action executes
      → events recorded → simulation time advances
```

Agents never mutate the simulation directly; intent is expressed as actions, and facts are recorded as events.

A run advances one step at a time, on request. Within a step, agents propose concurrently: they all observe the same history, so a step lasts as long as its slowest agent rather than the sum of them. Each step is atomic: its events are persisted together once every agent has answered, and a failed step (for example an LLM error) leaves no trace and can be retried. The simulation is rebuilt from the stored scenario and events before each step, so the API holds no simulation state between requests.

## 4. Time

Simulation time is controlled by `SimulationClock` and advances on every step, including steps where nobody acts. Silence is part of the trajectory:

```text
step 0  agents join
step 1  Alice speaks
step 2  silence
step 3  silence
step 4  Bob speaks
```

Wall-clock time is separate and must never influence behavior.

## 5. Events and actions

Events are immutable facts with `id`, simulation `timestamp`, `step`, and an explicit `type`:

```text
agent.joined   agent.prompt_built   action.proposed   action.selected   message.published
```

Actions are discriminated by `type` too: `speak` (with `urgency`, `relevance`, `socialCost`) and `stay_silent`. An `ActionProposal` wraps an action with a `confidence` and an optional prompt. Types are never inferred from payload shape.

## 6. Agents, rooms and observation

An agent exposes `observe` and `propose`. It receives an `Observation` (agent id, step, time, and a `RoomView`) rather than the whole world. `Room` owns membership and builds the view; visibility rules live there, so they can change without changing the agent contract. Today every member sees the full public event history.

An agent's behavior is pluggable (`mentioned`, `silent`, `llm`), as is its memory (`sliding_window`), which turns a room view into a memory slice for prompting.

## 7. Scheduling

The scheduler is separate from agents so arbitration policies are interchangeable. Only `speak` proposals are candidates. Implemented policies: `highest_urgency` and `weighted_random`, the latter using the rng of the current step.

## 8. Scenarios

An experiment is described by a `ScenarioConfig`, validated by `scenarioConfigSchema` (strict). Scenarios are not files: they are built in the UI's create-run form and sent to `POST /runs`.

```json
{
  "name": "basic-room",
  "seed": "42",
  "agents": [
    { "id": "alice", "behavior": "mentioned" },
    { "id": "bob", "behavior": "mentioned" }
  ],
  "rooms": [{ "id": "main", "members": ["alice", "bob"] }],
  "scheduler": { "type": "highest_urgency" },
  "steps": 10
}
```

Seeds are alphanumeric (`0-9`, `A-Z`). The engine currently supports exactly one room per scenario.

## 9. Runs and persistence

A run is stored in SQLite (`DB_PATH`) through `RunStore`: a `runs` table (id, name, seed, status, created_at), a `scenarios` table (scenario JSON per run) and an append-only `events` table. Every event is persisted. Run status is `created` after creation, `running` after the first step and `completed` once the scenario's number of steps is reached; a completed run cannot be stepped, and only one step can execute at a time per run.

## 10. Reproducibility

Scenario configuration + seed produce the same trajectory. All randomness goes through a seeded PRNG (`SeededRandom`, mulberry32). `RunConfig` derives the stream for each step from the seed and the step number, so a run gives the same trajectory whether it executes continuously or is rebuilt from storage between steps. `runId` and event ids are execution-specific and excluded from behavioral comparison. Real LLM calls may introduce provider-side non-determinism; the deterministic engine stays testable on its own.

## 11. API

Fastify, with request/response schemas derived from `packages/types`. OpenAPI is exposed through Scalar at `/reference`.

```text
GET  /runs
POST /runs              create a run from a scenario
GET  /runs/:id
GET  /runs/:id/events
POST /runs/:id/steps/next   advance one step; 409 if completed or busy
GET  /healthz/{health,live,ready}
```

## 12. UI

Next.js App Router with shadcn components. Pages: run list, run creation form, and a run page. Open runs are kept as tabs in the site header.

The run page has three roles, constrained to the viewport height with independent scroll areas:

```text
┌──────────────────────────────────────────────────────────────────┐
│ name · status · seed · Step n / N          [ Next step ] [ Play ] │
├───────────┬──────────────────────────────────────┬───────────────┤
│ Event     │ room cards (filter)                  │ Inspector     │
│ viewer    │──────────────────────────────────────│ (event or     │
│ (raw log) │ chat timeline of the selected room   │  agent detail)│
└───────────┴──────────────────────────────────────┴───────────────┘
```

The left panel is the raw event log, the centre is a narrative reading of the run (messages, steps, silences, who was selected), and the right panel shows the detail of whatever is selected; it opens on selection and closes on demand. The page keeps the run and its events in client state, appends what each step returns, and can advance step by step or automatically until the run completes.

# Todo

Working plan for the feature currently in progress. Strategy and horizons live in [roadmap.md](roadmap.md); this file is the executable breakdown.

## How to use this file

- Work on **Current plan** top to bottom. Do not start items from **Backlog** unless asked.
- A task is done only when its **Verify** line passes. Tick the box in the same change.
- Tasks marked `(needs decision)` depend on an entry in **Decisions**. Confirm it with the user before implementing; if it was not answered, use the recommendation and say so.
- If the plan turns out wrong, edit it first, then continue. When the plan is finished, delete it, update `roadmap.md` status and the docs listed in the last phase.
- Always finish with `pnpm lint` and `pnpm check-types`.

---

## Current plan: execute runs step by step from the UI

Roadmap axis 1 (Run lifecycle). Streaming, play/pause and autoplay are out of scope here.

**Goal:** from a run page, a user clicks "Next step", sees the new events appear, and the run reaches `completed` when its configured number of steps is done.

### Where we are

Done: SQLite `RunStore`, `createRun` (persists run and `setup()` events), `POST /runs`, `GET /runs`, `GET /runs/:id`, `GET /runs/:id/events`, create-run form, runs list, run viewer (read-only).

Gaps this plan closes:

- Nothing calls `Simulation.step()` outside the engine; there is no endpoint to advance a run.
- `Simulation` lives only in memory during `createRun`. It cannot be resumed from the database.
- `action.selected` and `message.published` are never persisted, so a resumed run would lose every message.
- Run status never leaves `created`.
- `GET /runs/:id` answers 200 with an empty body for an unknown id; routes open a new `RunStore` per request and never close it.
- The run page receives events as server props, so it cannot grow.

### Decisions

- **D1. Where does simulation state live between requests?** Decided: rebuild the `Simulation` from the database on every step (stateless API, survives restarts, enables forking a run from a step later). This requires the seeded rng to be derivable from `(seed, step)` instead of consumed sequentially, so a resumed run matches a continuous one. Existing dev runs lose reproducibility; acceptable. Alternative: keep live simulations in an API-process map (simpler, lost on restart).
- **D2. Failure semantics of a step.** Decided: a step is atomic. Events are buffered and written in one transaction at the end; if any agent fails (for example an LLM error), nothing is written, the run keeps its status, and the user can retry. Alternative: persist events as they happen and accept half-written steps.
- **D3. Tests.** Decided: add Vitest to `packages/engine` for the stepping logic (key test: a run rebuilt between every step equals a continuous run). Otherwise verification is manual via curl and the UI.

### Phase A — Engine (`packages/engine`, `packages/db`)

- [x] **A1. Persist every event of a step atomically**
  Make `Simulation.step()` collect all of its events (`agent.prompt_built`, `action.proposed`, `action.selected`, `message.published`) and write them through one transactional `RunStore.appendEvents`. Remove the in-memory-only branch and its comment.
  Files: `engine/src/simulation.ts`, `db/src/runStore.ts`.
  Verify: after one step, `listEvents` contains `action.selected` and `message.published`; a step that throws leaves the event count unchanged.

- [x] **A2. Rebuild a simulation from the database**
  Add `loadSimulation(store, runId)` next to `buildRun`. `buildRun` must accept an existing `runId`. Restore room membership without re-emitting `agent.joined`, the `EventLog` from stored events, and the clock at the last stored step. Derive the step's rng from `(seed, step)` (for example `SeededRandom.forStep`).
  Files: `engine/src/scenario/factory.ts`, new `engine/src/scenario/loader.ts` (or similar), `engine/src/rng.ts`, `engine/src/runConfig.ts`.
  Verify: for a `weighted_random` scenario, stepping with a rebuild before each step gives the same events (ignoring ids) as stepping one live simulation.

- [x] **A3. `stepRun` use case**
  `stepRun(store, runId)` in `engine/src/scenario/runner.ts`: load the run, reject if `completed`, set `running` on the first step, execute one step, mark `completed` when the clock reaches `scenario.steps`, and return `{ run, events }` (only the new events, as `EventRecord[]`). The API must call this and contain no stepping logic.
  Verify: a scenario with `steps: 2` goes `created → running → completed`; a third call fails with a typed error the API can map to 409.

- [x] **A4. One step at a time per run**
  Reject a second concurrent `stepRun` for the same run (in-process lock keyed by `runId`, released in `finally`). LLM steps can take seconds, so double clicks are realistic.
  Verify: two simultaneous calls on one run: one succeeds, the other fails fast with the same typed "busy" error.

### Phase B — API (`apps/api`, `packages/types`)

- [ ] **B1. Share one `RunStore` and fix error handling**
  Create the store once (Fastify decorator or plugin, closed on shutdown) instead of per request. `createRun` still opens its own store from a `dbPath`; change it to take the shared store. Return 404 for an unknown run on `GET /runs/:id` and `GET /runs/:id/events`.
  Files: `api/src/routes/runs.ts`, `api/src/plugins/`, `api/src/paths.ts`.
  Verify: `curl` on a random uuid returns 404; no new `RunStore` per request in the code.

- [ ] **B2. `POST /runs/:id/steps/next`**
  Add `stepResultSchema` (`{ run: RunRecord, events: EventRecord[] }`) to `packages/types/src/run.ts` and use it for the response schema. 200 on success, 404 unknown run, 409 for completed or busy.
  Verify: calling it N times on a `steps: N` run returns the new events each time, the last response has `run.status === "completed"`, and the next call returns 409. The route shows up in `/reference`.

### Phase C — UI (`apps/ui`)

- [ ] **C1. API client**
  Add `stepRun(runId)` to `lib/api.ts` returning the parsed `stepResult`.

- [ ] **C2. Growing run viewer**
  Move the run page from server-only events to client state: `RunViewer` receives the initial `run` and `events`, keeps both in state, and appends the events returned by `stepRun`. Add a "Next step" button (hidden or disabled when `completed`, disabled while a request is in flight) and an error toast on failure. Keep the viewport-constrained layout.
  Files: `app/runs/[runId]/page.tsx`, `components/run/viewer.tsx`.
  Verify: in the browser, each click appends one step of events without a reload; reloading shows the same events.

- [ ] **C3. Status badge**
  Show the run status with the existing `Badge` in the run page header and in the runs list (`components/runs/run-item.tsx`). The header must update when a step completes the run.

- [ ] **C4. Remove debug logging in touched code**
  Delete the `console.log` calls in `components/run/viewer.tsx` and `components/run/events.tsx`.

### Phase D — Docs and wrap-up

- [ ] **D1. Update documentation**
  `docs/agent/api-ui.md` and `AGENT.md` (new route, client state in the viewer), `design.md` sections 7 and 9 (stepping, run status), `roadmap.md` axis 1 status. Engine docs, the Testing section of `AGENT.md` and the reproducibility notes were already updated in phase A.

### Done when

- Creating a run in the UI and clicking "Next step" until completion shows every step's events, then the button disappears and the status reads `completed`.
- Restarting the API between two steps does not break the run.
- Two quick clicks never produce a duplicated step.
- `pnpm lint` and `pnpm check-types` pass.

---

## Backlog

Unscheduled, not part of the current plan.

- Rewrite the event log viewer (`components/run/events.tsx`, `event-panel.tsx`): clearer step grouping, readable labels for every event type.
- Remove startup `console.log` calls in `apps/api/src/paths.ts` and `apps/api/src/plugins/cors.ts` in favor of the Fastify logger.
- Support more than one room per scenario (the engine currently throws unless there is exactly one).

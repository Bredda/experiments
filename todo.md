# Todo

Working plan for the feature in progress, and the backlog. Strategy and horizons live in [roadmap.md](roadmap.md); this file is the executable breakdown.

## How to use this file

- Work on **Current plan** top to bottom, one commit per phase. Do not start items from **Backlog** unless asked.
- A task is done only when its **Verify** line passes. Tick the box in the same change.
- Tasks marked `(needs decision)` depend on an entry in **Decisions**. Confirm it with the user before implementing; if it was not answered, use the recommendation and say so.
- Do not tick a task you could not verify; say what is missing instead.
- If the plan turns out wrong, edit it first, then continue. When the plan is finished, replace it with "None", update the status in `roadmap.md` and the affected docs.
- Always finish with `pnpm lint` and `pnpm check-types`.

---

## Current plan

**Goal:** roadmap axis 2, inspection and replay: move through a run step by step and see what each agent could observe at that point.

**Where we are:** the run page has the event viewer, room filter, chat timeline and a read-only agent panel. Missing: a time cursor, an observation view per agent, filters by agent and event type.

### Decisions (confirmed)

- The observation of an agent at step N is computed by the engine (`Simulation.observationsAt`, same helper as the real step) and served by the API; the ui never recomputes visibility.
- Scope: cursor, observation view and filters. The event log rewrite stays in the backlog.
- Cursor: `null` is live (latest step, follows Next/Play); moving back freezes the view without blocking execution; a "Live" button returns.
- Defaults used: slider added with the shadcn CLI; filters apply to the event viewer only.

### Phase 1 — Time cursor (ui)

- [x] `eventsUntil(events, step)` in `apps/ui/lib/run-view.ts` with tests. **Verify:** `pnpm --filter ui test`.
- [ ] Cursor state in `components/run/viewer.tsx`, controls (prev/next, slider, Live) in `control-bar.tsx`; chat, viewer, room strip and agent panel read the events up to the cursor. **Verify:** in the browser, with a run at step 3, cursor at 1 shows only step <= 1; Live follows Next step.

### Phase 2 — What each agent could observe (engine, api, ui)

- [ ] `Simulation.observationsAt(step)` sharing the observation helper with `#runStep`, `StepNotFoundError`, `getObservations` use case, engine tests. **Verify:** `pnpm --filter @experiments/engine test`.
- [ ] `GET /runs/:id/steps/:step/observations` and `getStepObservations` in `lib/api.ts`. **Verify:** curl returns one observation per agent, 404 out of range.
- [ ] "Observation at step N" section in the agent panel (`observationSummary` in `lib/run-view.ts` with tests). **Verify:** the panel changes when the cursor moves.

### Phase 3 — Filters (ui)

- [ ] `filterEvents` and `EVENT_TYPES` in `lib/run-view.ts` with tests; filter bar in `components/run/events.tsx`. **Verify:** tests, and in the browser filters compose with the cursor and leave the chat unchanged.

### Wrap-up

- [ ] Update `docs/agent/engine.md`, `docs/agent/api-ui.md`; roadmap axis 2 to Done; replace this plan by "None".

**Done when:** a user can drag the cursor over a run, see the chat, events and agent stats as of that step, read what an agent observed at that step (and its prompt for LLM agents), and filter the event viewer by agent and event type.

A plan in this file has: a goal, a short "where we are", **Decisions** (each with a recommendation, confirmed by the user before the tasks that depend on it), tasks grouped in phases (one commit per phase), each task with the files it touches and a **Verify** line, and a "Done when" block.

---

## Backlog

Unscheduled, not part of the current plan.

- Test the `llm` agent prompt without calling the model (`packages/ai` has no test runner); the two-system-message bug fixed in phase E would have been caught by one.
- Make the ui image configurable at runtime: a proxy route in the ui forwards browser calls to `API_URL`, so no api URL is baked at build time and CORS between ui and api disappears.
- Rewrite the event log viewer (`components/run/events.tsx`, `event-panel.tsx`): clearer step grouping, readable labels for every event type.
- Remove startup `console.log` calls in `apps/api/src/paths.ts` and `apps/api/src/plugins/cors.ts` in favor of the Fastify logger.
- `components/run/header.tsx` (`RunHeader`) is no longer used anywhere; delete it or reuse it.
- Support more than one room per scenario (the engine currently throws unless there is exactly one).

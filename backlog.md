# Backlog

Ideas, cleanups and open questions that are **not** part of an axis in [roadmap.md](roadmap.md) and not in the current plan in [todo.md](todo.md). Nothing here is committed to: do not implement an item unless asked. When one is decided, move it to the roadmap (strategic) or to a plan in `todo.md` (executable) and delete it here.

Each line says what, and why it came up. Items marked *(from todo)* were the previous backlog in `todo.md`.

## Cleanup and technical debt

- Remove the startup `console.log` calls in `apps/api/src/paths.ts` and `apps/api/src/plugins/cors.ts` in favor of the Fastify logger. *(from todo)*
- `components/run/header.tsx` (`RunHeader`) is not used anywhere; delete it or reuse it. *(from todo)*
- The ui keeps fetched observations in a module-level `Map` (`use-observations.ts`) that is never emptied. Harmless at this size; revisit if runs get long or tabs stay open for days.
- `getObservations` rebuilds the whole simulation to answer one request, and the agent panel asks once per step moved. Fine now; a batch or per-agent variant if the cursor feels slow on long runs.
- `GET /runs/:id/events` always returns the whole log and the run page loads all of it. `RunStore.listEvents(runId, sinceId)` already supports incremental reads but is not exposed; an `upToStep` or `sinceId` query would keep large runs light.

## Testing

- Test the `llm` agent prompt without calling the model (`packages/ai` has no test runner); the two-system-message bug fixed earlier would have been caught by one. *(from todo; also step 4 of roadmap axis 3)*
- A browser smoke test of the run page (Playwright): load a completed run, move the cursor, open an agent, filter events. Headless Chromium works here once the system libraries are installed; today the UI is verified by hand because `apps/ui` has no DOM or component tests.

## Run page

- Rewrite the event viewer (`events.tsx`, `event-panel.tsx`): step headers exist now, but labels are still ad hoc and `agent.prompt_built` has no dedicated view. *(from todo, narrowed)*
- Cursor conveniences: `←`/`→` and Home/End keys, keep the chat and the event viewer scrolled to the cursor step, an autoplay speed control (the 600 ms delay is fixed).
- Put the cursor step and the selection in the URL (`?step=7&agent=alice`) so a moment of a run can be linked.
- From an event in the inspector, a link to "what its agent observed at that step".
- Run list: delete, rename or archive runs (there is no delete route; names are generated), and short notes or tags on a run to keep track of what an experiment was for.

## Running and scenarios

- Edit the scenario of a fork: scheduler, seed and steps first (they do not touch the copied history), agent behavior and memory later. The fork form only asks for a name and a purpose today, so a fork re-samples but does not yet "change one parameter". The fork then stops being reproducible from its own scenario alone, which `docs/agent/engine.md` has to say.
- Delete a run: refused while it has forks (`RunStore.deleteRun`); decide whether to cascade, reparent or only archive before adding a delete route.
- Run to completion on the server. Autoplay is a client loop, so closing the tab stops the run; a server-side "run to step N" (background job, with progress) would allow long LLM runs and batch use. Related to the single-step-at-a-time guard in `stepRun`.
- Import and export a scenario as JSON in the create-run form, plus a few templates. Scenarios are only built in the UI today.
- A random-seed button and clearer seed validation in the form (seeds are `0-9A-Z` only).
- Spending guard rails for LLM runs: a confirmation showing agents × steps before launching, and an optional step or token cap. Complements roadmap 7.4.
- Failed LLM steps: show the error and the retry clearly in the run page, and decide whether to back off automatically.

## Infrastructure

- Make the ui image configurable at runtime: a proxy route in the ui forwards browser calls to `API_URL`, so no api URL is baked at build time and CORS between ui and api disappears. *(from todo)*

## Experiment ideas not yet in an axis

- Multi-seed batches and parameter sweeps: run N seeds of a scenario, or a range of one parameter, and aggregate. A single trajectory under `weighted_random` or an LLM is an anecdote; this is what makes 7.2 statistically meaningful.
- Counterfactual selection on recorded proposals: for a given step, show what another scheduler would have picked from the same `action.proposed` events, without calling any model. Only valid for that step (later steps diverge once the history differs), but cheap and useful for 6.
- A richer action vocabulary: a message addressed to a specific agent (the `mentioned` behavior infers mentions from text), leaving a room, reacting without speaking. Closed sets live in `packages/types`; each is a new action type and event.
- Wall-clock durations of steps and model calls as run metadata, kept outside the events so they cannot influence behavior (the engine invariant). Would feed response-latency style metrics.
- A library of reusable agent personas shared across scenarios (a persona is a free text in the scenario today).
- Memory as a config object instead of a kind name, so the size of the `last_n` window (fixed at 5 today) becomes a variable; and a summarizing memory (an extra model call per step, so it needs an event that records the summary).
- Mixed providers in the same room as an experimental variable (models already differ per agent among the Anthropic ones; `packages/ai` is the only place that knows a provider, `anthropicRunner.ts` the only file to change).

## On hold

- Streaming inside a step: waits until concurrent proposals prove too slow (roadmap axis 1).

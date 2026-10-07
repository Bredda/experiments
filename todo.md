# Todo

Working plan for the feature in progress. Strategy and horizons live in [roadmap.md](roadmap.md), unscheduled ideas in [backlog.md](backlog.md); this file is the executable breakdown.

## How to use this file

- Work on **Current plan** top to bottom, one commit per phase. Do not start items from [backlog.md](backlog.md) unless asked.
- A task is done only when its **Verify** line passes. Tick the box in the same change.
- Tasks marked `(needs decision)` depend on an entry in **Decisions**. Confirm it with the user before implementing; if it was not answered, use the recommendation and say so.
- Do not tick a task you could not verify; say what is missing instead.
- If the plan turns out wrong, edit it first, then continue. When the plan is finished, replace it with "None", update the status in `roadmap.md` and the affected docs.
- Always finish with `pnpm lint` and `pnpm check-types`.

---

## Current plan

### Goal

Axis 4, first slice: the experimenter alters what one chosen agent perceives at a chosen step, from the run page, and the effect is recorded in the event log and visible in the trajectory. Two interventions: a **system instruction for one step** (to an `llm` agent) and a **redaction of one message or proposal from one agent's view**. Insertion of memory and multimodal content come later and the design below must leave room for them.

### Where we are

Nothing exists for interventions. `Simulation.step()` builds each agent's view with `Room.view(agentId, history)`, which hands over the whole history, and `LLMAgent` turns the memory slice into one system message. Memory is stateless, so a redaction cannot mutate anything: it is an event that the view honors. A fork copies its parent's events up to a step and is then stepped like any run (`forkRun`, `createFork`). The run page is read-only except for stepping and forking; the agent panel already shows what the agent observed at the cursor step (`GET /runs/:id/steps/:step/observations`), which is the natural place to act.

### Decisions

Confirmed by the user:

- **D1. In the past, fork.** Interventions at a past step are applied by forking at that step (the composer forks automatically); there is no way to rewrite a played step.
- **D2. Redaction only for memory.** Editing memory means redacting an existing item. Inserting a memory that never existed comes later, as a new event type.
- **D3. Multimodal later**, but nothing in this plan may block it: an intervention carries its text as `content: string` today, and the intervention types are an explicit discriminated union, so a new type (or a parts-based content on a new type) is an addition, not a change to existing events.

Also confirmed by the user (D4 to D8):

- **D4. An intervention is recorded at step N, takes effect from step N+1.** It is a fact *between* steps: `step: N`, `timestamp` of step N, appended after step N's events. Why not `N+1`: a stored event at N+1 would make `restore` seek the clock to N+1 and `lastStep`, the fork bound and the cursor all think step N+1 was played. Consequence: `observationsAt(s)` (history with `event.step < s`) naturally includes what was in effect at `s`, and a fork at N copies the interventions of its parent up to N. The UI labels them "applies at step N+1". Alternative: `step: N+1` plus special cases in four places. *Recommended: N.*
- **D5. No server-side pending state.** Drafts live in the UI and travel with the action that applies them: `POST /runs/:id/steps/next` and `POST /runs/:id/fork` both take an optional `interventions` list. In `step`, they are committed in the same transaction as the step, so a failed step (LLM error) records neither and the drafts stay in the tray. No standalone `POST /interventions` route. *Recommended.*
- **D6. Redaction acts in `Room.view`**, so the agent no longer sees the item in its observation, whatever its behavior or memory kind (a redaction is a change of perception that memory inherits). Intervention events themselves are never part of an agent's `visibleEvents`; a system instruction reaches the agent through a new `Observation.instructions: string[]` (those recorded at step `observation.step - 1` for that agent), computed by the engine. *Recommended.*
- **D7. Validation lives in the engine** (`InvalidInterventionError`, mapped to 400): an instruction needs an `llm` agent; a redaction target must be a `message.published`, or a `action.proposed` of that same agent, that exists at or before step N and is not already redacted; interventions need a next step (so they are rejected on a completed run, and on a fork at the last step). Same rule as `persona`, rejected on the other behaviors.
- **D8. Drafts are bound to the step they were made at.** The tray holds them while the cursor stays there; moving the cursor to another step discards them (a redaction target may not exist at another step). *Recommended; the alternative (keeping several draft sets) is not worth it yet.*

Not in this slice:

- **D9. Scripted interventions in the scenario are out of this slice.** The events are the same, so a scenario field `interventions: [{ step, ... }]` can later feed `Simulation.step` without any change to events or UI. Do not build it now.

### Tasks

Phase 1: the shared contract (`refactor(types): …`)

- [x] `packages/types/src/interventions.ts` (new file, subpath export `./interventions` in `package.json`): the two bodies, each with an explicit literal `type`: `intervention.prompt_injected` (`agentId`, `content: string.trim().min(1).max(2000)`) and `intervention.memory_redacted` (`agentId`, `targetEventId: eventIdSchema`). Export `interventionSchema` (discriminated union on `type`) and `Intervention`. **Verify:** `pnpm --filter @experiments/types check-types`.
- [x] `events.ts`: `interventionPromptInjectedSchema` and `interventionMemoryRedactedSchema` = `eventSchema.extend(<body>.shape)`, added to `anyEventSchema`. `index.ts`: `observationSchema` gains `instructions: z.array(z.string()).default([])`. `run.ts`: `stepRequestSchema = { interventions?: Intervention[] }` and `forkRunRequestSchema` gains `interventions` (default `[]`). **Verify:** `pnpm check-types` stays green: the ui `eventLabel` and event panel already fall back to the event type and a generic JSON card, so no case is needed until phase 4.

Phase 2: the engine honors interventions (`refactor(engine): …`)

- [x] `packages/engine/src/interventions.ts`: `buildInterventionEvents({ history, agents, step, time, interventions })` validates (D7) and builds the events with `<schema>.parse({ id: newEventId(), timestamp, step, ... })`; `redactedEventIds(history, agentId)` and `instructionsAt(history, agentId, step)` are the two pure readers. `InvalidInterventionError` in `errors.ts`. **Verify:** unit tests of the three functions (each rejection of D7, a double redaction, an instruction at step N seen only at N+1).
- [x] `Room.view` drops the agent's redacted events and every `intervention.*` event; `Simulation.#observe` fills `instructions`. `Simulation.step(interventionEvents = [])` puts them in the history the agents observe and commits them with the step's events (same `#commit`, same atomicity). **Verify:** tests in `simulation.test.ts` that cover the contract: a redacted message is absent from that agent's observation and present in the other's; `observationsAt(N)` does not show a redaction recorded at N, `observationsAt(N+1)` does; the instruction is visible at N+1 only; time still advances and a silent step stays a step; a failing agent records no intervention and does not advance; same scenario + seed + interventions gives the same trajectory twice (compare normalized, without ids).
- [x] `stepRun(store, runId, { interventions })` builds the events from the loaded history and the run's scenario (agent behaviors), then steps; `forkRun(..., { interventions })` validates against the parent's events up to `step` and appends the events at `step` through `RunStore.createFork` (new optional `events` param, inserted after the copy in the same transaction). Both share the `stepping` guard (`RunBusyError`). **Verify:** `fork.test.ts`: a fork with a redaction has the parent's prefix plus the intervention event, the parent is untouched, and the first step of the fork reflects it; a fork with interventions at the last step throws.
- [x] `packages/ai`: `buildPrompt` takes `instructions` and appends them to the single system message in a delimited block (Anthropic accepts one system message), `LLMAgent.propose` passes `observation.instructions`. Without instructions the prompt is byte-for-byte what it was. **Verify:** `llmAgent.test.ts` with the fake runner: unchanged prompt without instructions; with one, the prompt contains it and `agent.prompt_built` carries it.

Phase 3: the API (`feat(api): intervene on a run when stepping or forking`)

- [x] `POST /runs/:id/steps/next` accepts an optional body `stepRequestSchema` (no Fastify `body` schema on this route, because Fastify rejects a request without a body when one is declared: Zod validates it in the handler and the shape is in the route description; the ui client already only sends a content type with a body); `POST /runs/:id/fork` passes `interventions` through; `InvalidInterventionError` is mapped to 400 in `error-handler.ts`; descriptions and the 400 response added for `/reference`. **Verify:** `pnpm --filter @experiments/api check-types`; with the api running, `curl` a step with a redaction, then `GET /runs/:id/steps/N+1/observations` shows it applied and `GET /runs/:id/events` contains the event at step N; a bad target returns 400.

Phase 4: ui plumbing (`refactor(ui): …`)

- [x] `lib/api.ts`: `stepRun(runId, interventions?)` and `forkRun` with interventions. `lib/run-view.ts` (pure, tested): `eventLabel` and timeline items for the two events ("applies at step N+1"), `agentSummary` counts the interventions it received, `observationSummary` also returns the instructions and, from the events, the redacted items (so the panel can show them struck through). The chat marker and the `eventLabel` of the log come with it, since the timeline now has an intervention item. **Verify:** `pnpm --filter ui test`, a case per function, including a redaction hidden at a step before it applies.
- [ ] `use-run-execution`: `nextStep` and `play` accept the drafts to send with the first step only, and clear them only once the step succeeded. `nextStep` and `play` take `{ interventions, onApplied }`; `onApplied` fires only once the step was recorded. **Verify:** `check-types`; manual: a failing step leaves the drafts in place (only checkable once phase 5 holds drafts: tick it there).

Phase 5: ui feature (`feat(ui): intervene on an agent from the run page`)

- [ ] `intervene` tab in the agent panel (next to the observation): a system instruction form (disabled with a reason for non-`llm` agents) and a "Redact from memory" action on each visible message and proposal of the observation. Both add a draft; the mode comes from the cursor, shown on the button: at the latest step of a run that is not completed, "Queue for step N+1"; otherwise "Fork at step N with …". **Verify:** in the browser on a live run and on a completed one.
- [ ] Drafts (`RunViewer` state, bound to the step, D8) and a tray in the control bar next to Next step and Play: count, list, remove one, and the button that applies them (Next step / Play send them, in the past the Fork sheet does). `ForkSheet` lists the drafts and sends them with the fork. **Verify:** queue two drafts, press Next step, both appear in the log at step N, the observation of N+1 shows their effect, the prompt of an `llm` agent contains the instruction.
- [ ] Trace of the effect: chat markers for the two events, `event-panel` renderers (generic JSON fallback replaced), a "Redacted from this agent" list in the observation section, and the interventions on the fork sheet graph lane. **Verify:** after a fork with a redaction, the event, the marker and the observation all point at the same intervention, and the parent run shows none of it.

Phase 6: docs (`docs: …`)

- [ ] `docs/agent/engine.md` (event table, D4 semantics, `Room.view` and `Observation.instructions`, `stepRun` and `forkRun` options), `docs/agent/api-ui.md` (routes, drafts and tray, intervene tab), `roadmap.md` axis 4 (status, what is left: insertion, multimodal, scripted interventions in the scenario) and the `add-event-type` skill if its checklist missed something. **Verify:** `pnpm lint`, `pnpm check-types`, `pnpm test`.

### Done when

On the run page, an experimenter can pick an agent at a step, redact an item from its view or give it a one-step instruction, apply it live or in a fork, and then see in the log, the chat and the agent's observation exactly what changed and where it comes from; the same scenario, seed and interventions replay identically, and the parent run is unchanged.

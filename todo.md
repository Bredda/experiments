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

## Current plan: redesign the run page, then autoplay

Roadmap axis 1 (run lifecycle), with groundwork for axes 2 and 4. The run page gets a structure that can host replay and interventions later; only what works today is built.

**Goal:** the run page has three roles: the left panel stays the raw event log, the centre becomes a narrative view of the run (room selector above a chat-style timeline), and a contextual panel on the right shows the detail of whatever is selected. The control bar gains play/pause.

Target layout:

```text
┌──────────────────────────────────────────────────────────────────┐
│ name · status · seed · Step n / N                  [ ▶ ] [ Next ] │  control bar
├───────────┬──────────────────────────────────────┬───────────────┤
│ Event     │ [All] [room] [room] …                │ Inspector  [x]│
│ viewer    │──────────────────────────────────────│ (event or     │
│ (raw log) │ chat timeline of the selected room:  │  agent detail,│
│           │ messages + markers (steps, silences, │  opens on     │
│           │ selections)                          │  selection)   │
└───────────┴──────────────────────────────────────┴───────────────┘
```

### Where we are

The run page is a three-column grid: event timeline (420 px), a "This will be main" placeholder, and an event inspector that is always open. `RunViewer` keeps `run` and `events` in client state and has a "Next step" button. Events carry a `roomId` only for `agent.joined`, `message.published` and `speak` actions. The engine supports one room per scenario, so everything is built for N rooms and rendered with one. The `message`, `marker` and `message-scroller` components exist in the `@shadcn` registry (style `base-mira`); none of them is installed yet.

### Decisions

- **D1. One selection state.** `RunViewer` holds `selection: { type: "event" | "agent"; id: string } | null`. Clicking a chat message selects its event, highlights it in the event viewer and opens the right panel; closing the panel clears it. Both panels read the same state.
- **D2. Single room.** Hide the "All" card while the run has exactly one room; show it from two rooms on.
- **D3. Left panel.** Narrower (about 320 px) and collapsible, to leave room for the chat.
- **D4. Room of an event without `roomId`.** Derive it from the agent: build an agent→room map from `agent.joined` events and use it for `stay_silent` proposals and `agent.prompt_built`. No schema change now; revisit with axis 5.
- **D5. Tests for view logic.** Add Vitest to `apps/ui`, node environment, only for pure functions in `lib/` (timeline building, room summaries). No component or DOM tests.
- **D6. Autoplay is a client loop.** It calls `steps/next` repeatedly with a short fixed delay; no new endpoint. Pause lets the step in flight finish. Streaming inside a step is not planned until autoplay has been tried on an LLM scenario.

### Phase A — Layout shell and selection

- [x] **A1. Selection state and contextual inspector**
  Add the `selection` state (D1). New `components/run/inspector.tsx`: a right panel with a header and a close button that renders `EventPanel` for an event selection and nothing when there is no selection. The grid has two columns when it is closed and three when open.
  Files: `components/run/viewer.tsx`, `components/run/inspector.tsx`, `components/run/event-panel.tsx`.
  Verify: selecting an event opens the panel, the close button closes it, and the centre widens accordingly.
  Status: checked by the user. Also added a generic JSON renderer in `EventPanel` so events without a dedicated view (`message.published`, `action.selected`, `agent.prompt_built`) are no longer blank in the inspector.

- [x] **A2. Left panel width and collapse** (D3)
  Narrow the event viewer and add a toggle to collapse it. Keep the viewport-constrained layout and independent scroll areas.
  Verify: collapsing gives its space to the centre; reload keeps the page working.
  Status: checked by the user (320 px, toggle in the control bar). The dummy "Toolbar / button A / button B" block in the event viewer was replaced by a small "Events" header with the event count.

- [x] **A3. Control bar and centre skeleton**
  Keep the current toolbar as the control bar. The centre becomes a column with a slot for the room strip and a slot for the timeline, both empty for now. Remove the "This will be main" text.
  Verify: the page renders with the three regions at 1280 px and 1500 px wide.
  Status: implemented as `ControlBar` (`components/run/control-bar.tsx`) plus dashed "Rooms" and "Timeline" placeholders in the centre, which phases B and C replace. Checked by the user; the control bar uses the card background to stand apart from the site header.

### Phase B — Rooms

- [x] **B1. Run view helpers** `(needs decision D5)`
  Set up Vitest in `apps/ui` (`test` script, node environment). New `lib/run-view.ts` with pure functions: `agentRooms(events)`, `eventRoomId(event, agentRooms)` (D4) and `roomSummaries(run, events)` returning, per room, its members, message count, last speaker and number of silent steps.
  Verify: unit tests cover a scenario with silent steps and `stay_silent` proposals attributed to the right room.
  Status: done (`lib/run-view.ts`, 5 tests). `apps/ui` had `@types/node` `^20`, which does not satisfy Vitest's peer range and left the install broken, so it now uses `26.5.0` like the other packages.

- [x] **B2. Room strip and filter**
  New `components/run/room-strip.tsx`: one simple card per room (`Card`/`Item`) showing the summary data, acting as a select; an "All rooms" card (D2). State `roomFilter` in `RunViewer`, default "all".
  Verify: with a single-room run only one card shows; selecting it highlights it.
  Status: implemented (`components/run/room-strip.tsx`, filter state in `RunViewer`; with one room the filter starts on that room). The filter has no visible effect until phase C. Checked by the user.

### Phase C — Chat timeline

- [x] **C1. Add the shadcn components**
  Install `message`, `marker` and `message-scroller` with the shadcn CLI (this adds `@shadcn/react`).
  Verify: `pnpm check-types` passes and the files sit in `components/ui/`.
  Status: done. Also added `bubble` (the registry's message examples wrap message text in it) and `@shadcn/react` as a dependency.

- [x] **C2. Timeline builder**
  `buildTimeline(events, roomFilter)` in `lib/run-view.ts` returns a list of items: step marker, agent-joined marker, silence marker (a step where nobody spoke), message, and selection marker (who was picked, with the competing urgencies). Every item keeps the id of the event it comes from.
  Verify: unit tests for a step with a message, a silent step, and a step with several proposals.
  Status: done (`buildTimeline` in `lib/run-view.ts`, 5 tests). A selection marker only appears when several agents wanted to speak in the room; a silence marker appears when nobody spoke in the filtered view.

- [ ] **C3. Chat component**
  New `components/run/chat.tsx` using `Message`, `Marker` and `MessageScroller`: follows the newest item, with a way back to the latest when scrolled up. Clicking an item sets the selection (D1) and the matching event is highlighted in the event viewer.
  Verify: clicking "Next step" appends items and the view follows; clicking a message opens its event in the inspector.
  Status: implemented (`components/run/chat.tsx`: messages in bubbles, markers for steps, arrivals, silences and selections, clickable ones open the inspector; room filter applied; `MessageScroller` follows the newest entry and shows a scroll-to-end button). Server-rendered output checked; awaiting a manual check.

### Phase D — Agent panel

- [ ] **D1. Agent selection and panel**
  Clicking an agent (avatar or name in the chat, or a member in a room card) sets an agent selection. The inspector shows its id, behavior and memory (from `run.scenario.agents`), message count and latest proposals. Read-only.
  Verify: selecting an agent shows its data; switching between an event and an agent replaces the content.

### Phase E — Transport

- [ ] **E1. Play and pause** (D6)
  Add play/pause to the control bar. Playing loops `stepRun` with a short delay until the run completes, a step fails, or the user pauses; pausing waits for the step in flight. "Next step" is disabled while playing.
  Verify: play runs a scenario to completion without clicks; pause stops it between steps; an error stops playback and shows a toast.

- [ ] **E2. Try it on an LLM scenario**
  Run a run with `llm` agents through autoplay and note whether per-step latency calls for streaming inside a step. Record the outcome in `roadmap.md` axis 1.
  Verify: the outcome is written down; no code expected.

### Phase F — Docs and wrap-up

- [ ] **F1. Update documentation**
  `docs/agent/api-ui.md` (new structure and selection model), `design.md` section 12, `roadmap.md` status for axes 1 and 2, and drop the backlog items this plan absorbed.

### Done when

- The run page matches the target layout: raw event viewer on the left, room strip and chat in the centre, contextual inspector on the right.
- A message, an event and an agent can each be selected and shown in the inspector.
- Play runs a scenario to the end and pause stops it between steps.
- `pnpm lint`, `pnpm check-types` and `pnpm test` pass.

---

## Backlog

Unscheduled, not part of the current plan.

- Rewrite the event log viewer (`components/run/events.tsx`, `event-panel.tsx`): clearer step grouping, readable labels for every event type.
- Remove startup `console.log` calls in `apps/api/src/paths.ts` and `apps/api/src/plugins/cors.ts` in favor of the Fastify logger.
- `components/run/header.tsx` (`RunHeader`) is no longer used anywhere; delete it or reuse it.
- Support more than one room per scenario (the engine currently throws unless there is exactly one).

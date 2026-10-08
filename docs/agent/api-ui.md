# API and UI reference

## API (`apps/api`)

Fastify 5, ESM, run with `tsx watch src/index.ts`. Config comes from `env` (`API_HOST`, `API_PORT`, `DB_PATH`, `API_REF_PATH`). There is no CORS: the browser reaches the api through the ui's `/api` proxy (see "UI"). Startup information goes through the Fastify logger (`app.log`), not `console.log`.

Structure:

```text
src/index.ts          bootstrap (logger, error handler, plugins, routes)
src/plugins/          sensible, OpenAPI + Scalar reference, store (shared RunStore)
src/routes/           one Fastify plugin per resource, registered with a prefix
src/paths.ts          resolves DB_PATH against the monorepo root
```

Routes: `GET/POST /runs`, `GET /runs/:id`, `PATCH /runs/:id` (body `{ name?, notes?, archived? }`, at least one; renames the run and its scenario, sets its notes, archives or unarchives it; 400 if the body is empty), `DELETE /runs/:id` (204; 409 while the run executes a step and while other runs were forked from it, 404 if it does not exist), `GET /runs/:id/events`, `GET /runs/:id/steps/:step/observations` (what each agent observed when it proposed at that step; 404 if the step was not played), `POST /runs/:id/fork` (body `{ step, name, purpose?, interventions? }`; creates a run from a copy of this one up to `step`, with the interventions recorded in it and taking effect at `step + 1`; 201 with the new run, 400 if an intervention cannot be applied, 404 if the run or the step does not exist), `GET /runs/:id/tree` (the fork tree that contains the run), `POST /runs/:id/steps/next` (advances one step, returns `{ run, events }` with only the new events; the optional body `{ interventions }` is validated with Zod in the handler, not declared as a Fastify `body` schema, because Fastify rejects a request without a body when one is declared; 400 if an intervention cannot be applied), and probes under `/healthz`.

Conventions:

- Request and response schemas come from `@experiments/types`: `schema.toJSONSchema()` for Fastify/OpenAPI (`{ target: "draft-7" }` for bodies), `schema.parse` for validation inside handlers. Do not hand-write a parallel JSON schema.
- `src/index.ts` imports `@experiments/ai` for its side effect (registers the `llm` behavior). Keep that import.
- Handlers use `app.store`, the single `RunStore` decorated by the store plugin (never open a store per request), and call engine use cases (`createRun`, `stepRun`); they contain no simulation logic.
- Engine errors are mapped to HTTP in `src/error-handler.ts` (`ZodError` thrown by a handler and `InvalidInterventionError` 400, `RunNotFoundError` and `StepNotFoundError` 404, `RunCompletedError`, `RunBusyError` and `RunHasForksError` 409). Throw them or `app.httpErrors.*`; do not build error replies by hand. Declare `params` with the id schema so malformed ids get a 400.
- Add each new route group in `src/routes/index.ts` and give it `description` and `tags` so it shows up in `/reference`.

## UI (`apps/ui`)

Next.js 16 App Router. This version differs from older Next.js: before writing Next-specific code, read the relevant guide in `apps/ui/node_modules/next/dist/docs/` (see `apps/ui/AGENTS.md`, which `next dev` maintains; leave it alone).

Structure:

```text
app/                  routes: /, /runs, /runs/[runId], /create-run
components/ui/        shadcn primitives (style base-mira, icons: hugeicons)
components/run/       run page, see "Run page" below
components/runs/      run list, the actions menu of a run (rename and notes, archive, delete) and the shared status badge
components/fork/      fork form (name, optional purpose, prepared interventions), rendered in the fork sheet
components/create-run/ scenario form (TanStack Form + Zod)
lib/api.ts            typed API client; lib/fetch.ts is the fetch wrapper
lib/run-view.ts       pure view logic for the run page (tested)
lib/fork-tree.ts      pure layout of the fork tree and the default fork name (tested)
lib/run-tabs.ts       open run tabs, stored in sessionStorage
lib/run-list.ts       pure helpers of the run list: fork counts, search (tested)
lib/hints.ts          which hints the user already opened, stored in localStorage (pure parsing tested)
lib/proxy.ts          pure upstream URL of the `/api` proxy (tested)
app/api/[...path]/    the proxy route handler, see the next section
```

Conventions:

- Use the `@/` alias for app-internal imports.
- Fetch data in server components through `lib/api.ts`. The browser never calls the api itself: `apiFetch` sends its requests to the ui's own `/api/*`, and `app/api/[...path]/route.ts` (a Route Handler, not `rewrites()`, which are resolved at build time) forwards them to `API_URL`, read on every request (default `http://localhost:8080`, `http://api:8080` in Docker). Server-side rendering calls `API_URL` directly. So no api address is built into the image and there is no CORS. The handler forwards `GET`, `POST`, `PATCH` and `DELETE` with only the `content-type`, `accept` and `x-request-id` headers, rejects `.`/`..` segments (`upstreamUrl`), answers 502 `{ error }` when the api is unreachable, and inherits `fetch`'s 5 minute limit on the wait for the api's response headers, which bounds a very slow step. See `apiUrl()` in `lib/fetch.ts`.
- Runs are launched from the create-run form, which builds a `ScenarioConfig` and `POST`s it to `/runs`, or forked from the run page (see "Forks" below), and advance from the run page.
- `apiFetch` only sends a JSON content type when there is a body (Fastify rejects an empty JSON body) and throws `ApiError` with the API's `error` message and the HTTP status.
- The agent dialog of the form asks for a name, a behavior and a memory kind; for an `llm` agent it also shows a model (`AGENT_MODELS`) and an optional persona. `toScenarioConfig` only sends them for `llm` agents (the API rejects them elsewhere) and omits a blank persona, so the default prompt applies.
- Types and Zod schemas come from `@experiments/types`. Reuse its enums (`AGENT_BEHAVIORS`, `MEMORY_KINDS`, `AGENT_MODELS`, `schedulerTypeSchema`) instead of repeating literals. The create-run form keeps label maps keyed by those types, so a new member fails type-checking until labelled.
- Add shadcn primitives with the shadcn CLI (config in `components.json`) rather than writing them by hand.
- Logic that turns events into something to display (room attribution, summaries, the chat timeline, agent summaries) lives in `lib/run-view.ts` as pure functions with Vitest tests next to it (`pnpm --filter ui test`). Components only render; do not put that logic in them. There are no DOM or component tests.
- shadcn components added so far beyond the basics: `message`, `marker`, `bubble`, `message-scroller` (these depend on `@shadcn/react`).

### Run page

`app/runs/[runId]/page.tsx` loads the run and its events on the server and renders `RunViewer`, keyed by run id so switching run tabs does not reuse state. The page is constrained to the viewport height and each panel scrolls on its own; keep that layout when editing it.

```text
control bar  (control-bar.tsx)   name, run state (run-state.tsx: status badge, plus "Back to live" while the cursor is on a past step; live has no marker of its own), step n / N, event viewer toggle, time cursor (prev, slider, next), the tray of pending interventions (drafts-tray.tsx, only when there are drafts), Next step, Play / Pause, Fork, then the "?" legend (legend.tsx) and the inspector toggle
event viewer (events.tsx)        raw log, collapsible; the source of truth; filter menu by agent and event type
centre       room-strip.tsx      one card per room, filters the chat ("All rooms" card only with several rooms)
             chat.tsx            chat-style timeline of the selected room
inspector    (inspector.tsx)     always available (toggle in the control bar, close button): the detail of the selection, or, with none, how to select and the list of agents
             event-panel.tsx     detail of an event (generic JSON fallback for events without a dedicated view)
             agent-panel.tsx     detail of an agent (behavior, memory, model, persona) with what it observed at the cursor step, and an Intervene tab (intervene-panel.tsx)
```

- **State.** `useRunExecution` (`use-run-execution.ts`) holds `run` and `events` on the client and exposes `nextStep`, `play` and `pause`; the first two take `{ interventions, onApplied }` (see "Interventions"). Autoplay is a loop over the same `steps/next` call with a short fixed delay; pause lets the step in flight finish, and leaving the page stops the loop. `RunViewer` adds `selection` (`{ type: "event" | "agent"; id }`, see `selection.ts`), the room filter, the open state of the two side panels and of the fork sheet.
- **Time cursor.** `RunViewer` holds `cursor` (`null` = live). The step shown is the cursor or the latest step; `eventsUntil` cuts the log at that step and every panel (viewer, chat, room strip, inspector) reads the cut events, never the full log. Moving the cursor does not touch execution (Next/Play stay available); reaching the latest step goes back to live. A selected event later than the cursor is dropped from the view.
- **Observation view.** The agent panel fetches `GET /runs/:id/steps/:step/observations` for the cursor step (`useStepObservations`, cached per run and step since a played step never changes) and formats it with `observationSummary`. The ui never recomputes what an agent could see; that is the engine's `Room.view`.
- **Model call.** The "Prompt used" block of a proposal shows the model and the token usage recorded on its `agent.prompt_built` event (`modelCallLabel`), when the agent reported them.
- **Filters.** `filterEvents` (agents and event types, AND; empty = any) applies to the event viewer only, after the cursor. `agent.prompt_built` stays hidden in the viewer unless its type is selected.
- **One selection, many views.** Clicking an event in the viewer, a message or marker in the chat, or a proposal in the agent panel sets `selection`; the inspector, the viewer highlight and the chat highlight all read it. Agents are selected from a chat avatar or name, or from the "Agent" link in the inspector.
- **Room of an event.** Events without a `roomId` (silent proposals, prompts) take the room their agent joined, derived from `agent.joined` events (`eventRoomId`).
- **Chat items.** `buildTimeline` returns arrivals, a marker per step, messages, a selection marker when several agents wanted to speak, a silence marker when nobody spoke, and an intervention marker (after the step it follows, saying which step it applies at). Each item keeps the id of the event it comes from.
- **Room cards.** A card selects the room (it filters the chat) and lists its members as avatars, which open the agent in the inspector: this is the way to an agent that never spoke. With a single room the card is a summary, not a button, since selecting it would change nothing.
- **Inspector.** It is open from the start and stays open without a selection, where it says what can be selected and lists the agents (`agentsOverview`, pure), each one clickable. Selecting anything opens it; the close button, like the toggle in the control bar, hides it and clears the selection. A selected event later than the cursor is dropped, and the inspector falls back to its empty state.
- **Affordances.** Every clickable element has a hover or focus state and a tooltip saying what a click does (`Hint`, `components/run/hint.tsx`, over the `Tooltip` primitive; it opens on keyboard focus too). Pointer cursors on buttons come from `globals.css`. A new clickable element on this page should get a `Hint`.
- **Legend.** The "?" button in the control bar opens a short legend (`legend.tsx`). It carries a "new" dot until it was opened once, remembered in `localStorage` (`lib/hints.ts`, always in try/catch: with the storage blocked the dot simply comes back; during SSR a hint counts as seen so the dot never flashes). Keep the legend in step with the page when a control is added.
- **Actions in the chat.** On hover or keyboard focus (always visible without a pointer), a step separator offers "Go to step N" (moves the cursor) and "Fork here" (moves the cursor and opens the fork sheet, which `RunViewer` controls); a message offers "Inspect <agent>" and "Redact from…", a menu of the members of its room (`messageRedactionTargets`, pure) that adds a `intervention.memory_redacted` draft, like the Intervene tab does, with the same queue-or-fork consequence. They add no new path to the engine: they use the cursor, the fork sheet and the drafts. Moving the cursor discards the drafts, as always.

### Interventions

- **Intervene tab.** In the agent panel, next to Details: a system instruction for the agent (a textarea, disabled with a reason for non-`llm` agents) and a "Redact from memory" list, built by `redactionCandidates` (pure) from the events up to the step the view shows: the messages of the room and the agent's own proposals, newest first, with what an earlier intervention already removed struck through. It mirrors the engine's rule; the engine stays the one that rejects.
- **Drafts.** `useDrafts(step)` holds the interventions prepared and not yet sent. They are bound to the step the view shows: moving to another step discards them (a redaction target may not exist there). `interventionTarget` (pure) says where they go: on the live step of a run that is not completed, **queue** (recorded with the next step: the button reads "Queue for step N+1"); on a past step, or on the last step of a completed run, **fork** ("Add to a fork at step N"), and `available` is false when the scenario has no step after the shown one.
- **Sending.** The tray in the control bar (`drafts-tray.tsx`, "N pending", each draft removable) sits before Next step and Play. In queue mode both send the drafts with the step, once, and clear them only when the step was recorded (a failed step leaves them in place). The Fork button always carries them: the fork sheet and form list them and `forkRun` sends them with the fork, which records them and takes effect at its step + 1. Next step and Play never send drafts made on a past step.
- **Reading them.** The log labels them ("Redacted - bob - applies at step 3"), the chat shows a marker, the event panel has a dedicated card (the redacted event can be opened from it), and the agent's observation lists the instructions it was given and what was removed from its view (read from the log, since the observation no longer holds it).

### Forks

- **Fork sheet.** The control bar's single "Fork" button, always its last control, opens `ForkSheet` (`components/run/fork-sheet.tsx`), a full-screen sheet that fetches `GET /runs/:id/tree` each time it opens. It has two parts: the fork tree and, beside it (below on narrow screens), a "Fork at step N" form where N is the step the cursor shows. `layoutForkTree` (pure, in `lib/fork-tree.ts`) orders the runs depth first and `ForkGraph` draws them: one lane per run over the steps (solid up to the played step, dashed up to the planned one), a connector leaving the parent's lane at the fork step, name, purpose and status on the left, the current run highlighted, a click on a row opens that run. Do not recompute lineage in the ui: it comes from the API.
- **Fork form.** `ForkForm` asks for a name, prefilled by `suggestForkName` (`<origin name> - fork #n`, computed from the tree the sheet loaded), and an optional purpose. The fork keeps the scenario and seed of its parent. The interventions prepared in the run page are listed above the name and sent with the fork. On success it navigates to the new run, which closes the sheet. `POST /runs/:id/fork` is the route behind it. The sheet opens from the Fork button or from "Fork here" on a step of the chat.

### Run list

`app/runs/page.tsx` lists every run (`RunList`, client-side search, status filter and sort). Archived runs are hidden unless "Show archived" is on (it only appears when there are some); the search also matches the notes. Each run has an actions menu (`RunActions`), next to its link rather than inside it: rename and notes (`PATCH /runs/:id`), archive or unarchive, delete. Delete is disabled, with the reason, while the run has forks (`forkCounts`, pure, counts them from the list; the api still refuses with a 409), since a fork copies its parent's history: archive such a run, or delete its forks first. Deleting closes the run's tab and renaming updates it (`lib/run-tabs.ts`). Mutations call `router.refresh()`.

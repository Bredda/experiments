# API and UI reference

## API (`apps/api`)

Fastify 5, ESM, run with `tsx watch src/index.ts`. Config comes from `env` (`API_HOST`, `API_PORT`, `API_TRUSTED_ORIGIN`, `DB_PATH`, `API_REF_PATH`).

Structure:

```text
src/index.ts          bootstrap (logger, error handler, plugins, routes)
src/plugins/          cors, sensible, OpenAPI + Scalar reference, store (shared RunStore)
src/routes/           one Fastify plugin per resource, registered with a prefix
src/paths.ts          resolves DB_PATH against the monorepo root
```

Routes: `GET/POST /runs`, `GET /runs/:id`, `GET /runs/:id/events`, `GET /runs/:id/steps/:step/observations` (what each agent observed when it proposed at that step; 404 if the step was not played), `POST /runs/:id/fork` (body `{ step, name, purpose? }`; creates a run from a copy of this one up to `step`, 201 with the new run, 404 if the run or the step does not exist), `GET /runs/:id/tree` (the fork tree that contains the run), `POST /runs/:id/steps/next` (advances one step, returns `{ run, events }` with only the new events), and probes under `/healthz`.

Conventions:

- Request and response schemas come from `@experiments/types`: `schema.toJSONSchema()` for Fastify/OpenAPI (`{ target: "draft-7" }` for bodies), `schema.parse` for validation inside handlers. Do not hand-write a parallel JSON schema.
- `src/index.ts` imports `@experiments/ai` for its side effect (registers the `llm` behavior). Keep that import.
- Handlers use `app.store`, the single `RunStore` decorated by the store plugin (never open a store per request), and call engine use cases (`createRun`, `stepRun`); they contain no simulation logic.
- Engine errors are mapped to HTTP in `src/error-handler.ts` (`ZodError` thrown by a handler 400, `RunNotFoundError` and `StepNotFoundError` 404, `RunCompletedError` and `RunBusyError` 409). Throw them or `app.httpErrors.*`; do not build error replies by hand. Declare `params` with the id schema so malformed ids get a 400.
- Add each new route group in `src/routes/index.ts` and give it `description` and `tags` so it shows up in `/reference`.

## UI (`apps/ui`)

Next.js 16 App Router. This version differs from older Next.js: before writing Next-specific code, read the relevant guide in `apps/ui/node_modules/next/dist/docs/` (see `apps/ui/AGENTS.md`, which `next dev` maintains; leave it alone).

Structure:

```text
app/                  routes: /, /runs, /runs/[runId], /runs/[runId]/fork, /create-run
components/ui/        shadcn primitives (style base-mira, icons: hugeicons)
components/run/       run page, see "Run page" below
components/runs/      run list and the shared status badge
components/fork/      fork form (name, optional purpose)
components/create-run/ scenario form (TanStack Form + Zod)
lib/api.ts            typed API client; lib/fetch.ts is the fetch wrapper
lib/run-view.ts       pure view logic for the run page (tested)
lib/fork-tree.ts      pure layout of the fork tree and the default fork name (tested)
lib/run-tabs.ts       open run tabs, stored in sessionStorage
```

Conventions:

- Use the `@/` alias for app-internal imports.
- Fetch data in server components through `lib/api.ts`. The api address is `NEXT_PUBLIC_API_URL` (default `http://localhost:8080`), inlined at build time and used by the browser; server-side rendering uses `API_URL` when set (read at runtime, for instance `http://api:8080` inside Docker). See `apiUrl()` in `lib/fetch.ts`.
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
control bar  (control-bar.tsx)   name, status, step n / N, panel toggle, time cursor (prev, slider, next, Live), Next step, Play / Pause
event viewer (events.tsx)        raw log, collapsible; the source of truth; filter menu by agent and event type
centre       room-strip.tsx      one card per room, filters the chat ("All rooms" card only with several rooms)
             chat.tsx            chat-style timeline of the selected room
inspector    (inspector.tsx)     contextual, opens on selection, close button
             event-panel.tsx     detail of an event (generic JSON fallback for events without a dedicated view)
             agent-panel.tsx     read-only detail of an agent (behavior, memory, model, persona), with what it observed at the cursor step
```

- **State.** `useRunExecution` (`use-run-execution.ts`) holds `run` and `events` on the client and exposes `nextStep`, `play` and `pause`. Autoplay is a loop over the same `steps/next` call with a short fixed delay; pause lets the step in flight finish, and leaving the page stops the loop. `RunViewer` adds `selection` (`{ type: "event" | "agent"; id }`, see `selection.ts`), the room filter and the left panel toggle.
- **Time cursor.** `RunViewer` holds `cursor` (`null` = live). The step shown is the cursor or the latest step; `eventsUntil` cuts the log at that step and every panel (viewer, chat, room strip, inspector) reads the cut events, never the full log. Moving the cursor does not touch execution (Next/Play stay available); reaching the latest step goes back to live. A selected event later than the cursor is dropped from the view.
- **Observation view.** The agent panel fetches `GET /runs/:id/steps/:step/observations` for the cursor step (`useStepObservations`, cached per run and step since a played step never changes) and formats it with `observationSummary`. The ui never recomputes what an agent could see; that is the engine's `Room.view`.
- **Model call.** The "Prompt used" block of a proposal shows the model and the token usage recorded on its `agent.prompt_built` event (`modelCallLabel`), when the agent reported them.
- **Filters.** `filterEvents` (agents and event types, AND; empty = any) applies to the event viewer only, after the cursor. `agent.prompt_built` stays hidden in the viewer unless its type is selected.
- **One selection, many views.** Clicking an event in the viewer, a message or marker in the chat, or a proposal in the agent panel sets `selection`; the inspector, the viewer highlight and the chat highlight all read it. Agents are selected from a chat avatar or name, or from the "Agent" link in the inspector.
- **Room of an event.** Events without a `roomId` (silent proposals, prompts) take the room their agent joined, derived from `agent.joined` events (`eventRoomId`).
- **Chat items.** `buildTimeline` returns arrivals, a marker per step, messages, a selection marker when several agents wanted to speak, and a silence marker when nobody spoke. Each item keeps the id of the event it comes from.

### Forks

- **Fork page.** The control bar's "Fork at step N" button (N is the step the cursor shows) opens `/runs/[runId]/fork?step=N`. The server component loads the tree, rejects a step outside 0..played steps with a 404, and renders `ForkForm`: a name prefilled by `suggestForkName` (`<origin name> - fork #n`) and an optional purpose. The form only asks for these two: the fork keeps the scenario and seed of its parent. On success it navigates to the new run.
- **Fork tree sheet.** The "Forks" button opens `ForkTreeSheet`, a full-screen sheet that fetches `GET /runs/:id/tree` each time it opens. `layoutForkTree` (pure, in `lib/fork-tree.ts`) orders the runs depth first and `ForkGraph` draws them: one lane per run over the steps (solid up to the played step, dashed up to the planned one), a connector leaving the parent's lane at the fork step, name, purpose and status on the left, the current run highlighted, a click on a row opens that run. Do not recompute lineage in the ui: it comes from the API.

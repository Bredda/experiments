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

A batch of fixes and small features taken from [backlog.md](backlog.md) before roadmap 7.2: startup logs, a run page a first-time user can read, run management, and a ui image whose api address is set at runtime. It is **not** a roadmap item. Typed honestly, the `feat` commits make release-please propose 1.3.0 rather than 1.2.1; do not force the version.

Work on branch `feat/run-page-polish`, one commit per phase (phase 3 and 4 have one per lettered step).

### Decisions

- **Deleting a run that has forks** is refused with a 409 that says what to do (delete its forks first, or archive it). No cascade (destructive) and no reparenting (a fork copies its parent's history, so its lineage would be wrong). Archiving is the way out.
- **Run metadata**: a note and an `archived` flag, no tags. They live in a side table `run_meta` created with `CREATE TABLE IF NOT EXISTS`, like `forks`, because there is no migration mechanism: an existing database gets the table when opened.
- **Renaming** updates `runs.name` and the name inside the stored scenario, as a fork already does.
- **CORS goes away** with the proxy: the browser only calls `/api/*` on the ui origin. The plugin, `@fastify/cors` and `API_TRUSTED_ORIGIN` are removed. The api stays published (`/reference`).
- **The proxy is a Route Handler**, not `rewrites()`: rewrites are resolved at build time, which would freeze `API_URL` in the image.
- **Hover actions in the chat**: all four are built (go to step, fork here, inspect agent, redact from…). They reuse the existing entry points (cursor, fork sheet, drafts) rather than adding new ones.
- **Out of this batch**, still in the backlog: cryptic event labels and keyboard shortcuts.

### Phase 1: startup logs

- [x] Remove the `console.log` calls of `apps/api/src/paths.ts` and `plugins/cors.ts`; log the database path from the store plugin with `app.log`.
  **Verify:** `grep -rn console.log apps/api/src` finds nothing; `pnpm dev` shows the database path through pino.

### Phase 2: api address at runtime (`fix(ui)`)

- [x] `apps/ui/lib/proxy.ts` (`upstreamUrl`: rejects `.` and `..` segments, keeps the base path and the query) with `proxy.test.ts`.
- [x] `apps/ui/app/api/[...path]/route.ts` forwards `GET`, `POST`, `PATCH` and `DELETE` to `API_URL`, read on every request; answers 502 when the api is unreachable. `lib/fetch.ts` uses `/api` in the browser and `API_URL` on the server; `NEXT_PUBLIC_API_URL` is gone.
- [x] Remove CORS: `plugins/cors.ts`, `@fastify/cors`, `API_TRUSTED_ORIGIN`; update the ui Dockerfile, `docker-compose.yml`, `.env.example` and the README.
  **Verify:** `pnpm test`; in `pnpm dev` the browser sends no request to `:8080`; `docker compose up --build` works; the same ui image started with two different `API_URL` values reaches each api; `docker buildx bake -f docker-bake.hcl` passes.

### Phase 3: run page discoverability (`feat(ui)`)

- [x] 3a. The inspector is never empty: without a selection it lists the agents (name, behavior, memory), each one clickable; the control bar reopens it after it was closed.
  **Verify:** `pnpm --filter ui test` (`agentsOverview`); by hand: empty state, click an agent, close, reopen from the bar, move the cursor back with an event selected.
- [x] 3b. Hover and focus affordances with `Tooltip` (a small `Hint` wrapper) on everything clickable; with a single room the room card is not a button.
  **Verify:** by hand: tooltip on hover and on keyboard focus for each kind of clickable element; the single room card has no hover and no `aria-pressed`.
- [x] 3c. A "?" button in the control bar opens a legend of the page, with a "new" dot until it was opened once (`localStorage`, always in try/catch).
  **Verify:** `pnpm --filter ui test` (`lib/hints.ts`); by hand: dot on first load, gone after opening and after a reload; blocked storage leaves the page working.
- [x] 3d. On hover or focus: a step separator offers "Go to step N" and "Fork here", a message offers "Inspect <agent>" and "Redact from…". The fork sheet becomes controllable; the redaction adds a draft intervention.
  **Verify:** `pnpm --filter ui test` (`messageRedactionTargets`); by hand: both step actions move every panel / open the fork sheet at that step; a redaction shows in the drafts tray, goes with the next step and disappears from the agent's observation; on a completed run the actions are disabled and say why.

### Phase 4: run management

- [x] 4a. `types`: `notes` and `archived` on `RunRecord`, `updateRunRequestSchema`.
- [x] 4b. `db`: table `run_meta`, `updateRun`, `countForks`; the run queries read the new fields.
- [x] 4c. `engine`: `RunHasForksError`, use cases `updateRun` and `deleteRun` (not found, busy, has forks), with tests in the style of `fork.test.ts`, including a database created before `run_meta`.
  **Verify:** `pnpm --filter @experiments/engine test`.
- [x] 4d. `api`: `PATCH /runs/:id` and `DELETE /runs/:id`; `RunHasForksError` maps to 409.
  **Verify:** with `curl`: patch name, note and archived; delete a leaf (204); delete a parent (409, run intact); delete an unknown run (404); `/reference` lists both routes.
- [ ] 4e. `ui`: per-run menu in the run list (rename and note, archive, delete), delete disabled with a reason when the run has forks, archived runs hidden behind a switch, notes shown and searchable; deleting a run closes its tab, renaming it updates the tab.
  **Verify:** `pnpm --filter ui test` (fork counts); by hand: rename shows in the control bar and the fork tree, archive and unarchive, delete a leaf, a parent with forks cannot be deleted.

### Phase 5: documentation and closing

- [ ] Update `docs/agent/api-ui.md`, `docs/agent/engine.md`, `README.md`, `AGENT.md` and `design.md` (routes, proxy and runtime `API_URL`, no CORS, `run_meta`, run page, run list); fix the stale "no fork route" sentence.
- [ ] Remove the treated entries from [backlog.md](backlog.md); leave `roadmap.md` alone.
- [ ] Replace this plan with "None".
  **Verify:** `pnpm lint`, `pnpm check-types`, `pnpm test`; `grep -rn "NEXT_PUBLIC_API_URL\|API_TRUSTED_ORIGIN\|@fastify/cors" . --exclude-dir=node_modules --exclude=CHANGELOG.md` finds nothing.

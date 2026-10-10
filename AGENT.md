# AGENT.md

`experiments` is a TypeScript monorepo for running and inspecting multi-agent simulations (LLM-driven agents included). It is an experimentation system, not a generic agent framework.

Guiding principle: keep the simulation model explicit, small, deterministic where possible, and independent from infrastructure.

## Stack

- pnpm workspaces + Turborepo, Node >= 24 (the DB uses `node:sqlite`), TypeScript strict
- Zod 4 for every schema; types are inferred from schemas
- Biome for lint and format (tabs, double quotes)
- API: Fastify 5. UI: Next.js 16, React 19, Tailwind 4, shadcn (base-ui)
- LLM agents: LangChain + Anthropic, isolated in `packages/ai`

## Layout

```text
apps/api            Fastify HTTP adapter over engine + db
apps/ui             Next.js frontend (talks to the API over HTTP only)
packages/types      Zod schemas and inferred types: the shared contract
packages/settings   Env parsing (`env`), validated at import time
packages/db         SQLite `RunStore` (runs, scenarios, events)
packages/engine     Simulation domain and runtime
packages/ai         LLM-backed agent behaviors
packages/biome-config, packages/typescript-config   shared tooling config
```

`runs/` and `*.db` are local data and gitignored. Do not commit them.

## Commands

```bash
pnpm dev           # api (tsx watch, :8080) + ui (next dev, :3000)
pnpm lint          # biome check
pnpm format        # biome check --write
pnpm check-types   # turbo: tsc --noEmit in every package (ui runs next typegen first)
pnpm test          # turbo test (Vitest in packages/engine and apps/ui)
```

API docs are served at `/reference` (Scalar); health probes are under `/healthz`.

Before declaring work done: `pnpm lint` and `pnpm check-types`.

Docker: `docker compose up --build` runs the api and the ui (see the README for the variables).

Husky runs `biome check --staged` on commit and, on push, `scripts/project/guard-push.sh` (the branch must be `<type>/<issue>-<slug>` and its issue open, not an epic, Ready or In progress; needs network and `gh` with the `project` scope) then `check-types` + `test`. Fix failures; do not use `--no-verify` or `SKIP_ISSUE_GUARD=1` to get around them.

Local setup: copy `.env.example` to `.env`. `@experiments/settings` validates env on import, and `ANTHROPIC_API_KEY` must start with `sk-ant-`, so any process importing it fails without a well-formed key, even when no LLM agent is used.

## Architecture rules

Allowed imports between workspaces:

```text
apps/api        → engine, ai, db, settings, types
apps/ui         → settings, types   (reaches the API over HTTP only)
packages/ai     → engine, settings, types
packages/engine → db, types
packages/db     → types
packages/types  → (Zod only)
```

- `types` depends only on Zod. It is the single source of truth for events, actions, scenarios, runs. Never redefine these shapes in `api` or `ui`; import them.
- `engine` owns simulation semantics. It must not import `apps/*`, Fastify, React/Next, or an LLM provider. Its only infrastructure dependency is `RunStore`.
- `ai` extends the engine (it registers the `llm` behavior); the engine never imports `ai`.
- `api` is a thin adapter: HTTP, validation, serialization. No simulation logic.
- `ui` never imports `engine` or `db`. It reads data through `apps/ui/lib/api.ts`.
- Workspace packages export TypeScript source directly (no build step). `@experiments/types` uses subpath exports (`@experiments/types/events`); a new file there needs an entry in its `package.json` `exports`.

Decide where a change belongs (domain model, runtime, adapter, presentation) before writing it, and keep infrastructure at the edges.

## Simulation invariants

These are behavioral contracts. Do not break them without being asked to.

- A step is: agents observe → agents propose actions → the scheduler selects an executable action, if any → it is executed → events are recorded → simulation time advances.
- **Time advances every step, even when nobody speaks.** Silence is a simulation state. Never skip or collapse silent steps.
- Simulation time (`SimulationClock`) and wall-clock time are separate. Wall-clock time must never influence behavior.
- Events are immutable facts with an explicit `type`; actions are discriminated by an explicit `type` too. Never infer a type from payload shape. Build events through their Zod schema (`xxxSchema.parse`).
- Reproducibility: same scenario + seed → same trajectory. All randomness goes through `RunConfig.rngForStep(step)` (`SeededRandom`, derived from seed and step); never use `Math.random()`. `runId` and event `id` are execution-specific, so compare normalized behavior rather than raw artifacts. A fork copies its parent's events up to a step instead of recomputing them: it is reproducible from scenario + seed + lineage (see [docs/agent/engine.md](docs/agent/engine.md)).
- Interventions are events recorded *between* two steps: `step` is the step they follow and they take effect from the next one. The engine validates them, commits them with the step (or the fork), and honors them in `Room.view` and `Observation.instructions`; an agent never sees one as an event.
- Agents never see the whole world. They get an `Observation` containing a `RoomView`; visibility rules live in `Room.view`.

Details, event catalogue and persistence behavior: [docs/agent/engine.md](docs/agent/engine.md).

## Conventions

- Match the surrounding code. Fields are camelCase everywhere (`agentId`, `runId`).
- IDs are branded (`AgentId`, `RoomId`, `RunId`, `EventId`). Agent and room IDs come from scenario files and are opaque strings; run and event IDs are UUIDs.
- Closed sets (agent behaviors, memory kinds, scheduler types) are declared as Zod enums in `packages/types`, and the engine registries must cover them exactly. Adding a member touches both sides; see the `add-engine-component` skill.
- Server code (`apps/api`, `packages/ai`) reads configuration through `env` from `@experiments/settings`, not `process.env`.
- Prefer the smallest change that solves the task. Do not add dependencies or infrastructure without a concrete need.
- Keep deterministic components testable offline: use fakes instead of real LLM calls.
- Surface genuine design ambiguity instead of silently introducing a framework-level abstraction.

## Planning and work tracking

Planning lives in GitHub, not in the repo: the [experiments project](https://github.com/users/Bredda/projects/9) (Status: Backlog, Todo, In Progress, Done; Horizon: Now, Next, Later) over the issues of this repository.

- An **epic** is an issue labelled `epic` that groups one roadmap axis or theme; its **sub-issues** (GitHub sub-issues) are the units of work. A sub-issue is sized for one pull request.
- Work on a sub-issue only when asked to, or when it is the one the user pointed to. Do not pick items from the backlog on your own.
- Branch `<type>/<issue-number>-<slug>` (for instance `feat/123-compare-runs`), one pull request for the sub-issue, with `Closes #<number>` in its description so merging closes the issue and moves it to Done. The pull request description says what changed and how it was verified.
- A sub-issue is done when what it describes works and `pnpm lint`, `pnpm check-types` and `pnpm test` pass. If the plan turns out wrong or the issue is too big, edit the issue or split it into more sub-issues before continuing; surface genuine design ambiguity in the issue rather than deciding silently.
- A decision that changes the simulation model or an invariant updates `AGENT.md`, `design.md` or `docs/agent/*` in the same pull request.
- `roadmap.md` keeps only the vision, principles and what is out of scope.

## Commits, releases and CI

- **One pull request per sub-issue, merged with squash and merge.** The pull request title becomes the single commit on `main` and release-please turns it into one changelog line, so the title is a **conventional commit** (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `test:`, `build:`, `ci:`, `chore:`, optional scope; `!` for a breaking change) typed honestly (`feat` only for what a user can now do; plumbing is `refactor`) and written for a reader of the changelog. CI checks it. Commits inside the branch are not read by release-please and may be fix-ups. The repository only allows squash merges, uses the PR title as the commit title and leaves the body empty.
- Releases are automated by release-please. Never edit `CHANGELOG.md`, the root `version` or `.release-please-manifest.json` by hand.
- CI (`.github/workflows/ci.yml`) runs `pnpm lint`, `pnpm check-types` and `pnpm test` on pull requests and on `main`. A single `Docker build` job builds both images in parallel (`docker-bake.hcl`; `docker buildx bake -f docker-bake.hcl` locally), only on pull requests that touch files the images use, and not on release PRs. Images are published once, by `release.yml`, when a release is created. Run the three commands before pushing.
- Images: `apps/api/Dockerfile` and `apps/ui/Dockerfile`, built from the repo root on `node:24-alpine`. Both install dependencies from the lockfile and the `package.json` manifests only, before copying the sources, so the install layer is reused until a dependency changes: **when you add a workspace package, add its `package.json` to the manifest `COPY` lines of both Dockerfiles** (the frozen-lockfile install fails otherwise). The api runs from TypeScript source with `tsx` (workspace packages have no build step), so `tsx` is a production dependency of `apps/api`. The ui is a Next.js standalone build; it knows the api only through the runtime variable `API_URL`, read by its `/api` proxy route, so one image serves any api.

## Testing

Vitest runs in `packages/engine` (`pnpm --filter @experiments/engine test`), `packages/ai` (`pnpm --filter @experiments/ai test`) and `apps/ui` (`pnpm --filter ui test`); tests sit next to the code as `*.test.ts` and use a temporary SQLite file, never real LLM calls (in `packages/ai`, `LLMAgent` takes an injected `ProposalRunner`, so tests pass a fake one and never import `anthropicRunner.ts`, the only file that reads the API key). When changing simulation behavior, cover the contract (silent steps, time advancement, fixed-seed reproducibility, scheduler selection, run persistence). In `apps/ui`, Vitest covers only pure view logic in `lib/` (node environment, no DOM or component tests). Other packages have no runner yet: add a `test` script there when you write their first test.

## Where to look

| Working on | Read |
| --- | --- |
| Engine, events, scenarios, persistence | [docs/agent/engine.md](docs/agent/engine.md) |
| API routes, UI pages and components | [docs/agent/api-ui.md](docs/agent/api-ui.md) |
| Adding a behavior, scheduler or memory | skill `add-engine-component` |
| Adding an event type | skill `add-event-type` |
| Overall design | [design.md](design.md) |
| Planned work, current task, backlog | the GitHub project and issues (see Planning and work tracking) |
| Vision, principles, out of scope | [roadmap.md](roadmap.md) |

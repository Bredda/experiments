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
pnpm test          # turbo test
```

API docs are served at `/reference` (Scalar); health probes are under `/healthz`.

Before declaring work done: `pnpm lint` and `pnpm check-types`.

Husky runs `biome check --staged` on commit and `check-types` + `test` on push. Fix failures; do not use `--no-verify`.

Local setup: copy `.env.example` to `.env`. `@experiments/settings` validates env on import, and `ANTHROPIC_API_KEY` must match `sk-ant-api…`, so any process importing it fails without a well-formed key, even when no LLM agent is used.

## Architecture rules

Allowed imports between workspaces:

```text
apps/api        → engine, ai, db, settings, types
apps/ui         → settings, types   (reaches the API over HTTP only)
packages/ai     → engine, settings, types
packages/engine → db, settings, types
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
- Reproducibility: same scenario + seed → same trajectory. All randomness goes through `RunConfig.rng` (`SeededRandom`); never use `Math.random()`. `runId` and event `id` are execution-specific, so compare normalized behavior rather than raw artifacts.
- Agents never see the whole world. They get an `Observation` containing a `RoomView`; visibility rules live in `Room.view`.

Details, event catalogue and persistence behavior: [docs/agent/engine.md](docs/agent/engine.md).

## Conventions

- Match the surrounding code. Fields are camelCase everywhere (`agentId`, `runId`).
- IDs are branded (`AgentId`, `RoomId`, `RunId`, `EventId`). Agent and room IDs come from scenario files and are opaque strings; run and event IDs are UUIDs.
- Closed sets (agent behaviors, memory kinds, scheduler types) are declared as Zod enums in `packages/types`, and the engine registries must cover them exactly. Adding a member touches both sides; see the `add-engine-component` skill.
- Server and engine code read configuration through `env` from `@experiments/settings`, not `process.env`.
- Prefer the smallest change that solves the task. Do not add dependencies or infrastructure without a concrete need.
- Keep deterministic components testable offline: use fakes instead of real LLM calls.
- Surface genuine design ambiguity instead of silently introducing a framework-level abstraction.

## Testing

No test runner is configured yet, so `pnpm test` is currently a no-op. When changing simulation behavior, cover the contract (silent steps, time advancement, fixed-seed reproducibility, scheduler selection, run persistence) with focused tests. If you introduce the first runner, add a `test` script to the package (Turbo already defines the task) and tell the user which runner you picked.

## Where to look

| Working on | Read |
| --- | --- |
| Engine, events, scenarios, persistence | [docs/agent/engine.md](docs/agent/engine.md) |
| API routes, UI pages and components | [docs/agent/api-ui.md](docs/agent/api-ui.md) |
| Adding a behavior, scheduler or memory | skill `add-engine-component` |
| Adding an event type | skill `add-event-type` |
| Overall design | [design.md](design.md) |
| Planned work and ideas | [roadmap.md](roadmap.md) |

`roadmap.md` is the only place for planned work and ideas. Do not implement roadmap items unless asked.

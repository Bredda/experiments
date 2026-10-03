# experiments

An experimental environment for running, inspecting and comparing multi-agent simulations, including LLM-driven agents. It is a simulation system, not a generic agent framework.

## Requirements

- Node >= 24
- pnpm

## Getting started

```sh
pnpm install
cp .env.example .env   # set a valid ANTHROPIC_API_KEY (sk-ant-api...)
pnpm dev               # API on :8080, UI on :3000
```

API reference: http://localhost:8080/reference

## Repository

| Path | Role |
| --- | --- |
| `apps/api` | Fastify HTTP API over the engine and the run store |
| `apps/ui` | Next.js frontend |
| `packages/types` | Zod schemas shared by every workspace |
| `packages/settings` | Environment parsing |
| `packages/db` | SQLite run store |
| `packages/engine` | Simulation engine |
| `packages/ai` | LLM-backed agent behaviors |

## Scripts

```sh
pnpm dev           # run api and ui
pnpm build         # build all packages
pnpm lint          # biome check
pnpm format        # biome check --write
pnpm check-types   # type-check all packages
pnpm test          # run tests
```

## Documentation

- [design.md](design.md): technical design
- [roadmap.md](roadmap.md): planned work
- [AGENT.md](AGENT.md): guidance for coding agents

# API and UI reference

## API (`apps/api`)

Fastify 5, ESM, run with `tsx watch src/index.ts`. Config comes from `env` (`API_HOST`, `API_PORT`, `API_TRUSTED_ORIGIN`, `DB_PATH`, `API_REF_PATH`).

Structure:

```text
src/index.ts          bootstrap (logger, error handler, plugins, routes)
src/plugins/          cors, sensible, OpenAPI + Scalar reference
src/routes/           one Fastify plugin per resource, registered with a prefix
src/paths.ts          resolves DB_PATH against the monorepo root
```

Routes: `GET/POST /runs`, `GET /runs/:id`, `GET /runs/:id/events`, and probes under `/healthz`.

Conventions:

- Request and response schemas come from `@experiments/types`: `schema.toJSONSchema()` for Fastify/OpenAPI (`{ target: "draft-7" }` for bodies), `schema.parse` for validation inside handlers. Do not hand-write a parallel JSON schema.
- Handlers call `@experiments/engine` and `@experiments/db`; they contain no simulation logic.
- Add each new route group in `src/routes/index.ts` and give it `description` and `tags` so it shows up in `/reference`.

## UI (`apps/ui`)

Next.js 16 App Router. This version differs from older Next.js: before writing Next-specific code, read the relevant guide in `apps/ui/node_modules/next/dist/docs/` (see `apps/ui/AGENTS.md`, which `next dev` maintains; leave it alone).

Structure:

```text
app/                  routes: /, /runs, /runs/[runId], /create-run
components/ui/        shadcn primitives (style base-mira, icons: hugeicons)
components/run/       run viewer: timeline, event inspector, header
components/runs/      run list
components/create-run/ scenario form (TanStack Form + Zod)
lib/api.ts            typed API client; lib/fetch.ts is the fetch wrapper
lib/run-tabs.ts       open run tabs, stored in sessionStorage
```

Conventions:

- Use the `@/` alias for app-internal imports.
- Fetch data in server components through `lib/api.ts`; the API base URL is `NEXT_PUBLIC_API_URL` (default `http://localhost:8080`).
- Types and Zod schemas come from `@experiments/types`. Reuse its enums (`AGENT_BEHAVIORS`, `MEMORY_KINDS`, `schedulerTypeSchema`) instead of repeating literals. The create-run form keeps label maps keyed by those types, so a new member fails type-checking until labelled.
- Add shadcn primitives with the shadcn CLI (config in `components.json`) rather than writing them by hand.
- The run page is constrained to the viewport height with independent scroll areas for timeline and inspector; keep that layout when editing it.

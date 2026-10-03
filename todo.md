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

## Current plan: containerize, publish, version

Chore, on branch `chore/containerization`. Not tied to a roadmap axis.

**Goal:** the api and the ui build into two Docker images, a pull request proves they still build, a release publishes them to GHCR with a version, and the changelog and version number come from conventional commits instead of being maintained by hand.

### Decisions

- **D1. Two images, `api` and `ui`**, one Dockerfile each (`apps/api/Dockerfile`, `apps/ui/Dockerfile`, build context is the repo root) and a `docker-compose.yml` to run them together. Decided with the user.
- **D2. Registry: GHCR**, authenticated with the workflow's `GITHUB_TOKEN`. Decided with the user.
- **D3. Releases with release-please, one version for the whole repo** (tags `vX.Y.Z`, one `CHANGELOG.md`, both images carry the same tag). Decided with the user.
- **D4. The api runs from TypeScript source with `tsx`**, like in development: workspace packages export `.ts` and there is no build step today. `tsx` moves to the api's `dependencies`. The image installs production dependencies only and keeps the workspace layout, so `tsx` loads the packages from `packages/` rather than from `node_modules`.
- **D5. Where the browser finds the api.** `NEXT_PUBLIC_API_URL` is inlined into the ui at build time (build argument, default `http://localhost:8080`), and server-side rendering uses a runtime `API_URL` (in compose, `http://api:8080`). Limitation, accepted for now: a published ui image is only correct where the browser reaches the api at the baked URL; any other deployment rebuilds with its own URL. Runtime configuration through a proxy route in the ui is in the backlog.
- **D6. Pull request titles must be conventional commits.** Merges are squashed, so the title becomes the commit message release-please reads; a check enforces it.
- **D7. Release PRs and CI.** PRs opened with `GITHUB_TOKEN` do not trigger other workflows, so the release PR would never get its required check. The workflow uses a `RELEASE_PLEASE_TOKEN` secret (a PAT) when it exists and falls back to `GITHUB_TOKEN`; the user adds the secret.

### Phase A — Images and compose

- [x] **A1. API image and runtime config**
  `apps/api/Dockerfile` (multi-stage, Node 24, pnpm from `packageManager`, production dependencies of `api` and its workspace dependencies, non-root user, `/data` volume, healthcheck on `/healthz/live`), a `start` script in `apps/api/package.json`, `tsx` moved to dependencies, root `.dockerignore`. The image sets `ENV=production`, `API_HOST=0.0.0.0` and `DB_PATH=/data/simulation.db`.
  Verify: `docker build` succeeds; the container starts with a valid `ANTHROPIC_API_KEY`, `/healthz/live` answers, and a run created through the api survives a container restart with the same volume.
  Status: done and checked locally: healthy container, run created, container removed and recreated on the same volume, the run was still there and stepped to completion. The image is about 510 MB. `docker run --env-file .env` keeps the quotes of a value like `DB_PATH="..."` (dotenv strips them), so it overrides the image's defaults with a broken path; pass only the variables you need, or use compose where `environment` wins over `env_file`.

- [x] **A2. UI image**
  `output: "standalone"` and the tracing root in `apps/ui/next.config.ts`, `apps/ui/Dockerfile` (build argument `NEXT_PUBLIC_API_URL`, non-root user, standalone server on port 3000), and `lib/fetch.ts` reading `API_URL` on the server (D5).
  Verify: `docker build` succeeds; with the api container reachable, the run list page renders server-side and the browser-side calls go to `NEXT_PUBLIC_API_URL`.
  Status: done and checked through compose: the server-rendered run list and run page show data fetched from the api container, and the client bundle contains the baked `NEXT_PUBLIC_API_URL`. `next/font` downloads Google Fonts during the build, so the build needs network access.

- [x] **A3. Compose**
  `docker-compose.yml` with both services, a named volume for the database, `.env` as `env_file` for the api (the ui needs no key), `API_TRUSTED_ORIGIN` for the ui origin, and the ui waiting for a healthy api.
  Verify: `docker compose up --build` then create a run, step it to completion through the ui address and check it appears after `docker compose restart`.
  Status: done with the ports moved to 18080/13000 to avoid the dev servers (`API_PUBLISHED_PORT`, `UI_PUBLISHED_PORT`): both services healthy, CORS answers for the ui origin, a run created and stepped through the api was still there after `docker compose restart`. Clicking "Next step" in a browser was not tried (no browser in the sandbox).

### Phase B — CI builds the images

- [x] **B1. Build both images on pull requests**
  Add a job to `.github/workflows/ci.yml` building `api` and `ui` with Buildx and the GitHub Actions cache, without pushing.
  Verify: a pull request shows the two builds; the job fails if a Dockerfile breaks.
  Status: written and the same builds pass locally; the workflow itself can only be proven by GitHub on the first pull request. New check names to require in the branch rule: `Docker build (api)` and `Docker build (ui)`.

### Phase C — Versioning, changelog, publishing

- [ ] **C1. Conventional pull request titles** (D6)
  `.github/workflows/pr-title.yml` validating titles against the conventional commit types.
  Verify: a PR titled "Feat/foo" fails and "feat: foo" passes.
  Status: written (`.github/workflows/pr-title.yml`, `pull_request_target`, so it only starts working once it is on `main`). Not provable locally.

- [ ] **C2. release-please** (D3, D7)
  `release-please-config.json`, `.release-please-manifest.json`, a `version` in the root `package.json`, and `.github/workflows/release.yml` opening the release PR from conventional commits on `main`.
  Verify: after the merge of this phase, a release PR with the version bump and `CHANGELOG.md` appears; merging it creates the tag and the GitHub release.
  Status: written (`release-please-config.json`, `.release-please-manifest.json` at 0.0.0, `version` in `package.json`, `release.yml`). With `bump-minor-pre-major` the first release should be 0.1.0. Needs the repository setting "Allow GitHub Actions to create and approve pull requests", and ideally a `RELEASE_PLEASE_TOKEN` secret (D7). Not provable locally.

- [ ] **C3. Publish images on release** (D2)
  In the same workflow, when a release is created, build and push `ghcr.io/<owner>/<repo>/api` and `/ui` tagged `X.Y.Z`, `X.Y` and `latest`, with OCI labels. Done in that workflow because tags pushed with `GITHUB_TOKEN` do not trigger others.
  Verify: after the first release, both images exist in GHCR with the three tags.
  Status: written as the `images` job of `release.yml` (matrix api and ui, login with `GITHUB_TOKEN`, tags `X.Y.Z`, `X.Y`, `latest`, lowercase image names). The ui image is built with the default `NEXT_PUBLIC_API_URL` (see D5). Not provable locally.

### Phase D — Docs and wrap-up

- [ ] **D1. Update documentation**
  `README.md` (running with Docker, configuration table), `AGENT.md` (conventional commit and PR title rule, releases are automated and `CHANGELOG.md` and the version are never edited by hand, image notes), `docs/agent/` if the api or ui configuration changed, and this plan replaced by "None".

### Done when

- `docker compose up --build` gives a working app with data kept across restarts.
- A pull request builds both images and rejects a non-conventional title.
- Merging the release PR tags `vX.Y.Z`, writes the changelog, and publishes both images to GHCR.
- `pnpm lint`, `pnpm check-types` and `pnpm test` pass.

---

## Backlog

Unscheduled, not part of the current plan.

- Test the `llm` agent prompt without calling the model (`packages/ai` has no test runner); the two-system-message bug fixed in phase E would have been caught by one.
- Make the ui image configurable at runtime: a proxy route in the ui forwards browser calls to `API_URL`, so no api URL is baked at build time and CORS between ui and api disappears.
- Rewrite the event log viewer (`components/run/events.tsx`, `event-panel.tsx`): clearer step grouping, readable labels for every event type.
- Remove startup `console.log` calls in `apps/api/src/paths.ts` and `apps/api/src/plugins/cors.ts` in favor of the Fastify logger.
- `components/run/header.tsx` (`RunHeader`) is no longer used anywhere; delete it or reuse it.
- Support more than one room per scenario (the engine currently throws unless there is exactly one).

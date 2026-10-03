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

## Current plan

None for now. Containerization is written and verified locally; what still needs GitHub to be proven is listed in the pull request that carries it (first CI run, release PR, first image publication). Next candidates: the time cursor (roadmap axis 2) and per-run cost (axis 7).

A plan in this file has: a goal, a short "where we are", **Decisions** (each with a recommendation, confirmed by the user before the tasks that depend on it), tasks grouped in phases (one commit per phase), each task with the files it touches and a **Verify** line, and a "Done when" block.

---

## Backlog

Unscheduled, not part of the current plan.

- Test the `llm` agent prompt without calling the model (`packages/ai` has no test runner); the two-system-message bug fixed in phase E would have been caught by one.
- Make the ui image configurable at runtime: a proxy route in the ui forwards browser calls to `API_URL`, so no api URL is baked at build time and CORS between ui and api disappears.
- Rewrite the event log viewer (`components/run/events.tsx`, `event-panel.tsx`): clearer step grouping, readable labels for every event type.
- Remove startup `console.log` calls in `apps/api/src/paths.ts` and `apps/api/src/plugins/cors.ts` in favor of the Fastify logger.
- `components/run/header.tsx` (`RunHeader`) is no longer used anywhere; delete it or reuse it.
- Support more than one room per scenario (the engine currently throws unless there is exactly one).

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

None for now. Next candidates, in the roadmap's suggested order: re-run from a run and side-by-side comparison (axis 7, slices 7.1 and 7.2), then agents and memory (axis 3).

A plan in this file has: a goal, a short "where we are", **Decisions** (each with a recommendation, confirmed by the user before the tasks that depend on it), tasks grouped in phases (one commit per phase), each task with the files it touches and a **Verify** line, and a "Done when" block.

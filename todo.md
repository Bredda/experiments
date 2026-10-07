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

### Goal

Close the one open point of axis 3 (agents and memory, all other work is merged into the branch `feat/agents-memory`): confirm against the real API that the token usage of an `llm` call is recorded.

### Where we are

The runner (`packages/ai/src/anthropicRunner.ts`) sums `usage_metadata` over the AI messages returned by LangChain and the engine stores it on `agent.prompt_built`. Both are covered offline with fakes, but a real call was never made: the `ANTHROPIC_API_KEY` in `.env` is rejected by the API (401), so whether LangChain fills `usage_metadata` on the structured-output path is unverified. The runner tolerates its absence (the event then carries the model only).

### Tasks

- [ ] Put a valid `ANTHROPIC_API_KEY` in `.env`, run a one-step scenario with an `llm` agent (for instance `persona`, `model: claude-haiku-4-5-20251001`, `memory: last_n`) and read its `agent.prompt_built` event. **Verify:** it has `model` and `usage` with non-zero `inputTokens` and `outputTokens`, and the prompt starts with the persona. If `usage` is missing, fix the extraction in `anthropicRunner.ts` and add a test of `sumUsage` on a realistic message list.
- [ ] Then replace this plan with "None" and drop the "Left over" sentence about it in `roadmap.md` (axis 3).

### Done when

A real run stores the model and the token usage of each `llm` agent call.

---

A plan in this file has: a goal, a short "where we are", **Decisions** (each with a recommendation, confirmed by the user before the tasks that depend on it), tasks grouped in phases (one commit per phase), each task with the files it touches and a **Verify** line, and a "Done when" block.

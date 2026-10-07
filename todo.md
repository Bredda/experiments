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

Axis 3 of the roadmap: the same scenario can run with different personas, models or memory configurations by changing only its configuration. The model metadata of a call is recorded and the `llm` prompt is testable offline.

### Where we are

`packages/ai` hard-codes `claude-haiku-4-5` and one persona sentence, `agentConfigSchema` is `{ id, behavior, memory? }`, `sliding_window` is the only memory kind (it keeps the whole visible history), `agent.prompt_built` carries the prompt only, and `packages/ai` has no test runner.

### Decisions

- Second memory strategy: `last_n`, with N fixed in the code (5). `sliding_window` stays as it is, stored runs are untouched. A parametrizable N (memory config object) is not part of this plan. Confirmed.
- `model` is a closed Zod enum in `packages/types`, a select in the UI. Confirmed.
- Model metadata (`model`, `usage`) is added as optional fields on `agent.prompt_built`, no new event type. Confirmed.
- `persona` and `model` are only valid on `llm` agents (the scenario is rejected otherwise). A missing persona keeps today's prompt text, so existing scenarios behave as before. No recommendation left open.

### Phases

One commit per phase, in this order (conventional commits, they feed release-please).

**1. `refactor(engine): pass agent behavior factories a params object`**
- [x] `AgentBehaviorFactory` takes one params object instead of four positional arguments; update the registrations, `buildAgent` and the `llm` registration in `packages/ai/src/index.ts`. Files: `packages/engine/src/agents/registry.ts`, `scenario/factory.ts`, `packages/ai/src/index.ts`. **Verify:** `pnpm check-types`, `pnpm test`, no behavior change.

**2. `refactor(ai): extract llm prompt building and model runner`**
- [ ] Pure `buildPrompt`, injectable `runner`, `anthropicRunner.ts` as the only file importing `env`; per-model lazy cache. Files: `packages/ai/src/*`. **Verify:** `pnpm check-types`; the prompt text is unchanged.

**3. `feat: define persona and model per agent in the scenario`**
- [ ] `AGENT_MODELS`, `persona?`, `model?` on `agentConfigSchema`, rejected on non-`llm` agents; `LLMAgent` uses them. Files: `packages/types/src/scenario.ts`, `packages/engine/src/scenario/factory.ts`, `packages/ai/src/*`, `docs/agent/engine.md`. **Verify:** engine test on schema acceptance and rejection; `pnpm test`.

**4. `feat(engine): add last_n memory strategy`**
- [ ] `last_n` in `MEMORY_KINDS`, `LastNMemory`, registration, UI label. Files: `packages/types/src/memory.ts`, `packages/engine/src/memory/*`, `apps/ui/components/create-run/schemas.ts`. **Verify:** `memory.test.ts` (truncation, own proposals only, fewer than N events, determinism).

**5. `feat: record model and token usage on agent.prompt_built`**
- [ ] Optional `meta` on `actionProposalSchema`, optional `model` and `usage` on `agentPromptBuiltSchema`, copied by `Simulation`; the runner fills them. Files: `packages/types/src/{actions,events}.ts`, `packages/engine/src/simulation.ts`, `packages/ai/src/*`. **Verify:** engine test (event carries the metadata, persisted and restored; absent metadata unchanged); real run confirms the usage is populated (needs an API key).

**6. `test(ai): run the llm agent offline with a fake runner`**
- [ ] `test` script, vitest and config in `packages/ai`; tests for the prompt with and without persona, memory in the prompt, one system message, proposal mapping, metadata. Update the Testing section of `AGENT.md`. **Verify:** `pnpm --filter @experiments/ai test`, no API key needed.

**7. `feat(ui): configure persona, model and memory per agent and show model usage`**
- [ ] Persona textarea and model select (for `llm` only) in the agent dialog, agent card, `toScenarioConfig`; persona and model in `agentSummary` and the agent panel; model and tokens next to the prompt. Files: `apps/ui/components/create-run/*`, `apps/ui/components/run/*`, `apps/ui/lib/run-view.ts`, `docs/agent/api-ui.md`. **Verify:** `pnpm --filter ui test` for the `lib/` part, manual check of the form and the run page.

**8. `docs: mark agents and memory done`**
- [ ] `roadmap.md` status of axis 3, `docs/agent/engine.md` final pass, this plan back to "None". **Verify:** `pnpm lint`.

### Done when

The same scenario runs with different personas, models or memory kinds by changing only its configuration, `agent.prompt_built` records the model and the token usage, the `llm` prompt is covered by offline tests, and `pnpm lint`, `pnpm check-types` and `pnpm test` pass.

---

A plan in this file has: a goal, a short "where we are", **Decisions** (each with a recommendation, confirmed by the user before the tasks that depend on it), tasks grouped in phases (one commit per phase), each task with the files it touches and a **Verify** line, and a "Done when" block.

---
name: add-engine-component
description: Add a new agent behavior, scheduler or memory kind to the simulation engine. Use when the user wants a new way for agents to act, a new scheduling policy, or a new memory strategy, including wiring it into scenarios and the create-run UI.
---

Each component has a closed set declared in `packages/types` and an implementation registered in `packages/engine` (or `packages/ai` for LLM-backed ones). Both sides must stay in sync, otherwise scenarios fail validation or the registry throws.

## Agent behavior

1. `packages/types/src/scenario.ts`: add the name to `AGENT_BEHAVIORS`.
2. Create `packages/engine/src/agents/<name>Agent.ts` with a class extending `Agent`. `propose` returns an `ActionProposal` (sync or async) built with `speak(...)` / `staySilent(...)` / `actionProposal(...)` from `@experiments/types/actions`. Use `this.memoryType` and `getMemory` if it needs history. Keep it deterministic: no `Math.random()`, no wall-clock reads.
3. Export it in `agents/index.ts` and register a factory in `agents/registry.ts`.
4. LLM or network-backed behavior: put it in `packages/ai` and register through `agentBehaviorRegistry.register(...)` in its `index.ts` instead. `apps/api` imports `@experiments/ai` for that side effect.
5. UI: add a label to `BEHAVIOR_LABELS` in `apps/ui/components/create-run/schemas.ts` (type-check fails until you do).

## Scheduler

1. `packages/types/src/scenario.ts`: add the name to `schedulerTypeSchema`.
2. Create `packages/engine/src/scheduler/<name>.ts` extending `Scheduler`; `select(candidates, rng)` must be deterministic given the rng and must throw on an empty list.
3. Export in `scheduler/index.ts`; add it to the `schedulers` record in `scheduler/registry.ts` (`satisfies Record<SchedulerType, ...>` enforces coverage).
4. UI: add a label to `SCHEDULER_LABELS` in `apps/ui/components/create-run/schemas.ts`.

## Memory

1. `packages/types/src/memory.ts`: add the name to `MEMORY_KINDS`.
2. Create `packages/engine/src/memory/<name>Memory.ts` extending `Memory`; `buildSlice` only reads from the `RoomView` it receives.
3. Export and `registerMemory("<name>", () => new ...)` in `memory/index.ts`.
4. UI: add a label to `MEMORY_LABELS` in `apps/ui/components/create-run/schemas.ts`.

## Finish

- Run `pnpm lint` and `pnpm check-types`.
- Same scenario + seed must still give the same trajectory. Add a focused test if a test runner exists.

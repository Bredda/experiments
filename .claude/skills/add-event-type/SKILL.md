---
name: add-event-type
description: Add a new simulation event type (or action type) end to end: schema, engine emission, persistence and UI rendering. Use when the simulation needs to record a new kind of fact.
---

Events are immutable facts with a literal `type` discriminator. A new event touches the shared schema, the engine, and the UI inspector.

1. **Schema** in `packages/types/src/events.ts`: extend `eventSchema` with a `type: z.literal("<domain>.<verb>")` (dotted, lowercase, like `agent.joined`). Export the schema and its inferred type, then add it to `anyEventSchema`. This union is also used by `RoomView` and `EventRecord`, so everything downstream re-validates against it.
2. **Emit** from `packages/engine/src/simulation.ts`: build it with `<schema>.parse({ id: newEventId(), timestamp: this.clock.now, step: this.clock.step, ... })` and record it through `#append` so it is both logged and persisted. `events.append` alone is in-memory only.
3. **Persist**: nothing to do in `packages/db`; events are stored as JSON with their `type`, and rows are re-parsed with `anyEventSchema`. Old rows remain valid because the union only grows.
4. **UI**: handle the new case in `eventLabel` in `apps/ui/components/run/events.tsx` and add a renderer in `apps/ui/components/run/event-panel.tsx`. Events that are internal detail (like `agent.prompt_built`) can be filtered from the timeline instead.
5. **Memory/observation impact**: if agents should see the event, check `Room.view` and the memory classes in `packages/engine/src/memory`; they filter `visibleEvents` by type.

For a new action type, do the same in `packages/types/src/actions.ts` (add to `actionSchema`) and decide in `Simulation.step()` whether it becomes a scheduler candidate (today only `speak` does).

Do not change the shape of an existing event type without being asked; stored runs depend on it.

Finish with `pnpm lint` and `pnpm check-types`.

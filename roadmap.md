# experiments — Roadmap

## Vision

An environment where multi-agent systems can be configured, run, observed, replayed, manipulated and compared. The differentiator is not agent orchestration but controlled experimentation on interaction dynamics: what agents observe, when they act or stay silent, how they remember, and how an experimenter can intervene.

MVP workflow:

```text
define a scenario → run it → inspect it → replay it → change one parameter → run again → compare
```

"Replay" has two meanings here. Navigating a recorded run at any step, with what each agent observed (axis 2, done). And re-running a scenario from its seed, which is exact only for deterministic agents: real LLM calls are not reproducible, so a re-run of an LLM scenario is a new sample, not a copy.

The MVP does not need sophisticated emergent behavior. It needs to prove that controlled multi-agent experiments are easier here than with ad-hoc scripts and prompt pipelines.

## Principles

- The simulation kernel stays small, explicit and deterministic where possible.
- Infrastructure (HTTP, storage, model providers, telemetry) stays at the edges.
- Complexity is added only when an experiment shows the current model is insufficient.
- Anything that influences a run, including experimenter interventions, is recorded as an event so runs stay inspectable and replayable.

Ideas and cleanups that are not part of an axis below live in [backlog.md](backlog.md).

## Overview

Where the MVP stands: define, run, inspect and navigate a run work. The last two steps do not: there is no way to start from an existing run and change one parameter (the create-run form is filled from scratch every time), and nothing puts two runs side by side. Both belong to axis 7, which is why its first slice is the current priority; the parameters worth varying come from axes 3, 5 and 6.

| # | Axis | Horizon | Status |
| --- | --- | --- | --- |
| 1 | Run lifecycle | Done | Stepping, autoplay and concurrent agents work; streaming inside a step is on hold |
| 2 | Inspection and replay | Done | Time cursor, per-agent observation at any step, event filters by agent and type |
| 3 | Agents and memory | Next | LLM agent with one hard-coded model and persona, one memory kind |
| 4 | Interventions | Later | Not started |
| 5 | Environment | Later | Single room; the engine rejects several |
| 6 | Scheduling | Later | Two baseline policies, one speaker per step |
| 7 | Measurement and comparison | Now (7.1, 7.2), then Later | Not started |

Suggested order: 7.1 and 7.2 (close the MVP loop), then 3 (it also brings the model metadata that 7.4 needs), then 4, 5 and 6. Axis 4 benefits from 3 (memory) and from the fork described there. Axis 6 depends on 5 as soon as scheduling becomes per room. 7.3 and 7.4 are pulled in when an experiment needs them.

## 1. Run lifecycle

**Goal:** create, execute and follow a run entirely from the UI and API.

Runs are created from a scenario built in the UI, persisted in SQLite, and advanced one step at a time from the run page; status moves from created to completed. Autoplay (play/pause) is a client loop over the same step call: closing the tab stops the run. Agents propose concurrently within a step: with three `claude-haiku-4-5` agents a step went from about 7 to 10 seconds to about 3 seconds. Streaming inside a step stays on hold until that proves too slow.

**Done when:** a user can launch a run, advance it to completion and watch it unfold without leaving the UI. Reached.

## 2. Inspection and replay

**Goal:** understand a run as a trajectory over time.

The run page has a raw event viewer with filters by agent and event type, rooms as filters, a chat-style timeline and an agent panel. A time cursor in the control bar moves every panel to any played step (Live follows the run), and the agent panel shows what that agent observed at that step, rebuilt by the engine with the same code as a real step. For LLM agents the exact prompt is one click away.

Left over, none of it blocking: richer event views and cursor conveniences, tracked in the backlog.

**Done when:** a user can move through a finished run step by step and see what each agent could observe at that point. Reached.

## 3. Agents and memory

**Goal:** model-backed agents that are reliable, configurable and comparable to deterministic baselines, with memory as an explicit experimental variable.

Today the model (`claude-haiku-4-5`) and the persona prompt are fixed in `packages/ai`, the scenario cannot say anything about either, and there is one memory kind. In order:

1. Per-agent definition in the scenario: persona or instructions, and model. The UI form follows.
2. A second memory strategy, so memory is a variable and not a constant. Memory is stateless today: a slice is computed from the events the agent can see, which matters for axis 4.
3. Capture of model metadata (model id, token usage) next to the prompt that is already recorded as `agent.prompt_built`. Shared with 7.4.
4. The `llm` prompt becomes testable offline (a fake model; `packages/ai` has no test runner yet).

Deterministic stand-ins for offline use already exist (`mentioned`, `silent`).

**Done when:** the same scenario can run with different agent behaviors, personas, models or memory configurations by changing only its configuration.

## 4. Interventions

**Goal:** let the experimenter manipulate a run in a controlled, recorded way.

Examples: inserting a system prompt for a single step, injecting multimodal content (such as an image with no surrounding context) into the conversation of one specific agent, editing or removing parts of an agent's memory. Interventions can be scripted in a scenario or applied live from the UI, and they must appear in the event log so a run with interventions remains replayable and comparable to one without.

Two consequences of the current design:

- A live intervention can only affect the next step. Intervening at a past step means forking: a new run built from the events up to step N (the engine already rebuilds a simulation from stored events), then diverging. Fork is the first building block, and it also gives the "change one parameter at step N" experiment.
- Memory has no state to edit. Editing or removing memory is expressed as an intervention event that the visibility and memory code honors when building a view (for instance a redaction), not as a mutation. Each new intervention is a new event type.

**Done when:** an experimenter can alter what a chosen agent perceives or remembers at a chosen step, and the effect is visible and attributable in the trajectory.

## 5. Environment

**Goal:** make rooms meaningful information boundaries.

Today `Simulation` holds a single `Room`, the scenario schema accepts several rooms but `createRun` throws unless there is exactly one, and `Room.view` hands every member the full history. In order:

1. Several rooms in the engine. Selection then becomes one per room, which changes the "one speaker per step" behavior and therefore the step invariant in `AGENT.md`; that update is part of the work.
2. An explicit visibility policy behind `Room.view`.
3. Partial and private visibility, agent movement, and eventually communication topology as an experimental variable.

The ui already attributes events to rooms, and the observation replay goes through the same code as a real step, so both follow without a redesign.

**Done when:** two agents in the same experiment can intentionally see different subsets of the environment.

## 6. Scheduling

**Goal:** compare mechanisms that decide what happens next.

Two baseline policies exist (`highest_urgency`, `weighted_random`); both pick at most one speaker per step. Next steps are further baselines and policy-based scheduling, then research directions such as interruptions, speaking cost and attention signals. Per-room selection arrives with axis 5.

**Done when:** different policies produce measurable, inspectable differences in trajectories.

## 7. Measurement and comparison

**Goal:** make runs directly comparable.

1. **7.1 Re-run from a run.** Open the create-run form prefilled with an existing run's scenario to change one thing and launch again. No new API: it is `POST /runs` with an edited scenario. With deterministic agents and an unchanged scenario this reproduces the trajectory, which doubles as a visible reproducibility check.
2. **7.2 Side-by-side comparison.** Two runs of the same scenario with a changed parameter (first case: scheduler A versus scheduler B, same agents and seed), shown next to each other and navigated with the same step cursor, with the first step where they diverge marked.
3. **7.3 Metrics and export.** Derived trajectory metrics (participation balance, silence duration, response latency) and data export of a run. The engine can already write a run's events as JSONL, but nothing exposes it.
4. **7.4 Cost and observability.** Token and cost metrics per run, then traces and event-to-trace correlation. This observes the engine without defining it. When run cost is surfaced, count the model calls of failed steps too: a step that fails leaves no events, but the calls of the agents that had already answered (or were still in flight) were billed.

**Done when:** a changed parameter can be isolated and its impact evaluated across runs.

## Out of scope for now

Distributed or multi-node simulation, workflow orchestration engines, heavyweight agent frameworks as the simulation kernel, autonomous room or coalition creation, and production deployment architecture. Each may be revisited if an experiment shows a real need.

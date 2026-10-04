# experiments — Roadmap

## Vision

An environment where multi-agent systems can be configured, run, observed, replayed, manipulated and compared. The differentiator is not agent orchestration but controlled experimentation on interaction dynamics: what agents observe, when they act or stay silent, how they remember, and how an experimenter can intervene.

MVP workflow:

```text
define a scenario → run it → inspect it → replay it → change one parameter → run again → compare
```

The MVP does not need sophisticated emergent behavior. It needs to prove that controlled multi-agent experiments are easier here than with ad-hoc scripts and prompt pipelines.

## Principles

- The simulation kernel stays small, explicit and deterministic where possible.
- Infrastructure (HTTP, storage, model providers, telemetry) stays at the edges.
- Complexity is added only when an experiment shows the current model is insufficient.
- Anything that influences a run, including experimenter interventions, is recorded as an event so runs stay inspectable and replayable.

## Overview

| # | Axis | Horizon | Status |
| --- | --- | --- | --- |
| 1 | Run lifecycle | Done | Stepping and autoplay work; parallel agents and streaming pending |
| 2 | Inspection and replay | Done | Time cursor, per-agent observation at any step, event filters by agent and type |
| 3 | Agents and memory | Next | LLM agents and sliding-window memory exist |
| 4 | Interventions | Later | Not started |
| 5 | Environment | Later | Single room |
| 6 | Scheduling | Later | Two baseline policies |
| 7 | Measurement and comparison | Next, then Later | Not started |

## 1. Run lifecycle

**Goal:** create, execute and follow a run entirely from the UI and API.

Runs are created from a scenario built in the UI, persisted in SQLite, and advanced one step at a time from the run page; status moves from created to completed. Autoplay (play/pause) is a client loop over the same step call. Agents now propose concurrently within a step: with three `claude-haiku-4-5` agents a step went from about 7 to 10 seconds to about 3 seconds. Streaming inside a step stays on hold until that proves too slow.

**Done when:** a user can launch a run, advance it to completion and watch it unfold without leaving the UI.

## 2. Inspection and replay

**Goal:** understand a run as a trajectory over time.

The run page has a raw event viewer with filters by agent and event type, rooms as filters, a chat-style timeline and an agent panel. A time cursor in the control bar, next to play/pause, moves every panel to any played step (Live follows the run), and the agent panel shows what that agent observed at that step, rebuilt by the engine. Richer event views remain in the todo backlog.

**Done when:** a user can move through a finished run step by step and see what each agent could observe at that point.

## 3. Agents and memory

**Goal:** model-backed agents that are reliable, configurable and comparable to deterministic baselines, with memory as an explicit experimental variable.

Covers model and provider configuration, capture of model metadata and prompts, deterministic stand-ins for offline testing, and richer memory strategies selectable per agent in a scenario.

**Done when:** the same scenario can run with different agent behaviors or memory configurations by changing only its configuration.

## 4. Interventions

**Goal:** let the experimenter manipulate a run in a controlled, recorded way.

Examples: inserting a system prompt for a single step, injecting multimodal content (such as an image with no surrounding context) into the conversation of one specific agent, editing or removing parts of an agent's memory. Interventions can be scripted in a scenario or applied live from the UI, and they must appear in the event log so a run with interventions remains replayable and comparable to one without.

**Done when:** an experimenter can alter what a chosen agent perceives or remembers at a chosen step, and the effect is visible and attributable in the trajectory.

## 5. Environment

**Goal:** make rooms meaningful information boundaries.

Starts with an explicit visibility policy and multiple rooms, then partial and private visibility, agent movement, and eventually communication topology as an experimental variable.

**Done when:** two agents in the same experiment can intentionally see different subsets of the environment.

## 6. Scheduling

**Goal:** compare mechanisms that decide what happens next.

Two baseline policies exist. Next steps are further baselines and policy-based scheduling, then research directions such as interruptions, speaking cost and attention signals.

**Done when:** different policies produce measurable, inspectable differences in trajectories.

## 7. Measurement and comparison

**Goal:** make runs directly comparable.

First comparison: same scenario, agents and seed with scheduler A versus scheduler B, shown side by side. Then derived trajectory metrics (participation balance, silence duration, response latency) and data export. Deeper observability (traces, token and cost metrics, event-to-trace correlation) comes later and observes the engine without defining it. When run cost is surfaced, count the model calls of failed steps too: a step that fails leaves no events, but the calls of the agents that had already answered (or were still in flight) were billed.

**Done when:** a changed parameter can be isolated and its impact evaluated across runs.

## Out of scope for now

Distributed or multi-node simulation, workflow orchestration engines, heavyweight agent frameworks as the simulation kernel, autonomous room or coalition creation, and production deployment architecture. Each may be revisited if an experiment shows a real need.

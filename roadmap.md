# experiments — Roadmap

Planned work lives in the [experiments project](https://github.com/users/Bredda/projects/9) and its issues (epics and sub-issues, see `AGENT.md`). This file keeps what does not fit an issue: the vision, the principles and what is out of scope.

## Vision

An environment where multi-agent systems can be configured, run, observed, replayed, manipulated and compared. The differentiator is not agent orchestration but controlled experimentation on interaction dynamics: what agents observe, when they act or stay silent, how they remember, and how an experimenter can intervene.

MVP workflow:

```text
define a scenario → run it → inspect it → replay it → change one parameter → run again → compare
```

"Replay" has two meanings here. Navigating a recorded run at any step, with what each agent observed. And re-running a scenario from its seed, which is exact only for deterministic agents: real LLM calls are not reproducible, so a re-run of an LLM scenario is a new sample, not a copy.

The MVP does not need sophisticated emergent behavior. It needs to prove that controlled multi-agent experiments are easier here than with ad-hoc scripts and prompt pipelines.

## Principles

- The simulation kernel stays small, explicit and deterministic where possible.
- Infrastructure (HTTP, storage, model providers, telemetry) stays at the edges.
- Complexity is added only when an experiment shows the current model is insufficient.
- Anything that influences a run, including experimenter interventions, is recorded as an event so runs stay inspectable and replayable.

## Axes

Epics group the work by axis. Run lifecycle, inspection and replay, and agents and memory are done; the open ones are interventions, environment, scheduling and measurement and comparison (comparison of two runs is the current priority, since it closes the MVP loop). Environment must precede per-room scheduling, and interventions benefit from the fork already in place.

## Out of scope for now

Distributed or multi-node simulation, workflow orchestration engines, heavyweight agent frameworks as the simulation kernel, autonomous room or coalition creation, and production deployment architecture. Each may be revisited if an experiment shows a real need.

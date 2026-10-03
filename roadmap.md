# experiments — Roadmap

## Vision

Build an experimental environment where multi-agent systems can be:

```text
configured → run → observed → replayed → compared
```

The long-term differentiator is not generic multi-agent orchestration. It is experimentation with interaction dynamics under controlled conditions.

Key experimental dimensions include:

- what agents can observe;
- when agents act or remain silent;
- how agents communicate;
- how rooms and visibility are structured;
- how memory affects behavior;
- how different models behave under the same setup;
- how trajectories differ between configurations.

---

# Current Status

## Completed / Operational

- [x] Python simulation engine
- [x] Agents and rooms
- [x] Explicit actions and action type discriminators
- [x] `ActionProposal`
- [x] Immutable event model
- [x] Event log and JSONL export
- [x] Simulation clock
- [x] Deterministic seed foundation
- [x] YAML scenario configuration
- [x] Pydantic scenario models
- [x] Multiple-room scenario model
- [x] Run artifacts (`config.json`, `events.jsonl`)
- [x] Reproducibility tests
- [x] FastAPI application
- [x] Run API
- [x] OpenAPI contract
- [x] Generated TypeScript API types
- [x] Next.js UI
- [x] Fixed run header
- [x] Event timeline
- [x] Event selection
- [x] Event inspector
- [x] Room-scoped observation abstraction

---

# Near-Term Roadmap

## Epic 1 — Simulation Core Stabilization

**Goal:** establish a small, explicit, predictable simulation kernel.

### Short-term features

- [ ] Finalize core event/action contracts
- [ ] Strengthen tests around simulation invariants
- [ ] Verify simulation clock semantics
- [ ] Verify deterministic trajectories across repeated runs
- [ ] Tighten package boundaries
- [ ] Improve CLI output and local debugging

**Done when:** core behavior can be changed safely with focused tests protecting the simulation contract.

---

## Epic 2 — Scenario & Run Model

**Goal:** make experiments first-class, self-describing artifacts.

### Short-term features

- [ ] Finalize `ScenarioConfig`
- [ ] Validate room membership references
- [ ] Validate agent behavior identifiers
- [ ] Validate scheduler identifiers
- [ ] Standardize run metadata
- [ ] Standardize run artifact layout
- [ ] Preserve the exact scenario configuration used by a run

**Done when:** a scenario file alone is sufficient to reproduce the intended setup, and its run directory is self-describing.

---

## Epic 3 — Experiment Explorer

**Goal:** turn the existing UI into a useful run inspection tool.

### Short-term features

- [ ] Improve run list metadata
- [ ] Improve run detail metadata
- [ ] Human-readable event labels
- [ ] Event type filtering
- [ ] Agent filtering
- [ ] Room filtering
- [ ] Raw payload view
- [ ] Loading / empty / error states

**Done when:** a user can understand a run without manually opening its JSONL artifact.

---

## Epic 4 — Replay

**Goal:** inspect a run as a temporal trajectory.

### Short-term features

- [ ] Current simulation step indicator
- [ ] Timeline cursor
- [ ] Step-by-step navigation
- [ ] Jump to beginning/end
- [ ] Play/pause
- [ ] Derive visible state at a selected step

### Later

- [ ] Replay speed control
- [ ] Checkpoints
- [ ] Fork a run from a selected step

**Done when:** a user can navigate the simulation state over time rather than merely inspect a static event list.

---

# Medium-Term Roadmap

## Epic 5 — Real LLM Agents

**Goal:** introduce model-backed agents without changing the simulation contract.

### Features

- [ ] Define stable `LLM` interface
- [ ] Add deterministic mock LLM
- [ ] Add one hosted provider
- [ ] Add configurable model selection
- [ ] Convert `Observation` into model input
- [ ] Parse model output into `ActionProposal`
- [ ] Capture model metadata
- [ ] Keep deterministic agents for baselines

**Constraint:** providers remain behind an engine-level abstraction.

**Done when:** the same scenario can run with deterministic and LLM-backed agents.

---

## Epic 6 — Communication & Visibility

**Goal:** make rooms meaningful as experimental information boundaries.

### Features

- [ ] Explicit room visibility policy
- [ ] Partial event visibility
- [ ] Private rooms
- [ ] Temporary agent isolation
- [ ] Multiple concurrent rooms
- [ ] Agent movement between rooms
- [ ] Shared vs private context

**Done when:** two agents can participate in the same experiment while intentionally seeing different subsets of the environment.

---

## Epic 7 — Social Scheduling

**Goal:** experimentally compare different mechanisms for deciding what happens next.

### Features

- [ ] Keep round-robin as a baseline
- [ ] Add random baseline
- [ ] Add policy-based scheduling
- [ ] Measure participation balance
- [ ] Measure silence duration
- [ ] Measure response latency
- [ ] Compare scheduling policies

### Later research directions

- [ ] Interruptions
- [ ] Speaking cost
- [ ] Relevance / attention signals
- [ ] Competing action intentions
- [ ] Dynamic arbitration

**Done when:** different scheduling policies produce measurable and inspectable differences in interaction trajectories.

---

## Epic 8 — Memory

**Goal:** make memory an explicit experimental variable.

### Features

- [ ] Define `MemoryStore`
- [ ] In-memory implementation
- [ ] Episodic memory representation
- [ ] Retrieval instrumentation
- [ ] Per-agent memory
- [ ] Shared room memory
- [ ] Scenario-level memory configuration

### Later

- [ ] Vector-backed memory
- [ ] External memory backends
- [ ] Memory comparison experiments

**Done when:** the same scenario can be run with different memory configurations and the resulting trajectories can be compared.

---

# Longer-Term Roadmap

## Epic 9 — Deep Observability

**Goal:** inspect the internal execution of experiments without coupling telemetry to simulation semantics.

### Features

- [ ] OpenTelemetry spans for simulation steps
- [ ] Agent execution spans
- [ ] Scheduler spans
- [ ] LLM call traces
- [ ] Memory traces
- [ ] Token / latency / cost metrics
- [ ] Per-agent activity metrics
- [ ] Run-level metrics
- [ ] Event-to-trace correlation

**Principle:** telemetry observes the engine; it does not define the engine.

---

## Epic 10 — Experiment Comparison

**Goal:** make runs directly comparable as experimental artifacts.

### Features

- [ ] Compare runs side-by-side
- [ ] Compare seeds
- [ ] Compare schedulers
- [ ] Compare model configurations
- [ ] Compare memory configurations
- [ ] Derived trajectory metrics
- [ ] Export analysis data

Candidate metrics:

```text
speaking rate
silence duration
response latency
intervention frequency
participation balance
belief/state changes
convergence/divergence
```

**Done when:** a changed experimental parameter can be isolated and its impact evaluated across runs.

---

## Epic 11 — Advanced Interaction Topologies

**Goal:** treat communication topology as a first-class experimental variable.

### Features

- [ ] Dynamic room topology
- [ ] Isolated subgroups
- [ ] Temporary private conversations
- [ ] Controlled information leakage
- [ ] Communication graph visualization
- [ ] Topology mutation during a run

This should follow the basic visibility model rather than precede it.

---

# Explicitly Deferred

The following are deliberately outside the current MVP:

- Temporal
- Redis as a core dependency
- Postgres as the source of truth for runs
- distributed simulation
- multi-node execution
- autonomous room/coalition creation
- heavyweight multi-agent frameworks as the simulation kernel
- sophisticated cognitive architectures
- production deployment architecture

They may become appropriate later if an experiment demonstrates a real need.

---

# MVP Definition

The MVP is complete when the following workflow works end-to-end:

```text
1. Define a scenario.
2. Run it with a seed.
3. Produce a self-contained run artifact.
4. Open the run in the UI.
5. Inspect the complete event timeline.
6. Replay the run step by step.
7. Change one scenario parameter.
8. Run it again.
9. Compare the two trajectories.
```

The first meaningful experimental comparison should be deliberately simple:

```text
same scenario
same agents
same seed

scheduler A
vs
scheduler B

→ compare event trajectories
```

The goal is not to demonstrate sophisticated emergent behavior in the MVP.

The goal is to prove that `experiments` makes controlled multi-agent experimentation easier than ad-hoc scripts and prompt pipelines.

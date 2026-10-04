import type { RunId } from "@experiments/types/ids";

export class RunNotFoundError extends Error {
	constructor(readonly runId: RunId) {
		super(`Run ${runId} not found`);
		this.name = "RunNotFoundError";
	}
}

export class RunCompletedError extends Error {
	constructor(readonly runId: RunId) {
		super(`Run ${runId} is already completed`);
		this.name = "RunCompletedError";
	}
}

export class RunBusyError extends Error {
	constructor(readonly runId: RunId) {
		super(`Run ${runId} is already executing a step`);
		this.name = "RunBusyError";
	}
}

export class StepNotFoundError extends Error {
	constructor(
		readonly runId: RunId,
		readonly step: number,
	) {
		super(`Run ${runId} has no step ${step}`);
		this.name = "StepNotFoundError";
	}
}

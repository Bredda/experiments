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

/** A run that others were forked from cannot be deleted: their history was copied from it. */
export class RunHasForksError extends Error {
	constructor(
		readonly runId: RunId,
		readonly forks: number,
	) {
		super(
			`Run ${runId} has ${forks} ${forks === 1 ? "fork" : "forks"}: delete ${forks === 1 ? "it" : "them"} first, or archive the run instead`,
		);
		this.name = "RunHasForksError";
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

/** An intervention that cannot be applied: the experimenter asked for something impossible. */
export class InvalidInterventionError extends Error {
	constructor(reason: string) {
		super(`Invalid intervention: ${reason}`);
		this.name = "InvalidInterventionError";
	}
}

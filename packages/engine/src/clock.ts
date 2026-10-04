import type { Step, Time } from "@experiments/types";

export class SimulationClock {
	readonly start: Date;
	readonly stepSizeMs: number;
	#step: Step = 0;

	constructor(params?: { start?: Date; stepSizeMs?: number }) {
		this.start = params?.start ?? new Date(Date.UTC(2026, 0, 1));
		this.stepSizeMs = params?.stepSizeMs ?? 1000;
	}

	get now(): Time {
		return this.timeAt(this.#step);
	}

	/** Simulation time at a given step, whatever step the clock is at. */
	timeAt(step: Step): Time {
		return new Date(
			this.start.getTime() + this.stepSizeMs * step,
		).toISOString();
	}

	get step(): Step {
		return this.#step;
	}

	advance(): Time {
		this.#step += 1;
		return this.now;
	}

	/** Undoes one `advance()`, used when a step fails and must not count. */
	rewind(): void {
		this.#step = Math.max(0, this.#step - 1);
	}

	/** Positions the clock at an already-elapsed step (resuming a stored run). */
	seek(step: Step): void {
		this.#step = step;
	}

	reset(): void {
		this.#step = 0;
	}
}

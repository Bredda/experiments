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
		return new Date(
			this.start.getTime() + this.stepSizeMs * this.#step,
		).toISOString();
	}

	get step(): Step {
		return this.#step;
	}

	advance(): Time {
		this.#step += 1;
		return this.now;
	}

	reset(): void {
		this.#step = 0;
	}
}

import { SchedulerConfig, SchedulerType } from "@experiments/types/scenario";
import type { Scheduler } from "./base";
import { HighestUrgencyScheduler } from "./highestUrgency";
import { WeightedRandomScheduler } from "./weightedRandom";

export const schedulers = {
	highest_urgency: HighestUrgencyScheduler,
	weighted_random: WeightedRandomScheduler,
} satisfies Record<SchedulerType, new () => Scheduler>;

export function createScheduler(config: SchedulerConfig): Scheduler {
	const { type } = config;
	if (!Object.hasOwn(schedulers, type)) {
		throw new Error(
			`Unknown schedulers "${type}". Available: ${Object.keys(schedulers).join(", ")}`,
		);
	}
	return new schedulers[type as SchedulerType]();
}

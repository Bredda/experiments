"use client";

import type { AnyEvent } from "@experiments/types/events";
import type { Intervention } from "@experiments/types/interventions";
import type { RunRecord } from "@experiments/types/run";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { getRun, getRunEvents, stepRun } from "@/lib/api";
import { ApiError } from "@/lib/fetch";

/** Pause between two automatic steps, so each one can be followed. */
export const AUTOPLAY_DELAY_MS = 600;

/** What goes with a step: interventions to record with it, and what to do once it is recorded. */
export type StepOptions = {
	interventions?: readonly Intervention[];
	/** Called once the step, and so the interventions, were recorded; never when it failed. */
	onApplied?: () => void;
};

/**
 * Holds a run and its events on the client and advances them: one step on
 * demand, or step after step until the run completes or the user pauses.
 * Autoplay is a loop over the same `steps/next` call; pausing lets the step in
 * flight finish. Interventions travel with the first step only: if it fails
 * nothing was recorded, and the caller keeps them.
 */
export function useRunExecution(
	initialRun: RunRecord,
	initialEvents: AnyEvent[],
) {
	const [run, setRun] = useState(initialRun);
	const [events, setEvents] = useState(initialEvents);
	const [pending, setPending] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [pausing, setPausing] = useState(false);

	const playingRef = useRef(false);
	const wakeRef = useRef<(() => void) | null>(null);
	const runId = initialRun.runId;

	const stopLoop = () => {
		playingRef.current = false;
		wakeRef.current?.();
	};

	// Leaving the page must not leave a loop stepping the run in the background.
	// biome-ignore lint/correctness/useExhaustiveDependencies: stopLoop only touches refs
	useEffect(() => stopLoop, []);

	/** Runs one step: whether it was recorded, and whether the run can keep going. */
	const advance = async (
		options: StepOptions = {},
	): Promise<{ recorded: boolean; goOn: boolean }> => {
		setPending(true);
		try {
			const result = await stepRun(runId, options.interventions);
			setRun(result.run);
			setEvents((current) => {
				const known = new Set(current.map((e) => e.id));
				const added = result.events
					.map((record) => record.payload)
					.filter((e) => !known.has(e.id));
				return [...current, ...added];
			});
			options.onApplied?.();
			return { recorded: true, goOn: result.run.status !== "completed" };
		} catch (error) {
			toast.add({
				type: "error",
				description:
					error instanceof Error ? error.message : "Failed to run the step.",
			});
			// 409: the run moved on elsewhere (another tab, or already completed).
			if (error instanceof ApiError && error.status === 409) {
				try {
					const [freshRun, freshEvents] = await Promise.all([
						getRun(runId),
						getRunEvents(runId),
					]);
					setRun(freshRun);
					setEvents(freshEvents);
				} catch {
					// Keep the current view; the toast already explains the failure.
				}
			}
			return { recorded: false, goOn: false };
		} finally {
			setPending(false);
		}
	};

	/** One step, with its interventions. Resolves true when it was recorded. */
	const nextStep = async (options?: StepOptions): Promise<boolean> =>
		(await advance(options)).recorded;

	const play = async (options?: StepOptions) => {
		if (playingRef.current) return;
		playingRef.current = true;
		setPlaying(true);
		let first = options;
		try {
			while (playingRef.current) {
				const { goOn } = await advance(first);
				first = undefined;
				if (!goOn || !playingRef.current) break;
				await new Promise<void>((resolve) => {
					const timer = setTimeout(resolve, AUTOPLAY_DELAY_MS);
					wakeRef.current = () => {
						clearTimeout(timer);
						resolve();
					};
				});
			}
		} finally {
			playingRef.current = false;
			wakeRef.current = null;
			setPlaying(false);
			setPausing(false);
		}
	};

	const pause = () => {
		setPausing(true);
		stopLoop();
	};

	return {
		run,
		events,
		pending,
		playing,
		pausing,
		nextStep,
		play,
		pause,
	};
}

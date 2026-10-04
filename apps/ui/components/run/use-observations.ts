"use client";

import type { Observation } from "@experiments/types";
import { useEffect, useState } from "react";
import { getStepObservations } from "@/lib/api";

// What an agent observed at a played step never changes, so it is fetched once.
const cache = new Map<string, Observation[]>();

type State =
	| { status: "loading" }
	| { status: "ready"; observations: Observation[] }
	| { status: "error"; message: string };

/** The observations of every agent at `step`, fetched from the API. */
export function useStepObservations(runId: string, step: number): State {
	const key = `${runId}:${step}`;
	const [state, setState] = useState<{ key: string; value: State } | null>(
		null,
	);

	useEffect(() => {
		const cached = cache.get(key);
		if (cached !== undefined) return;

		let cancelled = false;
		getStepObservations(runId, step)
			.then((observations) => {
				cache.set(key, observations);
				if (!cancelled) {
					setState({ key, value: { status: "ready", observations } });
				}
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setState({
						key,
						value: {
							status: "error",
							message:
								error instanceof Error
									? error.message
									: "Failed to load the observation.",
						},
					});
				}
			});

		return () => {
			cancelled = true;
		};
	}, [key, runId, step]);

	const cached = cache.get(key);
	if (cached !== undefined) return { status: "ready", observations: cached };
	if (state?.key === key) return state.value;
	return { status: "loading" };
}

"use client";

import type { Intervention } from "@experiments/types/interventions";
import { useState } from "react";

const NONE: readonly Intervention[] = [];

/**
 * The interventions the experimenter has prepared and not sent yet. They are
 * bound to the step the view shows: a redaction target may not exist at
 * another step, so moving to another step discards them.
 */
export function useDrafts(step: number) {
	const [state, setState] = useState<{
		step: number;
		items: readonly Intervention[];
	}>({ step, items: NONE });

	// Adjusting state while rendering: the drafts belong to the step they were made at.
	if (state.step !== step) {
		setState({ step, items: NONE });
	}
	const drafts = state.step === step ? state.items : NONE;

	return {
		drafts,
		add: (intervention: Intervention) =>
			setState((current) => ({
				step,
				items: [
					...(current.step === step ? current.items : NONE),
					intervention,
				],
			})),
		remove: (index: number) =>
			setState((current) => ({
				step,
				items: (current.step === step ? current.items : NONE).filter(
					(_, i) => i !== index,
				),
			})),
		clear: () => setState({ step, items: NONE }),
	};
}

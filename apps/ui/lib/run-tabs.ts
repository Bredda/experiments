"use client";

import { useSyncExternalStore } from "react";

export type RunTab = { runId: string; name: string };

const STORAGE_KEY = "run-tabs";
const EMPTY: RunTab[] = [];

let tabs: RunTab[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function load(): RunTab[] {
	try {
		const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
		return Array.isArray(raw)
			? raw.filter(
					(t): t is RunTab =>
						typeof t?.runId === "string" && typeof t?.name === "string",
				)
			: EMPTY;
	} catch {
		return EMPTY;
	}
}

function getSnapshot() {
	if (!hydrated) {
		hydrated = true;
		tabs = load();
	}
	return tabs;
}

function update(next: RunTab[]) {
	tabs = next;
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// Storage unavailable: tabs simply won't survive a reload.
	}
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Adds the run to the open tabs, or refreshes its name if already open. */
export function openRunTab(tab: RunTab) {
	const current = getSnapshot();
	const existing = current.find((t) => t.runId === tab.runId);
	if (!existing) return update([...current, tab]);
	if (existing.name !== tab.name) {
		update(current.map((t) => (t.runId === tab.runId ? tab : t)));
	}
}

/** Updates the name of the tab of a run, if it is open. */
export function renameRunTab(runId: string, name: string) {
	const current = getSnapshot();
	if (current.some((t) => t.runId === runId && t.name !== name)) {
		update(current.map((t) => (t.runId === runId ? { ...t, name } : t)));
	}
}

export function closeRunTab(runId: string) {
	update(getSnapshot().filter((t) => t.runId !== runId));
}

export const runTabUrl = (runId: string) => `/runs/${runId}`;

/** Open run tabs, in opening order. Empty during SSR and hydration. */
export function useRunTabs() {
	return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

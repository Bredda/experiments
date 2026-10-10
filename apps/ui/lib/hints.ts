"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "seen-hints";

/** The ids stored by `serializeSeenHints`; anything else (a bad value, no value) is nothing seen. */
export function parseSeenHints(raw: string | null): Set<string> {
	try {
		const value: unknown = JSON.parse(raw ?? "[]");
		return new Set(
			Array.isArray(value)
				? value.filter((id): id is string => typeof id === "string")
				: [],
		);
	} catch {
		return new Set();
	}
}

export function serializeSeenHints(seen: ReadonlySet<string>): string {
	return JSON.stringify([...seen].sort());
}

let seen: Set<string> | undefined;
const listeners = new Set<() => void>();

function getSeen(): Set<string> {
	if (seen === undefined) {
		try {
			seen = parseSeenHints(localStorage.getItem(STORAGE_KEY));
		} catch {
			// Storage blocked: a hint is shown again on every visit.
			seen = new Set();
		}
	}
	return seen;
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Records that the user opened the hint, for good: it is kept in localStorage. */
export function markHintSeen(id: string) {
	const next = new Set(getSeen()).add(id);
	seen = next;
	try {
		localStorage.setItem(STORAGE_KEY, serializeSeenHints(next));
	} catch {
		// Storage unavailable: it only lasts until the page is reloaded.
	}
	for (const listener of listeners) listener();
}

/**
 * Whether the user already opened the hint. True during SSR and hydration, so
 * a "new" marker never flashes for someone who has seen it.
 */
export function useHintSeen(id: string): boolean {
	return useSyncExternalStore(
		subscribe,
		() => getSeen().has(id),
		() => true,
	);
}

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AnyEvent } from "@experiments/types/events";

export class EventLog implements Iterable<AnyEvent> {
	readonly #events: AnyEvent[] = [];

	append(event: AnyEvent): void {
		this.#events.push(event);
	}

	extend(events: Iterable<AnyEvent>): void {
		this.#events.push(...events);
	}

	[Symbol.iterator](): Iterator<AnyEvent> {
		return this.#events[Symbol.iterator]();
	}

	get length(): number {
		return this.#events.length;
	}

	at(index: number): AnyEvent | undefined {
		return this.#events[index];
	}

	toList(): AnyEvent[] {
		return [...this.#events];
	}

	writeJsonl(path: string): void {
		mkdirSync(dirname(path), { recursive: true });
		const contents = this.#events
			.map((event) => JSON.stringify(event))
			.join("\n");
		writeFileSync(path, contents.length > 0 ? `${contents}\n` : "", "utf-8");
	}
}

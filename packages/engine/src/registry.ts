export class Registry<TValue> {
	readonly #items = new Map<string, TValue>();

	register(key: string, value: TValue): void {
		if (this.#items.has(key)) {
			throw new Error(`Key '${key}' already exists`);
		}
		this.#items.set(key, value);
	}

	get(key: string): TValue {
		const value = this.#items.get(key);

		if (value === undefined) {
			const available = this.keys().join(", ");
			throw new Error(`Unknown key '${key}'. Available keys : ${available}`);
		}

		return value;
	}

	keys(): string[] {
		return [...this.#items.keys()];
	}
}

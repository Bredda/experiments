import type { MemoryType } from "@experiments/types";
import { Registry } from "../registry";
import type { Memory } from "./base";

export const memoryRegistry = new Registry<() => Memory>();

export function registerMemory(name: MemoryType, factory: () => Memory): void {
	memoryRegistry.register(name, factory);
}

export function getMemory(name: MemoryType): Memory {
	return memoryRegistry.get(name)();
}

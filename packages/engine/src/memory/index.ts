export { Memory, memorySliceToPrompt } from "./base";
export { getMemory, memoryRegistry, registerMemory } from "./registry";
export { SlidingWindowMemory } from "./slidingWindowMemory";

import { registerMemory } from "./registry";
import { SlidingWindowMemory } from "./slidingWindowMemory";

registerMemory("sliding_window", () => new SlidingWindowMemory());

export { Memory, memorySliceToPrompt } from "./base";
export { LAST_N, LastNMemory } from "./lastNMemory";
export { getMemory, memoryRegistry, registerMemory } from "./registry";
export { SlidingWindowMemory } from "./slidingWindowMemory";

import { LastNMemory } from "./lastNMemory";
import { registerMemory } from "./registry";
import { SlidingWindowMemory } from "./slidingWindowMemory";

registerMemory("sliding_window", () => new SlidingWindowMemory());
registerMemory("last_n", () => new LastNMemory());

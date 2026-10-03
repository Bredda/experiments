import { defineConfig } from "vitest/config";

// Only pure view logic in lib/ is tested: no DOM, no components.
export default defineConfig({
	test: {
		include: ["lib/**/*.test.ts"],
		environment: "node",
	},
});

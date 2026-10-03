import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		// @experiments/settings validates env on import; tests must not need a real key.
		env: { ANTHROPIC_API_KEY: "sk-ant-api-test" },
	},
});

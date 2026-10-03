import path from "node:path";
import type { NextConfig } from "next";

const monorepoRoot = path.join(__dirname, "..", "..");

const nextConfig: NextConfig = {
	// Self-contained server for the Docker image (.next/standalone).
	output: "standalone",
	// The workspace packages live outside apps/ui, so tracing starts at the root.
	outputFileTracingRoot: monorepoRoot,
	turbopack: {
		root: monorepoRoot,
	},
};

export default nextConfig;

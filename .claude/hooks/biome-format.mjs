// PostToolUse hook: format and lint the file Claude just edited with Biome.
// Unfixable lint errors are sent back to Claude (exit 2) so it fixes them.
import { spawnSync } from "node:child_process";

let input = "";
for await (const chunk of process.stdin) input += chunk;

const file = JSON.parse(input).tool_input?.file_path;
if (!file || !/\.(?:[cm]?[jt]sx?|json|css)$/.test(file)) process.exit(0);

const result = spawnSync(
	"pnpm",
	["exec", "biome", "check", "--write", "--no-errors-on-unmatched", file],
	{ encoding: "utf-8" },
);

if (result.status !== 0) {
	process.stderr.write(`${result.stdout}${result.stderr}`);
	process.exit(2);
}

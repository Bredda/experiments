import { Suspense } from "react";
import { RegisterRunTab } from "@/components/run/register-tab";
import { RunViewer } from "@/components/run/viewer";
import { getRun, getRunEvents } from "@/lib/api";

export default async function RunPage({
	params,
}: {
	params: Promise<{ runId: string }>;
}) {
	const { runId } = await params;
	const run = await getRun(runId);
	const events = await getRunEvents(runId);

	return (
		<div className="h-[calc(100svh-var(--header-height))] overflow-hidden">
			<RegisterRunTab runId={runId} name={run.name} />
			<Suspense fallback={<div>loading...</div>}>
				{/* Keyed by run: switching run tabs must not reuse the previous run's state. */}
				<RunViewer key={runId} run={run} events={events} />
			</Suspense>
		</div>
	);
}

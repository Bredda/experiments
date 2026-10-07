import { notFound } from "next/navigation";
import { ForkForm } from "@/components/fork/fork-form";
import { Page, PageHeader } from "@/components/page";
import { getForkTree } from "@/lib/api";
import { ApiError } from "@/lib/fetch";
import { suggestForkName } from "@/lib/fork-tree";

export default async function ForkRunPage({
	params,
	searchParams,
}: {
	params: Promise<{ runId: string }>;
	searchParams: Promise<{ step?: string }>;
}) {
	const { runId } = await params;
	const { step: stepParam } = await searchParams;

	const tree = await getForkTree(runId).catch((error: unknown) => {
		// 400 is a malformed id, 404 an unknown run.
		if (error instanceof ApiError && [400, 404].includes(error.status)) {
			notFound();
		}
		throw error;
	});
	const origin = tree.nodes.find((node) => node.runId === runId);
	if (origin === undefined) notFound();

	const step = stepParam === undefined ? origin.playedSteps : Number(stepParam);
	if (!Number.isInteger(step) || step < 0 || step > origin.playedSteps) {
		notFound();
	}

	return (
		<Page>
			<PageHeader
				title="Fork run"
				description={`Start a new run from "${origin.name}" as it was at step ${step}. It keeps the same scenario and seed and carries on from there.`}
			/>
			<ForkForm
				runId={runId}
				step={step}
				defaultName={suggestForkName(origin, tree.nodes)}
			/>
		</Page>
	);
}

import { Page, PageHeader } from "@/components/page";
import { RunList } from "@/components/runs/run-list";
import { getRuns } from "@/lib/api";

export default async function RunsPage() {
	const runs = await getRuns();

	return (
		// Fills the viewport under the site header so only the list scrolls.
		<Page className="flex h-[calc(100svh-var(--header-height))] flex-col overflow-hidden pb-4 sm:pb-8">
			<PageHeader
				title="Runs"
				description="Browse, search and open past and ongoing runs."
			/>
			<RunList runs={runs} />
		</Page>
	);
}

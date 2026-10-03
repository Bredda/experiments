import { ArrowRight } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import React, { Suspense } from "react";
import { NewRun } from "@/components/new-run";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemSeparator,
	ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getRuns } from "@/lib/api";

export default async function Home() {
	const runs = await getRuns();
	if (!runs) {
		return <div>Error fetching runs</div>;
	}
	console.log(runs);
	return (
		<div className="h-screen overflow-hidden p-8">
			<div className="mx-auto flex w-md items-center justify-between">
				<span className="text-center">Runs</span>
				<NewRun />
			</div>

			<Suspense fallback={<div>loading...</div>}>
				<div className="mx-auto max-w-md p-3">
					<ScrollArea className="h-full">
						{runs.map((r) => (
							<React.Fragment key={r.runId}>
								<Item
									key={r.runId}
									render={
										<Link href={`/run/${r.runId}`}>
											<ItemContent>
												<ItemTitle>{r.scenario.name}</ItemTitle>
												<ItemDescription>
													<span>Run: {r.runId}</span>
												</ItemDescription>
											</ItemContent>
											<ItemActions>
												<HugeiconsIcon icon={ArrowRight} className="size-4" />
											</ItemActions>
										</Link>
									}
								/>
								<ItemSeparator />
							</React.Fragment>
						))}
					</ScrollArea>
				</div>
			</Suspense>
		</div>
	);
}

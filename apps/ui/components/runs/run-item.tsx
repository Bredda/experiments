import type { RunRecord } from "@experiments/types/run";
import {
	ArrowRight01Icon,
	Calendar03Icon,
	FootprintsIcon,
	UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import type * as React from "react";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemFooter,
} from "@/components/ui/item";
import { RunStatusBadge } from "./status-badge";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
	dateStyle: "medium",
	timeStyle: "short",
});

function Meta({
	icon,
	children,
}: {
	icon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
	children: React.ReactNode;
}) {
	return (
		<span className="flex items-center gap-1">
			<HugeiconsIcon icon={icon} className="size-3.5" />
			{children}
		</span>
	);
}

export function RunItem({ run }: { run: RunRecord }) {
	const { agents, steps } = run.scenario;

	return (
		<Item
			variant="outline"
			render={<Link href={`/runs/${run.runId}`} />}
			className="gap-y-2"
		>
			<ItemContent className="min-w-0">
				<div className="flex min-w-0 items-center gap-2 font-medium leading-snug">
					<span className="truncate">{run.name}</span>
					<RunStatusBadge status={run.status} />
				</div>
				<ItemDescription className="truncate font-mono">
					{run.runId}
				</ItemDescription>
			</ItemContent>
			<ItemActions>
				<HugeiconsIcon
					icon={ArrowRight01Icon}
					className="size-4 text-muted-foreground"
				/>
			</ItemActions>
			<ItemFooter className="flex-wrap justify-start gap-x-4 gap-y-1 text-muted-foreground">
				<Meta icon={UserIcon}>
					{agents.length} {agents.length === 1 ? "agent" : "agents"}
				</Meta>
				<Meta icon={FootprintsIcon}>{steps} steps</Meta>
				<span className="font-mono">#{run.seed}</span>
				<span suppressHydrationWarning className="ml-auto">
					<Meta icon={Calendar03Icon}>
						{dateFormat.format(new Date(run.createdAt))}
					</Meta>
				</span>
			</ItemFooter>
		</Item>
	);
}

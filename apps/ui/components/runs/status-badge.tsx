import type { RunStatus } from "@experiments/types/run";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";

export const STATUS_LABELS: Record<RunStatus, string> = {
	created: "Created",
	running: "Running",
	completed: "Completed",
};

const STATUS_VARIANTS: Record<
	RunStatus,
	React.ComponentProps<typeof Badge>["variant"]
> = {
	created: "outline",
	running: "default",
	completed: "secondary",
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
	return (
		<Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
	);
}

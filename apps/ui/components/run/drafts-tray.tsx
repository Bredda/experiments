"use client";

import { Cancel01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InterventionTarget } from "@/lib/run-view";

/**
 * The interventions prepared and not sent yet, next to the buttons that send
 * them: Next step and Play record them with the step, the Fork button applies
 * them in a fork. Nothing is shown when there are none.
 */
export function DraftsTray({
	labels,
	target,
	onRemove,
	onClear,
}: {
	labels: string[];
	target: InterventionTarget;
	onRemove: (index: number) => void;
	onClear: () => void;
}) {
	if (labels.length === 0) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="secondary"
						size="sm"
						aria-label="Pending interventions"
					/>
				}
			>
				<Badge variant="outline">{labels.length}</Badge>
				pending
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="whitespace-normal">
						{target.mode === "queue"
							? `Recorded with the next step; they take effect at step ${target.appliesAt}. Fork applies them in a new run instead.`
							: `They take effect at step ${target.appliesAt} in a fork made at step ${target.step}: use Fork.`}
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				{labels.map((label, index) => (
					<DropdownMenuItem
						// biome-ignore lint/suspicious/noArrayIndexKey: drafts have no id and are removed by position
						key={`${index}-${label}`}
						onClick={() => onRemove(index)}
						className="items-start"
					>
						<span className="min-w-0 flex-1 whitespace-normal break-words">
							{label}
						</span>
						<HugeiconsIcon
							icon={Cancel01Icon}
							aria-label="Remove"
							className="mt-0.5"
						/>
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={onClear} variant="destructive">
					<HugeiconsIcon icon={Delete02Icon} />
					Clear all
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

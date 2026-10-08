import type { ComponentProps, ReactElement, ReactNode } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * A tooltip on a clickable element, which says what a click does. It opens on
 * hover and on keyboard focus, after a short delay so that moving across the
 * page does not flash one tooltip after another.
 */
export function Hint({
	label,
	side,
	children,
}: {
	label: ReactNode;
	side?: ComponentProps<typeof TooltipContent>["side"];
	/** The element that gets the tooltip; it must accept a ref and DOM props. */
	children: ReactElement;
}) {
	return (
		<Tooltip>
			<TooltipTrigger delay={400} render={children} />
			<TooltipContent side={side}>{label}</TooltipContent>
		</Tooltip>
	);
}

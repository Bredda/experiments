import type * as React from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/** Centered page column: full width below `lg`, half of the content area above. */
export function Page({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"mx-auto w-full max-w-2xl p-4 sm:p-8 lg:w-1/2 lg:min-w-lg",
				className,
			)}
			{...props}
		/>
	);
}

export function PageHeader({
	title,
	description,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	title: React.ReactNode;
	description?: React.ReactNode;
}) {
	return (
		<div className={cn("mb-6", className)} {...props}>
			<h1 className="font-medium text-lg">{title}</h1>
			{description && (
				<p className="text-muted-foreground text-sm">{description}</p>
			)}
			<Separator className="mt-3 data-horizontal:w-12" />
		</div>
	);
}

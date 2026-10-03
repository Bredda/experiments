"use client";

import {
	Cancel01Icon,
	DashboardSquare01Icon,
	ListViewIcon,
	PlayIcon,
	PlusIcon,
	TestTube01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	closeRunTab,
	type RunTab,
	runTabUrl,
	useRunTabs,
} from "@/lib/run-tabs";
import { Separator } from "./ui/separator";

const ALL_RUNS_URL = "/runs";

const NAV_ITEMS = [
	{ title: "Dashboard", url: "/", icon: DashboardSquare01Icon },
	{ title: "New run", url: "/create-run", icon: PlusIcon },
	{ title: "All runs", url: ALL_RUNS_URL, icon: ListViewIcon },
];

const RUN_PATH = /^\/runs\/[^/]+/;

function activeUrl(pathname: string) {
	// A run page owns its tab even before the tab has been registered.
	const runPath = RUN_PATH.exec(pathname)?.[0];
	if (runPath) return runPath;
	return (
		NAV_ITEMS.find((item) =>
			item.url === "/" ? pathname === "/" : pathname.startsWith(item.url),
		)?.url ?? null
	);
}

export function SiteHeader() {
	const pathname = usePathname();
	const router = useRouter();
	const runTabs = useRunTabs();
	const active = activeUrl(pathname);

	// Keep the active tab visible when many run tabs overflow the header.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the active tab or the tab list changes
	useEffect(() => {
		document
			.querySelector("[data-slot=tabs-trigger][data-active]")
			?.scrollIntoView({ inline: "nearest", block: "nearest" });
	}, [active, runTabs.length]);

	const handleClose = (tab: RunTab) => {
		const remaining = runTabs.filter((t) => t.runId !== tab.runId);
		closeRunTab(tab.runId);
		// Only leave the page if its own tab was closed: go to the last tab.
		if (active === runTabUrl(tab.runId)) {
			const last = remaining.at(-1);
			router.replace(last ? runTabUrl(last.runId) : ALL_RUNS_URL);
		}
	};

	return (
		<header className="sticky top-0 z-50 flex h-(--header-height) w-full items-center gap-4 border-b bg-background px-4">
			<Link href="/" className="flex items-center gap-2 font-medium text-sm">
				<span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
					<HugeiconsIcon
						icon={TestTube01Icon}
						strokeWidth={2}
						className="size-4"
					/>
				</span>
				<span className="hidden sm:inline">Experiments.ai</span>
			</Link>
			<Separator orientation="vertical" />
			<Tabs
				value={active}
				className="h-full min-w-0 overflow-x-auto [scrollbar-width:none]"
			>
				<TabsList
					variant="line"
					aria-label="Main navigation"
					className="h-full p-0 group-data-horizontal/tabs:h-full"
				>
					{NAV_ITEMS.map((item) => (
						<TabsTrigger
							key={item.url}
							value={item.url}
							nativeButton={false}
							render={<Link href={item.url} />}
							className="h-full px-3 group-data-horizontal/tabs:after:bottom-0"
						>
							<HugeiconsIcon icon={item.icon} strokeWidth={2} />
							<span className="max-[359px]:sr-only">{item.title}</span>
						</TabsTrigger>
					))}
					{runTabs.map((tab) => {
						const url = runTabUrl(tab.runId);
						return (
							<div
								key={tab.runId}
								className="relative flex h-full shrink-0 items-center"
							>
								<TabsTrigger
									value={url}
									nativeButton={false}
									render={<Link href={url} />}
									className="h-full max-w-48 pr-8 pl-3 group-data-horizontal/tabs:after:bottom-0"
								>
									<HugeiconsIcon icon={PlayIcon} strokeWidth={2} />
									<span className="truncate">{tab.name}</span>
								</TabsTrigger>
								<button
									type="button"
									aria-label={`Close ${tab.name}`}
									onClick={() => handleClose(tab)}
									className="absolute right-1.5 flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
								>
									<HugeiconsIcon icon={Cancel01Icon} className="size-3" />
								</button>
							</div>
						);
					})}
				</TabsList>
			</Tabs>
		</header>
	);
}

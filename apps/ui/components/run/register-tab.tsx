"use client";

import { useEffect } from "react";
import { openRunTab } from "@/lib/run-tabs";

/** Renders nothing: opens a header tab for this run while the page is mounted. */
export function RegisterRunTab({
	runId,
	name,
}: {
	runId: string;
	name: string;
}) {
	useEffect(() => {
		openRunTab({ runId, name });
	}, [runId, name]);

	return null;
}

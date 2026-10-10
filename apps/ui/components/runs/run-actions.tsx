"use client";

import type { RunRecord } from "@experiments/types/run";
import {
	Archive01Icon,
	Delete02Icon,
	Edit02Icon,
	MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { deleteRun, updateRun } from "@/lib/api";
import { closeRunTab, renameRunTab } from "@/lib/run-tabs";

type Dialogs = "edit" | "delete" | null;

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

/**
 * The menu of a run in the list: rename and annotate, archive, delete. A run
 * with forks cannot be deleted (the api refuses it): the menu says so and
 * leaves archiving as the way to get it out of the way.
 */
export function RunActions({
	run,
	forks,
}: {
	run: RunRecord;
	/** How many runs were forked directly from this one. */
	forks: number;
}) {
	const router = useRouter();
	const [dialog, setDialog] = useState<Dialogs>(null);
	const [name, setName] = useState(run.name);
	const [notes, setNotes] = useState(run.notes);
	const [busy, setBusy] = useState(false);

	const attempt = async (
		action: () => Promise<void>,
		failure: string,
	): Promise<boolean> => {
		setBusy(true);
		try {
			await action();
			router.refresh();
			return true;
		} catch (error) {
			toast.add({ type: "error", description: errorMessage(error, failure) });
			return false;
		} finally {
			setBusy(false);
		}
	};

	const save = async () => {
		const saved = await attempt(async () => {
			const updated = await updateRun(run.runId, {
				name: name.trim(),
				notes: notes.trim(),
			});
			renameRunTab(run.runId, updated.name);
		}, "Failed to update the run.");
		if (saved) setDialog(null);
	};

	const toggleArchive = () =>
		attempt(async () => {
			await updateRun(run.runId, { archived: !run.archived });
			toast.add({
				type: "success",
				description: run.archived
					? `Run "${run.name}" is back in the list.`
					: `Run "${run.name}" archived: it is hidden from the list unless you show archived runs.`,
			});
		}, "Failed to update the run.");

	const remove = async () => {
		const deleted = await attempt(async () => {
			await deleteRun(run.runId);
			closeRunTab(run.runId);
			toast.add({ type: "success", description: `Run "${run.name}" deleted.` });
		}, "Failed to delete the run.");
		if (deleted) setDialog(null);
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={`Actions for ${run.name}`}
						/>
					}
				>
					<HugeiconsIcon icon={MoreHorizontalIcon} />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuItem
						onClick={() => {
							setName(run.name);
							setNotes(run.notes);
							setDialog("edit");
						}}
					>
						<HugeiconsIcon icon={Edit02Icon} />
						Rename and add notes…
					</DropdownMenuItem>
					<DropdownMenuItem onClick={toggleArchive}>
						<HugeiconsIcon icon={Archive01Icon} />
						{run.archived ? "Unarchive" : "Archive"}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						disabled={forks > 0}
						onClick={() => setDialog("delete")}
						className="items-start"
					>
						<HugeiconsIcon icon={Delete02Icon} className="mt-0.5" />
						<span className="flex flex-col">
							Delete…
							{forks > 0 && (
								<span className="whitespace-normal text-muted-foreground">
									Has {forks} {forks === 1 ? "fork" : "forks"}: delete{" "}
									{forks === 1 ? "it" : "them"} first, or archive this run
								</span>
							)}
						</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog
				open={dialog === "edit"}
				onOpenChange={(open) => !open && setDialog(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Rename and add notes</DialogTitle>
						<DialogDescription>
							Notes say what the run is for. Neither changes the simulation.
						</DialogDescription>
					</DialogHeader>
					<form
						className="grid gap-3"
						onSubmit={(event) => {
							event.preventDefault();
							void save();
						}}
					>
						<Field>
							<FieldLabel htmlFor={`name-${run.runId}`}>Name</FieldLabel>
							<Input
								id={`name-${run.runId}`}
								value={name}
								maxLength={120}
								onChange={(event) => setName(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={`notes-${run.runId}`}>Notes</FieldLabel>
							<Textarea
								id={`notes-${run.runId}`}
								value={notes}
								maxLength={2000}
								placeholder="What was this run for?"
								onChange={(event) => setNotes(event.target.value)}
							/>
						</Field>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setDialog(null)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={busy || name.trim() === ""}>
								Save
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog
				open={dialog === "delete"}
				onOpenChange={(open) => !open && setDialog(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete "{run.name}"?</DialogTitle>
						<DialogDescription>
							The run and all its events are deleted for good. This cannot be
							undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDialog(null)}>
							Cancel
						</Button>
						<Button variant="destructive" disabled={busy} onClick={remove}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

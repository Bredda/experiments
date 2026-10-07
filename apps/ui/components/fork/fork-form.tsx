"use client";

import { forkRunRequestSchema } from "@experiments/types/run";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import z from "zod";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { forkRun } from "@/lib/api";

const forkFormSchema = z.object({
	name: forkRunRequestSchema.shape.name,
	purpose: z.string().trim().max(500),
});

export function ForkForm({
	runId,
	step,
	defaultName,
}: {
	runId: string;
	step: number;
	defaultName: string;
}) {
	const router = useRouter();

	const form = useForm({
		defaultValues: { name: defaultName, purpose: "" },
		validators: { onSubmit: forkFormSchema },
		onSubmit: async ({ value }) => {
			try {
				const run = await forkRun(runId, { step, ...value });
				toast.add({
					type: "success",
					description: `Run "${run.name}" has been forked at step ${step}.`,
				});
				router.push(`/runs/${run.runId}`);
			} catch (error) {
				toast.add({
					type: "error",
					description:
						error instanceof Error ? error.message : "Failed to fork the run.",
				});
			}
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<FieldGroup className="gap-4">
				<form.Field name="name">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Name</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>
				<form.Field name="purpose">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Purpose (optional)</FieldLabel>
								<Textarea
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
									placeholder="What are you trying out with this fork?"
								/>
								<FieldDescription>
									Shown next to the fork in the fork tree.
								</FieldDescription>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>
			</FieldGroup>

			<div className="mt-6 flex justify-end">
				<form.Subscribe selector={(state) => state.isSubmitting}>
					{(isSubmitting) => (
						<Button type="submit" disabled={isSubmitting}>
							Fork at step {step}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}

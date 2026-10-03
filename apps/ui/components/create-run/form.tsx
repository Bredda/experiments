"use client";

import type {
	AgentConfig,
	ScenarioConfig,
	SchedulerType,
} from "@experiments/types/scenario";
import {
	scenarioConfigSchema,
	schedulerTypeSchema,
} from "@experiments/types/scenario";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { createRun } from "@/lib/api";
import { AgentCard } from "./agent-card";
import { AddAgentDialog } from "./agent-dialog";
import {
	type Agent,
	MAX_AGENTS,
	type RunFormValues,
	runFormSchema,
	SCHEDULER_LABELS,
} from "./schemas";

function toScenarioConfig(value: RunFormValues): ScenarioConfig {
	const agents: AgentConfig[] = value.agents.map((agent) => ({
		id: agent.name,
		behavior: agent.behavior,
		memory: agent.memory,
	}));

	return scenarioConfigSchema.parse({
		name: value.name,
		seed: value.seed,
		agents,
		rooms: [{ id: "main", members: agents.map((agent) => agent.id) }],
		scheduler: { type: value.scheduler },
		steps: value.steps,
	});
}

export function CreateRunForm({
	defaultName,
	defaultSeed,
}: {
	defaultName: string;
	defaultSeed: string;
}) {
	const router = useRouter();

	const form = useForm({
		defaultValues: {
			name: defaultName,
			seed: defaultSeed,
			agents: [] as Agent[],
			scheduler: "highest_urgency" as SchedulerType,
			steps: 10,
		},
		validators: {
			onSubmit: runFormSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const run = await createRun(toScenarioConfig(value));
				toast.add({
					type: "success",
					description: `Run "${run.name}" has been created.`,
				});
				router.push(`/runs/${run.runId}`);
			} catch (error) {
				toast.add({
					type: "error",
					description:
						error instanceof Error ? error.message : "Failed to create run.",
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
				<div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
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
					<form.Field name="seed">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Seed</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
									<FieldDescription>
										Seed must be strictly alphanumerical: 0-9, A-Z
									</FieldDescription>
								</Field>
							);
						}}
					</form.Field>
				</div>

				<div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
					<form.Field name="scheduler">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldContent>
										<FieldLabel htmlFor="form-scheduler">Scheduler</FieldLabel>
										<Select
											items={SCHEDULER_LABELS}
											name={field.name}
											value={field.state.value}
											onValueChange={(value) =>
												field.handleChange(value as SchedulerType)
											}
										>
											<SelectTrigger
												id="form-scheduler"
												aria-invalid={isInvalid}
												className="w-full"
											>
												<SelectValue placeholder="Select" />
											</SelectTrigger>
											<SelectContent>
												{schedulerTypeSchema.options.map((type) => (
													<SelectItem key={type} value={type}>
														{SCHEDULER_LABELS[type]}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</FieldContent>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
					<form.Field name="steps">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Steps</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(Number(e.target.value))}
										aria-invalid={isInvalid}
										type="number"
										min={0}
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</div>

				<form.Field name="agents" mode="array">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						const agents = field.state.value;
						return (
							<FieldSet className="gap-4" data-invalid={isInvalid}>
								<FieldLegend variant="label">Agents</FieldLegend>
								<FieldDescription>
									Add up to {MAX_AGENTS} agents to the experiment.
								</FieldDescription>
								{agents.length > 0 && (
									<div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
										{agents.map((agent, index) => (
											<AgentCard
												key={agent.name}
												agent={agent}
												onRemove={() => field.removeValue(index)}
											/>
										))}
									</div>
								)}
								<div>
									<AddAgentDialog
										existingNames={agents.map((agent) => agent.name)}
										disabled={agents.length >= MAX_AGENTS}
										onAdd={(agent) => field.pushValue(agent)}
									/>
								</div>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</FieldSet>
						);
					}}
				</form.Field>
			</FieldGroup>

			<div className="mt-6 flex justify-end gap-2">
				<Button type="button" variant="secondary" onClick={() => router.back()}>
					Cancel
				</Button>
				<form.Subscribe selector={(state) => state.isSubmitting}>
					{(isSubmitting) => (
						<Button type="submit" disabled={isSubmitting}>
							Create
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}

"use client";

import {
	MEMORY_KINDS,
	type MemoryType,
	memoryTypeSchema,
} from "@experiments/types";
import {
	AGENT_BEHAVIORS,
	type AgentBehavior,
	type AgentConfig,
	agentBehaviorSchema,
	type ScenarioConfig,
	type SchedulerType,
	scenarioConfigSchema,
	schedulerTypeSchema,
	seedSchema,
} from "@experiments/types/scenario";
import { PlusIcon, Trash } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import z from "zod";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { createRun } from "@/lib/api";
import {
	generateRandomName,
	generateRandomTitle,
	generateSeed,
} from "@/lib/utils";
import { Button } from "./ui/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "./ui/field";
import { Input } from "./ui/input";
import { InputGroup, InputGroupInput } from "./ui/input-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { toast } from "./ui/toast";

const agentSchema = z.object({
	key: z.string(),
	name: z.string().min(1, "Required"),
	behavior: agentBehaviorSchema,
	memory: memoryTypeSchema,
});
type Agent = z.infer<typeof agentSchema>;
const formSchema = z.object({
	name: z.string().min(1, "Required"),
	seed: seedSchema,
	agents: z.array(agentSchema).min(1),
	scheduler: schedulerTypeSchema,
	steps: z.number().int().gte(0),
});
type FormValues = z.infer<typeof formSchema>;

const generateNewAgent = (excludeNames: string[] = []) => ({
	key: crypto.randomUUID(),
	name: generateRandomName(excludeNames),
	behavior: AGENT_BEHAVIORS[0],
	memory: MEMORY_KINDS[0],
});

const MEMORY_DETAILS: Record<
	MemoryType,
	{ label: string; description: string }
> = {
	sliding_window: {
		label: "Sliding Window",
		description:
			"Poll a fixed list of sources and surface the items that match.",
	},
};

const SCHEDULER_DETAILS: Record<SchedulerType, { label: string }> = {
	highest_urgency: { label: "Highest urgency" },
	weighted_random: { label: "Weighted random" },
};

const BEHAVIOR_DETAILS: Record<AgentBehavior, { label: string }> = {
	mentioned: { label: "Mentioned" },
	silent: { label: "Silent" },
};

function toScenarioConfig(value: FormValues): ScenarioConfig {
	const agents: AgentConfig[] = value.agents.map((agent: Agent) => ({
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

export function NewRun() {
	const router = useRouter();
	const [open, setOpen] = useState(false);

	const form = useForm({
		defaultValues: {
			name: generateRandomTitle(),
			seed: generateSeed(),
			agents: [generateNewAgent()] as Agent[],
			scheduler: "highest_urgency" as SchedulerType,
			steps: 10,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const run = await createRun(toScenarioConfig(value));
				toast.add({
					type: "success",
					description: `Run "${run.name}" has been created.`,
				});
				setOpen(false);
				form.reset();
				router.refresh();
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
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={
					<Button>
						<HugeiconsIcon icon={PlusIcon} />
						New run{" "}
					</Button>
				}
			></DialogTrigger>
			<DialogContent className="max-w-lg min-w-lg">
				<DialogHeader>
					<DialogTitle>New run</DialogTitle>
					<DialogDescription>
						Configure a scenario and create a new run.
					</DialogDescription>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
					>
						<FieldGroup className="gap-4">
							<div className="flex space-x-2">
								<form.Field
									name="name"
									children={(field) => {
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
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</Field>
										);
									}}
								/>
								<form.Field
									name="seed"
									children={(field) => {
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
													type="string"
												/>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
												<FieldDescription>
													Seed must be strictly alphanumerical: 0-9, A-Z
												</FieldDescription>
											</Field>
										);
									}}
								/>
							</div>

							<div className="flex space-x-2">
								<form.Field
									name="scheduler"
									children={(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<Field data-invalid={isInvalid}>
												<FieldContent>
													<FieldLabel htmlFor="form-scheduler">
														Scheduler
													</FieldLabel>
													<Select
														name={field.name}
														value={field.state.value}
														onValueChange={(value) =>
															field.handleChange(value as SchedulerType)
														}
													>
														<SelectTrigger
															id="form-scheduler"
															aria-invalid={isInvalid}
															className="min-w-[160px]"
														>
															<SelectValue placeholder="Select" />
														</SelectTrigger>
														<SelectContent>
															{schedulerTypeSchema.options.map((type) => (
																<SelectItem key={type} value={type}>
																	{SCHEDULER_DETAILS[type].label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</FieldContent>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</Field>
										);
									}}
								/>
								<form.Field
									name="steps"
									children={(field) => {
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
													onChange={(e) =>
														field.handleChange(Number(e.target.value))
													}
													aria-invalid={isInvalid}
													type="number"
													min={0}
												/>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</Field>
										);
									}}
								/>
							</div>

							<form.Field
								name="agents"
								mode="array"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<FieldSet className="gap-4">
											<FieldLegend variant="label">Agents</FieldLegend>
											<FieldDescription>
												Add up to 5 agents to the experiments.
											</FieldDescription>
											<FieldGroup className="gap-4">
												{field.state.value.map(
													(agent: Agent, index: number) => (
														<div key={agent.key} className="flex space-x-2">
															<form.Field
																name={`agents[${index}].name`}
																children={(subField) => {
																	const isSubFieldInvalid =
																		subField.state.meta.isTouched &&
																		!subField.state.meta.isValid;
																	return (
																		<Field
																			orientation="horizontal"
																			data-invalid={isSubFieldInvalid}
																		>
																			<FieldContent>
																				<FieldLabel
																					htmlFor={`array-agent-${index}-name`}
																				>
																					Name
																				</FieldLabel>
																				<InputGroup>
																					<InputGroupInput
																						id={`array-agent-${index}-name`}
																						name={subField.name}
																						value={subField.state.value}
																						onBlur={subField.handleBlur}
																						onChange={(e) =>
																							subField.handleChange(
																								e.target.value,
																							)
																						}
																						aria-invalid={isSubFieldInvalid}
																						placeholder="Name"
																						type="text"
																					/>
																				</InputGroup>
																				{isSubFieldInvalid && (
																					<FieldError
																						errors={subField.state.meta.errors}
																					/>
																				)}
																			</FieldContent>
																		</Field>
																	);
																}}
															/>
															<form.Field
																name={`agents[${index}].behavior`}
																children={(subField) => {
																	const isSubFieldInvalid =
																		subField.state.meta.isTouched &&
																		!subField.state.meta.isValid;
																	return (
																		<Field
																			orientation="horizontal"
																			data-invalid={isSubFieldInvalid}
																		>
																			<FieldContent>
																				<FieldLabel
																					htmlFor={`array-agent-${index}-behavior`}
																				>
																					Behavior
																				</FieldLabel>
																				<Select
																					name={subField.name}
																					value={subField.state.value}
																					onValueChange={(value) =>
																						subField.handleChange(
																							value as AgentBehavior,
																						)
																					}
																				>
																					<SelectTrigger
																						id={`array-agent-${index}-behavior`}
																						aria-invalid={isSubFieldInvalid}
																						className="min-w-[160px]"
																					>
																						<SelectValue placeholder="Select" />
																					</SelectTrigger>
																					<SelectContent>
																						{AGENT_BEHAVIORS.map((behavior) => (
																							<SelectItem
																								key={behavior}
																								value={behavior}
																							>
																								{
																									BEHAVIOR_DETAILS[behavior]
																										.label
																								}
																							</SelectItem>
																						))}
																					</SelectContent>
																				</Select>
																				{isSubFieldInvalid && (
																					<FieldError
																						errors={subField.state.meta.errors}
																					/>
																				)}
																			</FieldContent>
																		</Field>
																	);
																}}
															/>
															<form.Field
																name={`agents[${index}].memory`}
																children={(subField) => {
																	const isSubFieldInvalid =
																		subField.state.meta.isTouched &&
																		!subField.state.meta.isValid;
																	return (
																		<Field
																			orientation="horizontal"
																			data-invalid={isSubFieldInvalid}
																		>
																			<FieldContent>
																				<FieldLabel
																					htmlFor={`array-agent-${index}-memory`}
																				>
																					Memory
																				</FieldLabel>
																				<Select
																					name={subField.name}
																					value={subField.state.value}
																					onValueChange={(value) =>
																						subField.handleChange(
																							value as MemoryType,
																						)
																					}
																				>
																					<SelectTrigger
																						id={`array-agent-${index}-memory`}
																						aria-invalid={isSubFieldInvalid}
																						className="min-w-[160px]"
																					>
																						<SelectValue placeholder="Select" />
																					</SelectTrigger>
																					<SelectContent>
																						{MEMORY_KINDS.map((kind) => (
																							<SelectItem
																								key={kind}
																								value={kind}
																							>
																								{MEMORY_DETAILS[kind].label}
																							</SelectItem>
																						))}
																					</SelectContent>
																				</Select>
																				{isSubFieldInvalid && (
																					<FieldError
																						errors={subField.state.meta.errors}
																					/>
																				)}
																			</FieldContent>
																		</Field>
																	);
																}}
															/>
															{field.state.value.length > 1 && (
																<Button
																	type="button"
																	className="self-end"
																	variant="destructive"
																	onClick={() => field.removeValue(index)}
																	aria-label={`Remove agent ${index + 1}`}
																>
																	<HugeiconsIcon icon={Trash} />
																</Button>
															)}
														</div>
													),
												)}
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() =>
														field.pushValue(
															generateNewAgent(
																field.state.value.map(
																	(agent: Agent) => agent.name,
																),
															),
														)
													}
													disabled={field.state.value.length >= 5}
												>
													Add agent
												</Button>
											</FieldGroup>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</FieldSet>
									);
								}}
							/>
						</FieldGroup>
						<DialogFooter>
							<DialogClose
								render={
									<Button type="button" variant="secondary">
										Cancel
									</Button>
								}
							/>
							<form.Subscribe
								selector={(state) => [state.isSubmitting]}
								children={([isSubmitting]) => (
									<Button type="submit" disabled={isSubmitting}>
										Create
									</Button>
								)}
							/>
						</DialogFooter>
					</form>
				</DialogHeader>
			</DialogContent>
		</Dialog>
	);
}

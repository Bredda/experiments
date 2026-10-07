"use client";

import { MEMORY_KINDS, type MemoryType } from "@experiments/types";
import {
	AGENT_BEHAVIORS,
	AGENT_MODELS,
	type AgentBehavior,
	type AgentModel,
} from "@experiments/types/scenario";
import { PlusIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { generateRandomName } from "@/lib/utils";
import type { Agent } from "./schemas";
import {
	BEHAVIOR_LABELS,
	MEMORY_LABELS,
	MODEL_LABELS,
	makeAgentSchema,
	newAgentDefaults,
} from "./schemas";

function AgentForm({
	existingNames,
	onSubmit,
}: {
	existingNames: string[];
	onSubmit: (agent: Agent) => void;
}) {
	const form = useForm({
		defaultValues: newAgentDefaults(generateRandomName(existingNames)),
		validators: {
			onSubmit: makeAgentSchema(existingNames),
		},
		onSubmit: ({ value }) => onSubmit({ ...value, name: value.name.trim() }),
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				// The dialog is portaled, but React still bubbles submit events up to
				// the run form that contains the trigger.
				e.stopPropagation();
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
								<FieldLabel htmlFor="agent-name">Name</FieldLabel>
								<Input
									id="agent-name"
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

				<form.Field name="behavior">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor="agent-behavior">Behavior</FieldLabel>
								<Select
									items={BEHAVIOR_LABELS}
									name={field.name}
									value={field.state.value}
									onValueChange={(value) =>
										field.handleChange(value as AgentBehavior)
									}
								>
									<SelectTrigger
										id="agent-behavior"
										aria-invalid={isInvalid}
										className="w-full"
									>
										<SelectValue placeholder="Select" />
									</SelectTrigger>
									<SelectContent>
										{AGENT_BEHAVIORS.map((behavior) => (
											<SelectItem key={behavior} value={behavior}>
												{BEHAVIOR_LABELS[behavior]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="memory">
					{(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor="agent-memory">Memory</FieldLabel>
								<Select
									items={MEMORY_LABELS}
									name={field.name}
									value={field.state.value}
									onValueChange={(value) =>
										field.handleChange(value as MemoryType)
									}
								>
									<SelectTrigger
										id="agent-memory"
										aria-invalid={isInvalid}
										className="w-full"
									>
										<SelectValue placeholder="Select" />
									</SelectTrigger>
									<SelectContent>
										{MEMORY_KINDS.map((kind) => (
											<SelectItem key={kind} value={kind}>
												{MEMORY_LABELS[kind]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				</form.Field>

				{/* Instructions and model are read by the llm behavior only. */}
				<form.Subscribe selector={(state) => state.values.behavior}>
					{(behavior) =>
						behavior === "llm" && (
							<>
								<form.Field name="model">
									{(field) => (
										<Field>
											<FieldLabel htmlFor="agent-model">Model</FieldLabel>
											<Select
												items={MODEL_LABELS}
												name={field.name}
												value={field.state.value}
												onValueChange={(value) =>
													field.handleChange(value as AgentModel)
												}
											>
												<SelectTrigger id="agent-model" className="w-full">
													<SelectValue placeholder="Select" />
												</SelectTrigger>
												<SelectContent>
													{AGENT_MODELS.map((model) => (
														<SelectItem key={model} value={model}>
															{MODEL_LABELS[model]}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</Field>
									)}
								</form.Field>

								<form.Field name="persona">
									{(field) => (
										<Field>
											<FieldLabel htmlFor="agent-persona">
												Persona (optional)
											</FieldLabel>
											<Textarea
												id="agent-persona"
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="You are a terse engineer who prefers to ask questions."
											/>
										</Field>
									)}
								</form.Field>
							</>
						)
					}
				</form.Subscribe>
			</FieldGroup>

			<DialogFooter className="mt-4">
				<DialogClose
					render={
						<Button type="button" variant="secondary">
							Cancel
						</Button>
					}
				/>
				<Button type="submit">Add</Button>
			</DialogFooter>
		</form>
	);
}

export function AddAgentDialog({
	existingNames,
	disabled,
	onAdd,
}: {
	existingNames: string[];
	disabled?: boolean;
	onAdd: (agent: Agent) => void;
}) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={
					<Button type="button" variant="outline" size="sm" disabled={disabled}>
						<HugeiconsIcon icon={PlusIcon} />
						Add agent
					</Button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add agent</DialogTitle>
					<DialogDescription>
						Configure an agent to take part in the run.
					</DialogDescription>
				</DialogHeader>
				{/* Mounted only while open, so each opening starts from a fresh form. */}
				<AgentForm
					existingNames={existingNames}
					onSubmit={(agent) => {
						onAdd(agent);
						setOpen(false);
					}}
				/>
			</DialogContent>
		</Dialog>
	);
}

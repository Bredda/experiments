import z from "zod";

export const stepSchema = z.number().gte(0);
export type Step = z.infer<typeof stepSchema>;

export const timeSchema = z.iso.datetime();
export type Time = z.infer<typeof timeSchema>;

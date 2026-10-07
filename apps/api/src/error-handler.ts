import {
	InvalidInterventionError,
	RunBusyError,
	RunCompletedError,
	RunNotFoundError,
	StepNotFoundError,
} from "@experiments/engine";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

function statusFor(err: FastifyError): number {
	if (err instanceof RunNotFoundError || err instanceof StepNotFoundError) {
		return 404;
	}
	if (err instanceof ZodError || err instanceof InvalidInterventionError) {
		return 400;
	}
	if (err instanceof RunCompletedError || err instanceof RunBusyError) {
		return 409;
	}
	return err.statusCode ?? 500;
}

export function errorHandler(
	err: FastifyError,
	req: FastifyRequest,
	reply: FastifyReply,
) {
	const status = statusFor(err);

	if (status >= 500) {
		req.log.error(err);
	}

	reply.status(status).send({
		error:
			status === 500
				? "Internal server error"
				: err instanceof ZodError
					? err.issues.map((issue) => issue.message).join("; ")
					: err.message,
	});
}

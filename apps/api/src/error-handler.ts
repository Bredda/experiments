import { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export function errorHandler(
	err: FastifyError,
	_req: FastifyRequest,
	reply: FastifyReply,
) {
	console.error(err);
	const status = err.statusCode ?? 500;
	reply.status(status).send({
		error: status === 500 ? "Internal server error" : err.message,
	});
}

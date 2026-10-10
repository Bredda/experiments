import { DEFAULT_API_URL } from "./proxy";

/**
 * The browser calls the ui's own `/api` route, which forwards to the api
 * (see `app/api/[...path]/route.ts`), so no api address is built into the
 * page. Server-side rendering reaches the api directly at `API_URL`, read at
 * runtime.
 */
function apiUrl(): string {
	return typeof window === "undefined"
		? (process.env.API_URL ?? DEFAULT_API_URL)
		: "/api";
}

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

/** The API answers errors as `{ error: string }`; fall back to the raw body. */
function errorMessage(text: string): string {
	try {
		const body = JSON.parse(text);
		if (typeof body?.error === "string") return body.error;
	} catch {
		// Not JSON: use the text as is.
	}
	return text;
}

export async function apiFetch<T>(
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const endpoint = path.startsWith("/") ? path : `/${path}`;
	const res = await fetch(`${apiUrl()}${endpoint}`, {
		...init,
		method: init.method ?? "GET",
		headers: {
			// Fastify rejects a JSON content type on a request without a body.
			...(init.body !== undefined && init.body !== null
				? { "Content-Type": "application/json" }
				: {}),
			...(init.headers ?? {}),
		},
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new ApiError(res.status, errorMessage(text) || `API ${res.status}`);
	}

	// Handle empty responses (204, DELETE, etc.)
	const text = await res.text();
	if (!text) {
		return null as T;
	}
	try {
		const body = JSON.parse(text) as T;
		return body;
	} catch {
		throw new Error(`Invalid JSON response: ${text}`);
	}
}

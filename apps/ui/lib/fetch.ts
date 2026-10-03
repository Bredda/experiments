const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function apiFetch<T>(
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const endpoint = path.startsWith("/") ? path : `/${path}`;
	const res = await fetch(`${API_URL}${endpoint}`, {
		...init,
		method: init.method ?? "GET",
		headers: {
			"Content-Type": "application/json",
			...(init.headers ?? {}),
		},
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`API ${res.status}: ${text}`);
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

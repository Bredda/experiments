import { DEFAULT_API_URL, upstreamUrl } from "@/lib/proxy";

// The api address is read from the environment on every request, so a built
// image can be pointed at any api when it starts.
export const dynamic = "force-dynamic";

/** The only request headers the api needs; the rest (cookies, host…) stays here. */
const FORWARDED_HEADERS = ["content-type", "accept", "x-request-id"];

function error(status: number, message: string): Response {
	return Response.json({ error: message }, { status });
}

async function forward(
	request: Request,
	{ params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
	const { path } = await params;
	const url = upstreamUrl(
		process.env.API_URL ?? DEFAULT_API_URL,
		path,
		new URL(request.url).search,
	);
	if (url === null) return error(400, "Invalid path");

	const headers = new Headers();
	for (const name of FORWARDED_HEADERS) {
		const value = request.headers.get(name);
		if (value !== null) headers.set(name, value);
	}
	const hasBody = request.method !== "GET" && request.method !== "HEAD";

	try {
		const upstream = await fetch(url, {
			method: request.method,
			headers,
			body: hasBody ? request.body : undefined,
			// Streaming a request body requires it.
			...(hasBody ? { duplex: "half" } : {}),
			cache: "no-store",
			redirect: "manual",
		});
		const responseHeaders = new Headers();
		const contentType = upstream.headers.get("content-type");
		if (contentType !== null) responseHeaders.set("content-type", contentType);

		return new Response(upstream.body, {
			status: upstream.status,
			headers: responseHeaders,
		});
	} catch {
		return error(502, "The api is unreachable");
	}
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };

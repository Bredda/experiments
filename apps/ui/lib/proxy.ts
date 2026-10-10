/** Where the ui reaches the api when none is configured (local development). */
export const DEFAULT_API_URL = "http://localhost:8080";

/**
 * The api URL a browser call to `/api/<segments>` is forwarded to, or null
 * when a segment could climb out of the api (`.`, `..`), is empty or holds a
 * separator. `segments` are the decoded path segments of the request; the
 * path of `base` and the query string are kept.
 */
export function upstreamUrl(
	base: string,
	segments: readonly string[],
	search = "",
): URL | null {
	if (segments.length === 0) return null;
	if (
		segments.some(
			(segment) =>
				segment === "" ||
				segment === "." ||
				segment === ".." ||
				segment.includes("/") ||
				segment.includes("\\"),
		)
	) {
		return null;
	}

	const url = new URL(base);
	url.pathname = `${url.pathname.replace(/\/+$/, "")}/${segments
		.map(encodeURIComponent)
		.join("/")}`;
	url.search = search;
	return url;
}

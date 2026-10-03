/** What the run page is currently inspecting. One value, shared by every panel. */
export type RunSelection =
	| { type: "event"; id: string }
	| { type: "agent"; id: string };

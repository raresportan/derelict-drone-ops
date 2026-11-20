import type { LogKind, Sound, Typing } from "./types.ts";

export type RegionId = "surface" | "underworks" | "bore";

/** A log a drone can read from a terminal. */
export interface Log {
	id: string;
	title: string;
	author: string;
	lines: readonly string[];
}

/** A log in the main story: it turns up in order, no earlier than site `from`. */
export interface StoryLog extends Log {
	from: number;
}

/** One region's words: the beat that opens it, its story logs and its crew logs. */
export interface RegionText {
	beat: readonly string[];
	story: readonly StoryLog[];
	crew: readonly Log[];
}

/** A title typed onto the big screen from `at` until `until`. */
export interface IntroCard {
	at: number;
	until: number;
	title: string;
	sub: string;
}

export interface IntroText {
	length: number;
	scenes: readonly { at: number; scene: IntroScene }[];
	cards: readonly IntroCard[];
	cues: readonly { at: number; sound: Sound }[];
	lines: readonly { at: number; text: string; kind: LogKind; typed: Typing }[];
}

export type IntroScene = "transmission" | "sos" | "cut" | "moon" | "section" | "descent";

export interface EndingText {
	prompt: readonly string[];
	deliver: readonly string[];
	broadcast: readonly string[];
	broadcastBlind: readonly string[];
	after: readonly string[];
}

export const STORY_TOTAL = 15;
export const CREW_TOTAL = 30;
export const FINAL_SITE = 21;
export const FINAL_LOG = "S15";

export const REGIONS: readonly { id: RegionId; name: string; first: number; sites: readonly string[] }[] = [
	{ id: "surface", name: "THE SURFACE", first: 1, sites: ["PERIMETER HAB 3", "LANDING PAD CONTROL", "ICE REFINERY NORTH", "HYDROPONICS RING", "RELAY STATION ECHO", "VEHICLE BAY 2", "SURFACE MEDICAL"] },
	{ id: "underworks", name: "THE UNDERWORKS", first: 8, sites: ["SERVICE TUNNEL K", "PUMP HALL", "COLD STORAGE", "CREW BARRACKS", "SHAFT HEAD", "REACTOR ANNEX", "SECURITY HUB"] },
	{ id: "bore", name: "THE BORE", first: 15, sites: ["BORE LIFT", "SAMPLE LAB A", "SAMPLE LAB B", "THE CAGE", "DRILL HEAD", "THE CAVERN", "THE BORE FLOOR"] },
];

/** The region site `site` belongs to; past the last site, the deep sectors count as the Bore. */
export function regionOf(site: number): (typeof REGIONS)[number] {
	return [...REGIONS].reverse().find((r) => site >= r.first) ?? REGIONS[0]!;
}

export const siteName = (site: number): string => (site > FINAL_SITE ? `DEEP SECTOR ${site - FINAL_SITE}` : regionOf(site).sites[site - regionOf(site).first]!);

/** The training hulk's terminal: always at hand, so the tutorial needs nothing loaded. */
export const BRIEFING: Log = {
	id: "H-00",
	title: "Contractor briefing",
	author: "Cyberdime Mining Co.",
	lines: [
		"Welcome, contractor. This hulk is a training simulation of Cyberdime property.",
		"On Lacuna you will find sealed sample canisters. They are company assets.",
		"Recover them. Do not open them. Do not discuss them on open channels.",
	],
};

const loaders: Record<RegionId, () => Promise<{ default: RegionText }>> = {
	surface: () => import("./content/surface.ts"),
	underworks: () => import("./content/underworks.ts"),
	bore: () => import("./content/bore.ts"),
};

/** Fetches a region's words, as a separate chunk the first time it's asked for. */
export const loadRegion = (id: RegionId): Promise<RegionText> => loaders[id]().then((m) => m.default);
export const loadIntro = (): Promise<IntroText> => import("./content/intro.ts").then((m) => m.default);
export const loadEnding = (): Promise<EndingText> => import("./content/ending.ts").then((m) => m.default);

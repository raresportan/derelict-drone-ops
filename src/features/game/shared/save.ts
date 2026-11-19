import { ROLES } from "./rules.ts";
import type { Best, Campaign, DroneSpec } from "./types.ts";

/** Everything kept between runs, as written to the save file or browser storage. */
export interface SaveData {
	campaign: Campaign | null;
	best: Best | null;
	tutorialDone: boolean;
	archive: string[];
	introSeen: boolean;
	endings: string[];
}

export const EMPTY_SAVE: SaveData = { campaign: null, best: null, tutorialDone: false, archive: [], introSeen: false, endings: [] };

export const CHANNELS = { load: "saves:load", write: "saves:write" } as const;

/** What the renderer may ask of the save file. Absent in a browser, where saves stay in local storage. */
export interface SavesApi {
	load(): Promise<SaveData>;
	write(data: SaveData): Promise<void>;
}

declare global {
	interface Window {
		readonly saves?: SavesApi;
	}
}

const whole = (v: unknown, min = 0): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min;
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function drone(v: unknown, i: number): DroneSpec | null {
	const role = ROLES[i];
	if (!record(v) || role === undefined || v.id !== i + 1) return null;
	const { hull, alive, armour, thrust, mk2 } = v;
	if (typeof hull !== "number" || !(hull >= 0 && hull <= 100) || typeof alive !== "boolean" || typeof mk2 !== "boolean") return null;
	if (!whole(armour) || armour > 2 || !whole(thrust) || thrust > 2) return null;
	return { id: i + 1, name: role.name, mod: role.mod, hull, alive, armour, thrust, mk2 };
}

function campaign(v: unknown): Campaign | null {
	if (!record(v) || !whole(v.seed) || !whole(v.jump, 1) || !whole(v.fuel) || !whole(v.scrap) || !Array.isArray(v.drones) || v.drones.length !== ROLES.length) return null;
	const drones = v.drones.map(drone);
	const stats = v.stats;
	if (drones.some((d) => d === null) || !record(stats) || !whole(stats.scrap) || !whole(stats.rooms) || !whole(stats.kills)) return null;
	return { seed: v.seed, jump: v.jump, fuel: v.fuel, scrap: v.scrap, drones: drones as DroneSpec[], stats: { scrap: stats.scrap, rooms: stats.rooms, kills: stats.kills }, ended: v.ended === true };
}

/** Reads saved data, keeping each part that's whole and dropping any part that's damaged. */
export function parseSave(raw: unknown): SaveData {
	if (!record(raw)) return EMPTY_SAVE;
	const best = record(raw.best) && whole(raw.best.jump) && whole(raw.best.scrap) ? { jump: raw.best.jump, scrap: raw.best.scrap } : null;
	const ids = (v: unknown, pattern: RegExp): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && pattern.test(x)))] : []);
	return {
		campaign: campaign(raw.campaign),
		best,
		tutorialDone: raw.tutorialDone === true,
		archive: ids(raw.archive, /^(S\d{2}|C-[SUB]\d{2}|H-00)$/),
		introSeen: raw.introSeen === true,
		endings: ids(raw.endings, /^(deliver|broadcast)$/),
	};
}

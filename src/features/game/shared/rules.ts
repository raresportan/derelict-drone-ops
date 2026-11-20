import type { Difficulty, Drone, DroneSpec, Module } from "./types.ts";

export const SHIPS = [
	"BULK HAULER ORISON-7", "ORE TENDER MALLOW", "COLONY BARGE TEMPERANCE", "SURVEY CUTTER HALCYON", "REEFER FREIGHTER OSTARA", "TUG KESTREL-9",
	"LINER CALLISTO GRACE", "DREDGER SABLE WREN", "MAIL PACKET ISOLDE", "HOSPITAL FRIGATE MERCY ANN", "TANKER GREY HERON", "RESEARCH HULK VESTA DEEP",
];

export const ROLES: readonly { name: string; mod: Module }[] = [
	{ name: "WREN", mod: "MOTION" },
	{ name: "MOTH", mod: "SHIELD" },
	{ name: "BUOY", mod: "LURE" },
];

export const PRICE = { repairPer25: 1, rebuild: 6, armour: 4, thrust: 3, mk2: 5, fuel: 5 } as const;

export const MK2: Record<Module, string> = {
	MOTION: "scan reaches 5 rooms, recharges in 5 s",
	SHIELD: "gathers 3× faster, +1 armour plate",
	LURE: "decoy lasts 14 s and pulls from farther",
};

/** Fuel a new campaign starts with: one for the first jump and one spare. */
export const START_FUEL = 2;

export const baseDrones = (): DroneSpec[] => ROLES.map((role, i) => ({ id: i + 1, name: role.name, mod: role.mod, hull: 100, alive: true, armour: 0, thrust: 0, mk2: false }));

/** How hard site number `jump` is: across the 21 sites, bigger, with more, faster and harder-hitting lifeforms. */
export function difficulty(jump: number, fuelRoll = 0): Difficulty {
	return {
		W: Math.min(40, 26 + jump),
		H: Math.min(24, 16 + Math.floor(jump / 2)),
		creatures: Math.min(9, 1 + Math.floor(jump * 0.4)),
		rad: Math.min(5, Math.floor(jump / 3)),
		purge: 2 + Math.min(2, Math.floor(jump / 7)),
		scrap: 7 + jump,
		fuel: jump < 8 ? 2 : 1 + (fuelRoll < 0.5 ? 1 : 0),
		openP: 0.15,
		remove: 0.17,
		chase: Math.min(2.4, 1.7 + 0.03 * jump),
		wander: 1.2,
		dmg: Math.min(90, 38 + 2.5 * jump),
	};
}

export const TUTORIAL_DIFFICULTY: Difficulty = { W: 20, H: 13, creatures: 1, rad: 0, purge: 1, scrap: 0, fuel: 0, openP: 0, remove: 0, chase: 1.7, wander: 1, dmg: 40 };

/** How much of a hit a drone takes: MOTH's shield halves it, and each armour plate cuts about a fifth more. */
export const damageTaken = (d: DroneSpec): number => (d.mod === "SHIELD" ? 0.5 : 1) * (1 - 0.22 * Math.min(3, d.armour + (d.mod === "SHIELD" && d.mk2 ? 1 : 0)));

export const speedOf = (d: DroneSpec): number => 2.7 * (1 + 0.15 * d.thrust);

/** What it costs to bring a drone back to full hull. */
export const repairCost = (d: DroneSpec): number => Math.ceil((100 - d.hull) / 25) * PRICE.repairPer25;

/** What a drone may be called: 3 to 8 letters, digits or dashes, starting with a letter. */
export const DRONE_NAME = /^[A-Z][A-Z0-9-]{2,7}$/;

/** Why drone `id` can't be called `name`, or null when it can: the shape, the words commands already use, and the other drones' names. */
export function nameProblem(drones: readonly DroneSpec[], id: number, name: string): string | null {
	if (!DRONE_NAME.test(name)) return "A name is 3 to 8 letters, digits or dashes, starting with a letter.";
	if (/^(ALL|DOCK|[RDA]\d+)$/.test(name)) return `${name} is reserved for commands.`;
	const taken = drones.find((d) => d.id !== id && d.name === name);
	return taken === undefined ? null : `${name} is already drone ${taken.id}.`;
}

export const specOf = (d: Drone | DroneSpec): DroneSpec => ({ id: d.id, name: d.name, mod: d.mod, hull: Math.max(0, d.hull), alive: d.alive, armour: d.armour, thrust: d.thrust, mk2: d.mk2 });

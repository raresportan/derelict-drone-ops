import { parseDrones } from "./commands.ts";
import { MK2, PRICE, repairCost } from "./rules.ts";
import type { Campaign, LogKind, Sink } from "./types.ts";

const pips = (n: number, max: number): string => "■".repeat(n) + "□".repeat(max - n);

export const DRYDOCK_HELP: readonly [string, LogKind][] = [
	["DRYDOCK COMMANDS", "head"],
	[`  repair <drones|all>     ${PRICE.repairPer25} scrap per 25% hull`, "note"],
	[`  rebuild <drone>         ${PRICE.rebuild} scrap — replace a lost drone (bare, no upgrades)`, "note"],
	[`  upgrade <drone> armour  ${PRICE.armour} scrap, max 2 — each plate cuts damage ~22%`, "note"],
	[`  upgrade <drone> thrust  ${PRICE.thrust} scrap, max 2 — +15% speed each`, "note"],
	[`  upgrade <drone> mk2     ${PRICE.mk2} scrap, once — improves the drone's own module`, "note"],
	[`  buy fuel                ${PRICE.fuel} scrap — one jump's worth`, "note"],
	["  hop                     burn 1 fuel, fly the hopper to the next site   status   menu", "note"],
];

/** What a drydock command needs from the game around it. */
export interface DrydockHost {
	readonly camp: Campaign;
	readonly sink: Sink;
	jump(): void;
	leave(): void;
	save(): void;
}

function spend(h: DrydockHost, cost: number, what: string): boolean {
	if (h.camp.scrap < cost) {
		h.sink.log(`${what}: needs ${cost} scrap, you have ${h.camp.scrap}.`, "warn");
		h.sink.sound("err");
		return false;
	}
	h.camp.scrap -= cost;
	return true;
}

function upgrade(h: DrydockHost, kind: string | undefined, ids: number[]): void {
	const { camp, sink } = h;
	if (ids.length === 0 || (kind !== "armour" && kind !== "thrust" && kind !== "mk2")) {
		sink.log("Usage: upgrade <drone> armour|thrust|mk2", "warn");
		sink.sound("err");
		return;
	}
	for (const id of ids) {
		const d = camp.drones[id - 1]!;
		if (!d.alive) {
			sink.log(`${d.name} is lost.`, "warn");
			continue;
		}
		if (kind === "mk2") {
			if (d.mk2) {
				sink.log(`${d.name} already MK2.`, "note");
				continue;
			}
			if (!spend(h, PRICE.mk2, `${d.name} MK2`)) return;
			d.mk2 = true;
			sink.log(`${d.name} MK2: ${MK2[d.mod]}.`, "ok");
		} else {
			if (d[kind] >= 2) {
				sink.log(`${d.name} ${kind} already at max.`, "note");
				continue;
			}
			if (!spend(h, PRICE[kind], `${d.name} ${kind}`)) return;
			d[kind]++;
			sink.log(`${d.name} ${kind} ${pips(d[kind], 2)}.`, "ok");
		}
	}
	sink.sound("ok");
}

/** Runs one drydock command. Anything that changes the campaign is saved. */
export function drydockCommand(h: DrydockHost, cmd: string, args: string[]): void {
	const { camp, sink } = h;
	const drones = camp.drones;
	switch (cmd) {
		case "help":
			for (const [text, kind] of DRYDOCK_HELP) sink.log(text, kind);
			return;
		case "status":
			for (const d of drones) {
				sink.log(
					`  ${d.id} ${d.name.padEnd(5)} ${d.mod.padEnd(7)} ${d.alive ? `hull ${String(Math.ceil(d.hull)).padStart(3)}%  armour ${pips(d.armour, 2)}  thrust ${pips(d.thrust, 2)}  mk2 ${d.mk2 ? "■" : "□"}` : "— LOST"}`,
					d.alive ? "drone" : "warn",
				);
			}
			sink.log(`  scrap ${camp.scrap} · fuel ${camp.fuel} · jump ${camp.jump}`, "head");
			return;
		case "repair": {
			const { ids } = parseDrones(args.length > 0 ? args : ["all"], drones);
			let repaired = false;
			for (const id of ids) {
				const d = drones[id - 1]!;
				if (!d.alive) {
					sink.log(`${d.name} is lost — REBUILD ${id} instead.`, "warn");
					continue;
				}
				const cost = repairCost(d);
				if (cost === 0) continue;
				if (!spend(h, cost, `Repair ${d.name}`)) break;
				d.hull = 100;
				repaired = true;
				sink.log(`${d.name} hull restored to 100% (−${cost} scrap).`, "ok");
			}
			if (repaired) sink.sound("ok");
			else sink.log("Nothing repaired.", "note");
			break;
		}
		case "rebuild": {
			const d = drones[Number(args[0]) - 1];
			if (d === undefined) {
				sink.log("Usage: rebuild <drone>", "warn");
				return;
			}
			if (d.alive) {
				sink.log(`${d.name} is still flying.`, "note");
				return;
			}
			if (!spend(h, PRICE.rebuild, `Rebuild ${d.name}`)) return;
			Object.assign(d, { alive: true, hull: 100, armour: 0, thrust: 0, mk2: false });
			sink.log(`${d.name} rebuilt from the parts bin (−${PRICE.rebuild} scrap).`, "ok");
			sink.sound("ok");
			break;
		}
		case "upgrade":
		case "armour":
		case "thrust":
		case "mk2": {
			const { ids, rest } = parseDrones(args, drones);
			upgrade(h, cmd === "upgrade" ? (rest[0] === "armor" ? "armour" : rest[0]) : cmd, ids);
			break;
		}
		case "buy":
			if (args[0] !== "fuel") {
				sink.log("Usage: buy fuel", "warn");
				return;
			}
			if (!spend(h, PRICE.fuel, "Fuel cell")) return;
			camp.fuel++;
			sink.log(`Fuel cell bought (−${PRICE.fuel} scrap). Fuel ${camp.fuel}.`, "ok");
			sink.sound("ok");
			break;
		case "jump":
			h.jump();
			return;
		case "menu":
			sink.log("Contract log saved.", "note");
			h.leave();
			return;
		default:
			sink.log(`Unknown drydock command "${cmd}". Type HELP.`, "warn");
			sink.sound("err");
			return;
	}
	h.save();
}

import type { Rng } from "./rng.ts";
import { TUTORIAL_DIFFICULTY } from "./rules.ts";
import { BRIEFING } from "./story.ts";
import type { Campaign, Ship, Tutorial } from "./types.ts";
import { generate, newCreature, spotIn } from "./world.ts";

/** The training hulk, stocked for the lesson, and the steps that walk through it. */
export function buildTutorial(rng: Rng): { ship: Ship; tutorial: Tutorial } {
	for (let seed = 11; ; seed++) {
		const ship = generate(seed, TUTORIAL_DIFFICULTY, true, rng);
		const S = ship.start;
		const next = ship.adj[S]!.find((link) => link.to !== ship.dock);
		const lair = ship.rooms.map((_, i) => i).filter((i) => ship.depth[i]! >= 2).sort((a, b) => ship.depth[b]! - ship.depth[a]!)[0];
		if (next === undefined || lair === undefined) continue;
		const N = next.to, L = lair, rN = ship.rooms[N]!, rL = ship.rooms[L]!;
		rN.items.push({ ...spotIn(rng, rN), v: 1, kind: "scrap" }, { ...spotIn(rng, rN), v: 1, kind: "scrap" });
		rN.terminal = { log: BRIEFING.id, story: false, read: false };
		const spare = ship.rooms.map((_, i) => i).find((i) => i !== N && i !== L && i !== S);
		if (spare !== undefined) ship.rooms[spare]!.items.push({ ...spotIn(rng, ship.rooms[spare]!), v: 1, kind: "fuel" });
		rL.items.push({ ...spotIn(rng, rL), v: 3, kind: "core" });
		rL.purge = true;
		ship.creatures.push(newCreature(rng, spotIn(rng, rL), L));
		const rs = `r${ship.rooms[S]!.num}`, rn = `r${rN.num}`, dn = ship.doors[next.door]!.name, rl = `r${rL.num}`;
		const tutorial: Tutorial = {
			i: 0,
			steps: [
				{ text: `Every order is typed. Send drone 1 into the first room:   nav 1 ${rs}`, done: (m) => m.drones[0]!.node === S && m.drones[0]!.path.length === 0, target: { room: S } },
				{ text: `Surveyed rooms glow brighter. Doors start shut — open the way on:   open ${dn}`, done: (m) => m.doors[next.door]!.open, target: { door: next.door } },
				{ text: "Before going in, listen. WREN carries a motion scanner:   motion", done: (m) => m.scanned, target: null },
				{ text: `Quiet nearby. Salvage was sighted in ${rn}. Send MOTH:   nav 2 ${rn}`, done: (m) => m.drones[1]!.node === N && m.drones[1]!.path.length === 0, target: { room: N } },
				{ text: "Pick it up:   gather 2", done: (m) => m.drones[1]!.cargo > 0, target: null },
				{ text: `A terminal is still powered in ${rn}. Logs tell you what happened here. Have MOTH read it:   read 2`, done: (m) => rN.terminal?.read === true && m.drones[1]!.state !== "READING", target: { room: N } },
				{ text: "Cargo only counts once it's in the dock. Bring it home:   nav 2 dock", done: (m) => m.bank.scrap > 0, target: { dock: true } },
				{
					text: `Something sleeps in ${rl} beside a data core. Lifeforms can't pass closed doors; a purge valve there kills anything inside. Explore, then:   nav all dock   and   undock`,
					done: () => false,
					target: { room: L },
				},
			],
		};
		return { ship, tutorial };
	}
}

/** One step of orientation's simulated drydock: done once the contract shows it, or once the command it asks for has run. */
export interface DrillStep {
	text: string;
	done: (camp: Campaign, cmd: string) => boolean;
}

/** Scrap the simulated drydock adds to what the hulk gave up, so every step can be paid for. */
export const DRILL_CREDIT = 12;

/** After the hulk, a simulated drydock: reading the fleet, an upgrade, fuel, and the hop that ends orientation. */
export const DRILL: readonly DrillStep[] = [
	{ text: "Simulated drydock. Between sites, scrap buys repairs, rebuilds and upgrades. Check the fleet:   status", done: (_, cmd) => cmd === "status" },
	{ text: "MK2 improves a drone's own module: MOTH would gather 3× faster, with a free armour plate:   upgrade 2 mk2", done: (camp) => camp.drones[1]!.mk2 },
	{ text: "Every hop burns a fuel cell. Dry tanks and no scrap to buy more end a contract. Buy a spare:   buy fuel", done: (camp) => camp.fuel > 1 },
	{ text: "Upgrades and call signs stay with your drones from site to site. Fly on:   hop", done: () => false },
];

/** The commands a step asks for, as one line: the parts set off by three spaces, chained with `;`. */
export const askedCommand = (text: string): string =>
	text.split("   ").slice(1).map((part) => part.trim()).filter((part) => part !== "" && part !== "and").join("; ");

import { ALIAS, missionCommand } from "./commands.ts";
import { drydockCommand } from "./drydock.ts";
import type { Rng } from "./rng.ts";
import { baseDrones, difficulty, PRICE, SHIPS, START_FUEL, specOf, TUTORIAL_DIFFICULTY } from "./rules.ts";
import { dockDrones, tickMission } from "./sim.ts";
import { buildTutorial } from "./tutorial.ts";
import type { Campaign, Difficulty, Drone, DroneSpec, Mission, Mode, Over, SaveStore, Ship, Sink, Tutorial } from "./types.ts";
import { generate } from "./world.ts";

/** A function key: its label and the command it types. */
export type FKey = readonly [label: string, command: string] | null;

const FKEYS: Record<Mode, readonly FKey[]> = {
	menu: [["TUTORIAL", "1"], ["CAMPAIGN", "2"], ["CONTINUE", "3"], null, null, null, null, ["SND", "sound"], null],
	mission: [["HELP", "help"], ["STATUS", "status"], ["MOTION", "motion"], ["LURE", "lure 3"], ["STOP", "stop all"], ["RECALL", "nav all dock"], ["LABELS", "labels"], ["SND", "sound"], ["MENU", "menu"]],
	drydock: [["HELP", "help"], ["STATUS", "status"], ["REPAIR", "repair all"], ["FUEL", "buy fuel"], null, null, ["JUMP", "jump"], ["SND", "sound"], ["MENU", "menu"]],
	over: [["TUTORIAL", "tutorial"], ["CAMPAIGN", "campaign"], null, null, null, null, null, ["SND", "sound"], ["MENU", "menu"]],
};

const WORDS: Record<Mode, readonly string[]> = {
	mission: ["nav", "open", "close", "gather", "motion", "lure", "purge", "stop", "status", "undock", "labels", "sound", "clear", "help", "menu"],
	drydock: ["repair", "rebuild", "upgrade", "buy", "jump", "status", "sound", "clear", "help", "menu", "armour", "thrust", "mk2", "fuel", "all"],
	menu: ["tutorial", "campaign", "continue", "sound", "clear"],
	over: ["tutorial", "campaign", "menu", "sound", "clear"],
};

/** Seconds between the tug casting off and what comes next, so the player sees how the boarding ended. */
export const CAST_OFF = { toDrydock: 2.6, toMenu: 3.2, afterLoss: 1.5 } as const;

/** The whole game: which screen it's on, the campaign, and the boarding in progress. It runs on its own clock. */
export class Game {
	mode: Mode = "menu";
	campaign: Campaign | null = null;
	mission: Mission | null = null;
	over: Over | null = null;
	labels = true;
	threat = false;
	readonly sink: Sink;
	readonly saves: SaveStore;
	readonly rng: Rng;
	#pending: { left: number; run: () => void } | null = null;

	constructor(sink: Sink, saves: SaveStore, rng: Rng = Math.random) {
		this.sink = sink;
		this.saves = saves;
		this.rng = rng;
	}

	fkeys(): readonly FKey[] {
		return FKEYS[this.mode];
	}

	/** Words Tab can complete: commands first, then this ship's rooms and doors. */
	completions(first: boolean): readonly string[] {
		const m = this.mission;
		if (first || this.mode !== "mission" || m === null) return WORDS[this.mode];
		return [...m.rooms.map((r) => `r${r.num}`), ...m.doors.map((d) => d.name), "dock", "all"];
	}

	tick(dt: number): void {
		if (this.#pending !== null) {
			this.#pending.left -= dt;
			if (this.#pending.left <= 0) {
				const { run } = this.#pending;
				this.#pending = null;
				run();
			}
		}
		const m = this.mission;
		if (this.mode !== "mission" || m === null) {
			this.threat = false;
			return;
		}
		this.threat = tickMission(m, dt, this.sink, this.rng);
		if (m.end === null && this.#pending === null && m.drones.every((d) => !d.alive)) this.#after(CAST_OFF.afterLoss, () => this.#finish("lost"));
		const t = m.tutorial;
		if (t !== null && m.end === null) {
			const step = t.steps[t.i]!;
			if (step.done(m) && t.i < t.steps.length - 1) {
				this.sink.log(`✓ ${step.text.split("   ")[0]}`, "ok");
				this.sink.sound("ping");
				t.i++;
			}
		}
	}

	/** Runs a line of commands, separated by `;`. */
	command(line: string): void {
		for (const part of line.split(";").map((s) => s.trim()).filter(Boolean)) this.#one(part);
	}

	showMenu(): void {
		this.mission = null;
		this.over = null;
		this.#pending = null;
		this.mode = "menu";
		this.sink.clear();
		const save = this.saves.campaign(), best = this.saves.best(), tutorialDone = this.saves.tutorialDone();
		const lines: [string, "head" | "note" | "ok"][] = [
			["SCT-7 SALVAGE CONTROL TERMINAL · SALVAGE-OS v2.1", "head"],
			["Three drones, one tug, and a long list of dead ships nobody else wants to board.", "note"],
			[`  1  TUTORIAL        a guided first boarding${tutorialDone ? " (completed)" : " — recommended"}`, tutorialDone ? "ok" : "head"],
			["  2  NEW CAMPAIGN    jump from derelict to derelict until the fuel or the drones run out", "ok"],
		];
		if (save !== null) lines.push([`  3  CONTINUE        jump ${save.jump} · ${save.scrap} scrap · ${save.fuel} fuel · ${save.drones.filter((d) => d.alive).length}/3 drones`, "ok"]);
		if (best !== null) lines.push([`Best run: ${best.jump} derelicts boarded · ${best.scrap} scrap salvaged`, "note"]);
		lines.push(["Type a number (or its name) and press Enter.", "note"]);
		for (const [text, kind] of lines) this.sink.log(text, kind, true);
	}

	#after(seconds: number, run: () => void): void {
		this.#pending = { left: seconds, run };
	}

	#one(line: string): void {
		const words = line.toLowerCase().replace(/,/g, " ").split(/\s+/).filter(Boolean);
		const word = words[0];
		if (word === undefined) return;
		const cmd = ALIAS[word] ?? word, args = words.slice(1);
		if (cmd === "sound") {
			this.sink.log(`Sound ${this.sink.toggleSound() ? "on" : "off"}.`, "note");
			this.sink.sound("ok");
			return;
		}
		if (cmd === "clear") {
			this.sink.clear();
			return;
		}
		const m = this.mission, camp = this.campaign;
		if (this.mode === "mission" && m !== null) {
			missionCommand({ m, sink: this.sink, rng: this.rng, finish: () => this.#finish("undock"), leave: () => this.#leaveMission(), toggleLabels: () => (this.labels = !this.labels) }, cmd, args, word);
		} else if (this.mode === "drydock" && camp !== null) {
			drydockCommand({ camp, sink: this.sink, jump: () => this.#jump(), leave: () => this.showMenu(), save: () => this.saves.keepCampaign(camp) }, cmd, args);
		} else this.#menuCommand(cmd);
	}

	#menuCommand(cmd: string): void {
		if (cmd === "1" || cmd === "tutorial") this.#startTutorial();
		else if (cmd === "2" || cmd === "campaign" || cmd === "new") this.#newCampaign();
		else if ((cmd === "3" || cmd === "continue") && this.mode === "menu") this.#continue();
		else if (cmd === "menu") this.showMenu();
		else if (cmd === "help") this.sink.log("Type 1 (tutorial), 2 (new campaign) or 3 (continue).", "note");
		else {
			this.sink.log(`Unknown option "${cmd}".`, "warn");
			this.sink.sound("err");
		}
	}

	#board(ship: Ship, o: Difficulty, specs: readonly DroneSpec[], name: string, tutorial: Tutorial | null): Mission {
		const drones: Drone[] = specs.map((s) => ({ ...s, x: 0, y: 0, node: ship.dock, path: [], state: "DOCKED", cargo: 0, fuel: 0, gather: 0, gatherFor: 0, dir: 0, hit: 0, dest: null, wreck: false }));
		const m: Mission = { ...ship, o, ship: name, drones, bank: { scrap: 0, fuel: 0 }, t: 0, fx: [], lure: null, motionCd: 0, end: null, undockArm: false, menuArm: false, scanned: false, tutorial };
		dockDrones(m);
		this.mission = m;
		this.#pending = null;
		this.mode = "mission";
		this.sink.clear();
		return m;
	}

	#startTutorial(): void {
		const { ship, tutorial } = buildTutorial(this.rng);
		this.#board(ship, TUTORIAL_DIFFICULTY, baseDrones(), "TRAINING HULK PRIMER", tutorial);
		this.sink.log("TRAINING TETHER: TRAINING HULK PRIMER. Simulated hazards; real lessons.", "head", true);
		this.sink.log("Follow the highlighted line under the log. The map pulses where to look.", "note", true);
	}

	#newCampaign(): void {
		this.campaign = { seed: Math.floor(this.rng() * 1e6), jump: 0, fuel: START_FUEL, scrap: 0, drones: baseDrones(), stats: { scrap: 0, rooms: 0, kills: 0 } };
		this.sink.log("New campaign. The tug burns its first fuel cell toward a derelict…", "head");
		this.#jump(true);
	}

	#continue(): void {
		const save = this.saves.campaign();
		if (save === null) {
			this.sink.log("No saved campaign.", "warn");
			return;
		}
		this.campaign = structuredClone(save);
		this.#enterDrydock(true);
	}

	#jump(first = false): void {
		const camp = this.campaign!;
		if (camp.fuel < 1) {
			this.sink.log("No fuel. BUY FUEL or the tug drifts.", "warn");
			this.sink.sound("err");
			return;
		}
		if (!camp.drones.some((d) => d.alive)) {
			this.sink.log("No working drones. REBUILD one first.", "warn");
			this.sink.sound("err");
			return;
		}
		camp.fuel--;
		camp.jump++;
		this.sink.sound("jump");
		const o = difficulty(camp.jump, this.rng());
		const ship = generate((camp.seed + camp.jump * 7919) % 999983, o, false, this.rng);
		const m = this.#board(ship, o, camp.drones, SHIPS[(camp.seed + camp.jump) % SHIPS.length]!, null);
		const firstDoor = m.doors.find((d) => !d.air && (d.a === m.start || d.b === m.start));
		const typed = (text: string, kind: "head" | "warn" | "ok" | "note") => this.sink.log(text, kind, true);
		typed(`JUMP ${camp.jump} · HARD TETHER ESTABLISHED WITH ${m.ship}.`, "head");
		typed(`Hull reads cold. ${o.creatures} biological trace${o.creatures > 1 ? "s" : ""} on the long-range sweep${o.rad ? `, ${o.rad} radiation leak${o.rad > 1 ? "s" : ""}` : ""}.`, "warn");
		typed(`Fuel left after this jump: ${camp.fuel}. Find fuel cells (◎) or buy fuel with scrap at the drydock.`, "ok");
		typed(first ? `TYPE HELP OR PRESS F1.  Try:  nav 1 r${m.rooms[m.start]!.num}  ·  open ${firstDoor?.name ?? "d1"}  ·  motion` : "Drones standing by in the dock behind a1.", "note");
	}

	#finish(kind: "undock" | "lost"): void {
		const m = this.mission!;
		if (m.end !== null) return;
		m.end = kind;
		if (kind === "undock") {
			for (const d of m.drones.filter((x) => x.alive && x.node !== m.dock)) {
				d.alive = false;
				d.state = "LOST";
				this.sink.log(`${d.name} left aboard ${m.ship}. Signal fades.`, "warn");
			}
			this.sink.log(`════════ UNDOCKED FROM ${m.ship} ════════`, "head");
			this.sink.sound("ping");
		} else this.sink.log("════════ ALL DRONE SIGNALS LOST — TUG CASTS OFF ════════", "alarm");
		const surveyed = m.rooms.filter((r) => r.seen).length, kills = m.creatures.filter((c) => !c.alive).length;
		this.sink.log(`Recovered ${m.bank.scrap} scrap, ${m.bank.fuel} fuel · ${surveyed}/${m.rooms.length} rooms surveyed`, "head");
		if (m.tutorial !== null) {
			this.saves.finishTutorial();
			this.sink.log(kind === "undock" ? "Tutorial complete. The real derelicts are bigger, darker and less forgiving." : "Training drones lost. That is the lesson: close doors behind you.", "loot");
			this.#after(CAST_OFF.toMenu, () => this.showMenu());
			return;
		}
		const camp = this.campaign!;
		camp.drones = m.drones.map(specOf);
		camp.scrap += m.bank.scrap;
		camp.fuel += m.bank.fuel;
		camp.stats.scrap += m.bank.scrap;
		camp.stats.rooms += surveyed;
		camp.stats.kills += kills;
		this.#after(CAST_OFF.toDrydock, () => this.#enterDrydock(false));
	}

	#leaveMission(): void {
		const m = this.mission;
		if (m !== null && m.tutorial === null && this.campaign !== null) this.sink.log("Back to the last drydock save.", "note");
		this.showMenu();
	}

	#enterDrydock(resumed: boolean): void {
		const camp = this.campaign!;
		this.mission = null;
		this.mode = "drydock";
		this.sink.clear();
		const alive = camp.drones.filter((d) => d.alive).length;
		const need = (camp.fuel > 0 ? 0 : PRICE.fuel) + (alive > 0 ? 0 : PRICE.rebuild);
		if (camp.scrap < need) {
			this.#gameOver(alive > 0 ? "STRANDED — NO FUEL, NO SCRAP TO BUY ANY" : "FLEET LOST — NO DRONES, NO SCRAP TO BUILD ONE");
			return;
		}
		this.saves.keepCampaign(camp);
		const typed = (text: string, kind: "head" | "ok" | "note" | "warn") => this.sink.log(text, kind, true);
		typed(resumed ? `Campaign restored · jump ${camp.jump}.` : "Tug clear of the derelict. Drydock systems online.", "head");
		typed(`Scrap ${camp.scrap} · fuel ${camp.fuel} · drones ${alive}/3. Spend scrap on repairs, rebuilds and upgrades.`, "ok");
		typed(camp.fuel > 0 ? "Type JUMP (F7) when ready. Progress saves here automatically." : `No fuel — BUY FUEL (${PRICE.fuel} scrap) before you can jump.`, camp.fuel > 0 ? "note" : "warn");
		typed("Type HELP for drydock commands.", "note");
	}

	#gameOver(reason: string): void {
		const camp = this.campaign!;
		const best = this.saves.best() ?? { jump: 0, scrap: 0 };
		if (camp.jump > best.jump || (camp.jump === best.jump && camp.stats.scrap > best.scrap)) this.saves.keepBest({ jump: camp.jump, scrap: camp.stats.scrap });
		this.saves.keepCampaign(null);
		this.over = { reason, jump: camp.jump, scrap: camp.stats.scrap, rooms: camp.stats.rooms, kills: camp.stats.kills };
		this.mission = null;
		this.mode = "over";
		this.sink.sound("boom");
		this.sink.log(` CAMPAIGN OVER — ${reason} `, "alarm", true);
		this.sink.log(`Derelicts boarded: ${this.over.jump} · scrap salvaged: ${this.over.scrap} · rooms surveyed: ${this.over.rooms} · lifeforms killed: ${this.over.kills}`, "head", true);
		this.sink.log("Type CAMPAIGN to start again, TUTORIAL, or MENU.", "note", true);
	}
}


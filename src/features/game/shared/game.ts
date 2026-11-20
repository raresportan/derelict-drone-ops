import { ALIAS, missionCommand } from "./commands.ts";
import { drydockCommand } from "./drydock.ts";
import type { Rng } from "./rng.ts";
import { baseDrones, difficulty, PRICE, START_FUEL, specOf, TUTORIAL_DIFFICULTY } from "./rules.ts";
import { dockDrones, tickMission } from "./sim.ts";
import {
	BRIEFING, type EndingText, FINAL_LOG, FINAL_SITE, type IntroScene, type IntroText, loadEnding, loadIntro, loadRegion, type Log, type RegionId, type RegionText,
	REGIONS, regionOf, siteName,
} from "./story.ts";
import { buildTutorial, DRILL, DRILL_CREDIT } from "./tutorial.ts";
import type { Campaign, Difficulty, Drone, DroneSpec, LogKind, Mission, Mode, Over, SaveStore, Ship, Sink, Tutorial } from "./types.ts";
import { generate } from "./world.ts";

/** A function key: its label and the command it types. */
export type FKey = readonly [label: string, command: string] | null;

const FKEYS: Record<Mode, readonly FKey[]> = {
	menu: [["ORIENTATION", "1"], ["NEW CONTRACT", "2"], ["RESUME", "3"], ["ARCHIVE", "4"], ["MISSION DATA", "5"], null, null, ["SND", "sound"], null],
	intro: [["SKIP", "skip"], null, null, null, null, null, null, ["SND", "sound"], null],
	mission: [["HELP", "help"], ["STATUS", "status"], ["MOTION", "motion"], ["LURE", "lure 3"], ["STOP", "stop all"], ["RECALL", "nav all dock"], ["LABELS", "labels"], ["SND", "sound"], ["MENU", "menu"]],
	drydock: [["HELP", "help"], ["STATUS", "status"], ["REPAIR", "repair all"], ["FUEL", "buy fuel"], ["ARCHIVE", "archive"], null, ["HOP", "hop"], ["SND", "sound"], ["MENU", "menu"]],
	ending: [["DELIVER", "deliver"], ["BROADCAST", "broadcast"], null, null, ["ARCHIVE", "archive"], null, ["HOP ON", "hop"], ["SND", "sound"], ["MENU", "menu"]],
	over: [["ORIENTATION", "orientation"], ["NEW CONTRACT", "contract"], null, ["ARCHIVE", "archive"], null, null, null, ["SND", "sound"], ["MENU", "menu"]],
};

const WORDS: Record<Mode, readonly string[]> = {
	mission: ["nav", "open", "close", "gather", "read", "motion", "lure", "purge", "rename", "stop", "status", "undock", "labels", "sound", "clear", "help", "menu"],
	drydock: ["repair", "rebuild", "upgrade", "rename", "buy", "hop", "archive", "status", "sound", "clear", "help", "menu", "armour", "thrust", "mk2", "fuel", "all"],
	menu: ["orientation", "contract", "resume", "archive", "data", "sound", "clear"],
	intro: ["skip", "sound"],
	ending: ["deliver", "broadcast", "hop", "archive", "menu", "sound", "clear"],
	over: ["orientation", "contract", "archive", "menu", "sound", "clear"],
};

/** Seconds between the hopper lifting off and what comes next, so the player sees how the boarding ended. */
export const CAST_OFF = { toDrydock: 2.6, toMenu: 3.2, afterLoss: 1.5 } as const;

/** Scrap Cyberdime pays for the sample canisters. */
export const DELIVERY_PAY = 25;

/** The whole game: which screen it's on, the campaign, the boarding in progress, and the story text it has loaded. */
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
	#regions = new Map<RegionId, RegionText>();
	#requested = new Set<string>();
	#loading = new Set<Promise<void>>();
	#waiting: { ready: () => boolean; run: () => void }[] = [];
	#intro: IntroText | null = null;
	#introAt: { t: number; printed: number; cued: number; then: () => void } | null = null;
	#ending: EndingText | null = null;
	#chosen: "deliver" | "broadcast" | null = null;
	#drill: { i: number; before: number } | null = null;

	constructor(sink: Sink, saves: SaveStore, rng: Rng = Math.random) {
		this.sink = sink;
		this.saves = saves;
		this.rng = rng;
	}

	fkeys(): readonly FKey[] {
		return FKEYS[this.mode];
	}

	/** Words Tab can complete: commands first, then this site's rooms and doors. */
	completions(first: boolean): readonly string[] {
		const m = this.mission;
		if (first || this.mode !== "mission" || m === null) return WORDS[this.mode];
		return [...m.rooms.map((r) => `r${r.num}`), ...m.doors.map((d) => d.name), "dock", "all"];
	}

	/**
	 * Where the intro is while it plays: its scene, seconds into that scene (`t`) and into the whole intro (`at`), and
	 * the title cards on screen, each with seconds since it appeared and until it goes.
	 */
	/** Whether orientation's simulated drydock is running, on a contract lent for the lesson. */
	get drilling(): boolean {
		return this.mode === "drydock" && this.#drill !== null;
	}

	/** The orientation step on screen, counted across the hulk and the drydock, or null outside orientation. */
	get lesson(): { step: number; total: number; text: string } | null {
		const t = this.mode === "mission" && this.mission?.end === null ? this.mission.tutorial : null;
		if (t !== null) return { step: t.i + 1, total: t.steps.length + DRILL.length, text: t.steps[t.i]!.text };
		const drill = this.drilling ? this.#drill : null;
		return drill === null ? null : { step: drill.before + drill.i + 1, total: drill.before + DRILL.length, text: DRILL[drill.i]!.text };
	}

	get intro(): { scene: IntroScene; t: number; at: number; length: number; cards: { title: string; sub: string; t: number; left: number }[] } | null {
		const at = this.#introAt, text = this.#intro;
		if (this.mode !== "intro" || at === null || text === null) return null;
		const current = [...text.scenes].reverse().find((s) => at.t >= s.at) ?? text.scenes[0]!;
		const cards = text.cards.filter((c) => at.t >= c.at && at.t < c.until).map((c) => ({ title: c.title, sub: c.sub, t: at.t - c.at, left: c.until - at.t }));
		return { scene: current.scene, t: at.t - current.at, at: at.t, length: text.length, cards };
	}

	/** The story regions whose text is in memory now. */
	loadedRegions(): RegionId[] {
		return [...this.#regions.keys()];
	}

	/** Settles once nothing is loading: for tests and journeys that must see the text arrive. */
	async ready(): Promise<void> {
		while (this.#loading.size > 0) await Promise.all([...this.#loading]);
	}

	tick(dt: number): void {
		for (const wait of this.#waiting.filter((w) => w.ready())) {
			this.#waiting.splice(this.#waiting.indexOf(wait), 1);
			wait.run();
		}
		if (this.#pending !== null) {
			this.#pending.left -= dt;
			if (this.#pending.left <= 0) {
				const { run } = this.#pending;
				this.#pending = null;
				run();
			}
		}
		if (this.mode === "intro") this.#playIntro(dt);
		const m = this.mission;
		if (this.mode !== "mission" || m === null) {
			this.threat = false;
			return;
		}
		this.threat = tickMission(m, dt, this.sink, this.rng);
		for (const done of m.reads.splice(0)) this.#archiveRead(m, done.drone, done.room);
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

	/** Skips the intro, if it's playing. */
	skip(): void {
		if (this.mode === "intro") this.#endIntro();
	}

	showMenu(): void {
		if (this.#drill !== null) this.campaign = null;
		this.#drill = null;
		this.mission = null;
		this.over = null;
		this.#pending = null;
		this.#introAt = null;
		this.mode = "menu";
		this.sink.clear();
		const save = this.saves.campaign(), best = this.saves.best(), tutorialDone = this.saves.tutorialDone(), logs = this.saves.archive().length;
		const lines: [string, LogKind][] = [
			["SCT-7 SALVAGE CONTROL TERMINAL · SALVAGE-OS v2.1", "head"],
			["Contract 7731-K: the Lacuna complex, an ice moon gone silent. Three drones and a hopper.", "note"],
			[`  1  TERMINAL ORIENTATION  the SCT-7 operator manual, on a simulated hulk${tutorialDone ? " (completed)" : " — recommended"}`, tutorialDone ? "ok" : "head"],
			["  2  NEW CONTRACT          21 sites across the Surface, the Underworks and the Bore", "ok"],
		];
		if (save !== null) lines.push([`  3  RESUME CONTRACT       site ${save.jump} · ${save.scrap} scrap · ${save.fuel} fuel · ${save.drones.filter((d) => d.alive).length}/3 drones`, "ok"]);
		lines.push([`  4  ARCHIVE               ${logs} log${logs === 1 ? "" : "s"} recovered`, "ok"], ["  5  MISSION DATA          contract 7731-K transmission, replayed", "ok"]);
		if (best !== null) lines.push([`Furthest site reached: ${best.jump} · ${best.scrap} scrap salvaged`, "note"]);
		lines.push(["Type a number (or its name) and press Enter.", "note"]);
		for (const [text, kind] of lines) this.sink.log(text, kind, true);
	}

	#after(seconds: number, run: () => void): void {
		this.#pending = { left: seconds, run };
	}

	#when(ready: () => boolean, run: () => void): void {
		if (ready()) run();
		else this.#waiting.push({ ready, run });
	}

	#load<T>(key: string, start: () => Promise<T>, keep: (value: T) => void): void {
		if (this.#requested.has(key)) return;
		this.#requested.add(key);
		const work: Promise<void> = start()
			.then(keep)
			.catch((error: unknown) => {
				this.#requested.delete(key);
				this.sink.log(`Data link lost loading ${key}: ${error instanceof Error ? error.message : String(error)}`, "warn");
			})
			.finally(() => this.#loading.delete(work));
		this.#loading.add(work);
	}

	#want(id: RegionId): void {
		if (!this.#regions.has(id)) this.#load(`region:${id}`, () => loadRegion(id), (text) => this.#regions.set(id, text));
	}

	/** Keeps only the text for site `site`'s region and the next one in memory. */
	#keepNear(site: number): void {
		const keep = new Set([regionOf(site).id, regionOf(site + 1).id]);
		for (const id of keep) this.#want(id);
		for (const id of [...this.#regions.keys()]) {
			if (!keep.has(id)) {
				this.#regions.delete(id);
				this.#requested.delete(`region:${id}`);
			}
		}
	}

	#lookup(id: string): Log | null {
		if (id === BRIEFING.id) return BRIEFING;
		for (const text of this.#regions.values()) {
			const found = [...text.story, ...text.crew].find((l) => l.id === id);
			if (found !== undefined) return found;
		}
		return null;
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
		if (this.mode === "intro") {
			this.#endIntro();
			return;
		}
		if (cmd === "archive" && this.mode !== "mission") {
			this.#showArchive(args[0]);
			return;
		}
		const m = this.mission, camp = this.campaign;
		if (this.mode === "mission" && m !== null) {
			missionCommand({ m, sink: this.sink, rng: this.rng, finish: () => this.#finish("undock"), leave: () => this.#leaveMission(), toggleLabels: () => (this.labels = !this.labels), renamed: (id, name) => this.#renamed(m, id, name) }, cmd, args, word);
		} else if (this.mode === "drydock" && camp !== null && this.#drill !== null) this.#drillCommand(camp, cmd, args);
		else if (this.mode === "drydock" && camp !== null) {
			drydockCommand({ camp, sink: this.sink, jump: () => this.#jump(), leave: () => this.showMenu(), save: () => this.saves.keepCampaign(camp) }, cmd, args);
		} else if (this.mode === "ending" && camp !== null) this.#endingCommand(camp, cmd);
		else this.#menuCommand(cmd);
	}

	#menuCommand(cmd: string): void {
		if (cmd === "1" || cmd === "orientation" || cmd === "manual" || cmd === "tutorial") this.#startTutorial();
		else if (cmd === "2" || cmd === "contract" || cmd === "new" || cmd === "campaign") {
			if (this.saves.introSeen()) this.#newCampaign();
			else this.#startIntro(() => this.#newCampaign());
		} else if ((cmd === "3" || cmd === "resume" || cmd === "continue") && this.mode === "menu") this.#continue();
		else if (cmd === "4") this.#showArchive(undefined);
		else if (cmd === "5" || cmd === "data" || cmd === "mission" || cmd === "briefing" || cmd === "intro") this.#startIntro(() => this.showMenu());
		else if (cmd === "menu") this.showMenu();
		else if (cmd === "help") this.sink.log("Type 1 orientation, 2 new contract, 3 resume, 4 archive or 5 mission data.", "note");
		else {
			this.sink.log(`Unknown option "${cmd}".`, "warn");
			this.sink.sound("err");
		}
	}

	#startIntro(then: () => void): void {
		this.mission = null;
		this.#pending = null;
		this.mode = "intro";
		this.sink.clear();
		this.#introAt = { t: 0, printed: 0, cued: 0, then };
		if (this.#intro === null) this.#load("intro", loadIntro, (text) => (this.#intro = text));
		if (!this.sink.soundOn()) this.sink.log("Sound is off. Press F8 (or type SOUND) to hear the transmission; Enter skips it.", "note");
	}

	#playIntro(dt: number): void {
		const at = this.#introAt, text = this.#intro;
		if (at === null || text === null) return;
		at.t += dt;
		while (at.printed < text.lines.length && text.lines[at.printed]!.at <= at.t) {
			const line = text.lines[at.printed++]!;
			this.sink.log(line.text, line.kind, line.typed);
		}
		while (at.cued < text.cues.length && text.cues[at.cued]!.at <= at.t) this.sink.sound(text.cues[at.cued++]!.sound);
		if (at.t >= text.length) this.#endIntro();
	}

	#endIntro(): void {
		const at = this.#introAt;
		this.#introAt = null;
		this.#intro = null;
		this.#requested.delete("intro");
		this.saves.markIntroSeen();
		if (at !== null) at.then();
	}

	#showArchive(id: string | undefined): void {
		for (const region of REGIONS) this.#want(region.id);
		this.sink.log("Opening the archive…", "note");
		this.#when(
			() => REGIONS.every((r) => this.#regions.has(r.id)),
			() => {
				const read = new Set(this.saves.archive());
				const pick = id?.toUpperCase();
				if (pick !== undefined) {
					const log = read.has(pick) ? this.#lookup(pick) : null;
					if (log === null) this.sink.log(`No archived log ${pick}.`, "warn");
					else this.#printLog(log, false);
					return;
				}
				const all = [...this.#regions.values()];
				const story = all.flatMap((t) => t.story).filter((l) => read.has(l.id)).sort((a, b) => a.id.localeCompare(b.id));
				const crew = all.flatMap((t) => t.crew).filter((l) => read.has(l.id));
				this.sink.log(`ARCHIVE · entries ${story.length} · crew ${crew.length}${read.has(BRIEFING.id) ? " · briefing" : ""}`, "head");
				for (const l of story) this.sink.log(`  ${l.id}  ${l.title} — ${l.author}`, "ok");
				for (const l of crew) this.sink.log(`  ${l.id}  ${l.title} — ${l.author}`, "drone");
				if (read.has(BRIEFING.id)) this.sink.log(`  ${BRIEFING.id}  ${BRIEFING.title} — ${BRIEFING.author}`, "drone");
				const first = story[0] ?? crew[0] ?? (read.has(BRIEFING.id) ? BRIEFING : null);
				this.sink.log(first === null ? "Nothing recovered yet. Drones READ powered terminals to fill the archive." : `Type ARCHIVE <id> to read one, e.g. archive ${first.id}.`, "note");
				if (this.campaign !== null && this.mode !== "menu") this.#keepNear(this.campaign.jump);
			},
		);
	}

	/** A drone renamed during a boarding keeps the name on the contract too; orientation's drones are its own. */
	#renamed(m: Mission, id: number, name: string): void {
		const spec = m.tutorial === null ? this.campaign?.drones.find((d) => d.id === id) : undefined;
		if (spec !== undefined) spec.name = name;
	}

	/** Orientation's simulated drydock: a contract lent for the lesson with the hulk's drones and scrap, never saved. */
	#enterDrill(m: Mission): void {
		const drones = m.drones.map(specOf).map((d) => (d.alive ? d : { ...d, alive: true, hull: 100 }));
		this.campaign = { seed: 0, jump: 0, fuel: 1, scrap: m.bank.scrap + DRILL_CREDIT, drones, stats: { scrap: 0, rooms: 0, kills: 0 }, ended: false };
		this.#drill = { i: 0, before: m.tutorial?.steps.length ?? 0 };
		this.mission = null;
		this.mode = "drydock";
		this.sink.clear();
		const typed = (text: string, kind: LogKind) => this.sink.log(text, kind, true);
		typed("SIMULATED DRYDOCK · ORIENTATION. Nothing bought here carries into a real contract.", "head");
		typed(`Scrap ${this.campaign.scrap} (${m.bank.scrap} recovered + ${DRILL_CREDIT} orientation credit) · fuel 1 · drones 3/3.`, "ok");
		typed("Type HELP for every drydock command.", "note");
	}

	#drillCommand(camp: Campaign, cmd: string, args: string[]): void {
		if (cmd === "menu") return this.showMenu();
		if (cmd === "jump") return this.#endDrill();
		drydockCommand({ camp, sink: this.sink, jump: () => this.#endDrill(), leave: () => this.showMenu(), save: () => {} }, cmd, args);
		const drill = this.#drill, step = drill === null ? undefined : DRILL[drill.i];
		if (drill !== null && step !== undefined && drill.i < DRILL.length - 1 && step.done(camp, cmd)) {
			this.sink.log(`✓ ${step.text.split("   ")[0]}`, "ok");
			this.sink.sound("ping");
			drill.i++;
		}
	}

	#endDrill(): void {
		this.#drill = null;
		this.campaign = null;
		this.sink.log("Orientation complete. Lacuna is bigger, darker and less forgiving.", "loot");
		this.sink.sound("jump");
		this.#after(CAST_OFF.toMenu, () => this.showMenu());
	}

	#printLog(log: Log, fresh: boolean): void {
		this.sink.log(`▤ ${log.id} · ${log.title.toUpperCase()} — ${log.author}`, "head", fresh);
		for (const line of log.lines) this.sink.log(`  ${line}`, "loot", fresh);
	}

	#archiveRead(m: Mission, droneId: number, room: number): void {
		const terminal = m.rooms[room]?.terminal;
		if (terminal === null || terminal === undefined || terminal.read) return;
		const log = this.#lookup(terminal.log);
		if (log === null) {
			this.sink.log(`Drone ${droneId}: terminal data scrambled. Try again in a moment.`, "warn");
			return;
		}
		terminal.read = true;
		const known = this.saves.archive().includes(log.id);
		this.saves.keepLog(log.id);
		this.#printLog(log, true);
		if (terminal.story) {
			const count = this.saves.archive().filter((id) => id.startsWith("S")).length;
			this.sink.log(known ? "Already in the archive." : ` ARCHIVE ENTRY ${count} RECOVERED `, known ? "note" : "alarm", true);
		}
		this.sink.sound("ping");
	}

	#placeTerminals(m: Mission): void {
		const text = this.#regions.get(regionOf(m.site).id);
		if (text === undefined) return;
		const read = new Set(this.saves.archive());
		const rooms = m.rooms.map((_, i) => i).filter((i) => i !== m.start && m.depth[i]! >= 1);
		if (rooms.length === 0) return;
		const story = text.story.find((l) => !read.has(l.id) && l.from <= m.site);
		const deepest = [...rooms].sort((a, b) => m.depth[b]! - m.depth[a]!)[0]!;
		if (story !== undefined) m.rooms[deepest]!.terminal = { log: story.id, story: true, read: false };
		const unread = text.crew.filter((l) => !read.has(l.id));
		const crew = (unread.length > 0 ? unread : text.crew)[Math.floor(this.rng() * (unread.length > 0 ? unread.length : text.crew.length))];
		const free = rooms.filter((i) => m.rooms[i]!.terminal === null);
		if (crew !== undefined && free.length > 0 && (story === undefined || this.rng() < 0.65)) m.rooms[free[Math.floor(this.rng() * free.length)]!]!.terminal = { log: crew.id, story: false, read: false };
	}

	#board(ship: Ship, o: Difficulty, specs: readonly DroneSpec[], name: string, site: number, tutorial: Tutorial | null): Mission {
		const drones: Drone[] = specs.map((s) => ({ ...s, x: 0, y: 0, node: ship.dock, path: [], state: "DOCKED", cargo: 0, fuel: 0, gather: 0, gatherFor: 0, dir: 0, hit: 0, dest: null, wreck: false }));
		const m: Mission = { ...ship, o, ship: name, site, reads: [], drones, bank: { scrap: 0, fuel: 0 }, t: 0, fx: [], lure: null, motionCd: 0, suspect: new Map(), end: null, undockArm: false, menuArm: false, scanned: false, tutorial };
		dockDrones(m);
		this.mission = m;
		this.#pending = null;
		this.mode = "mission";
		this.sink.clear();
		return m;
	}

	#startTutorial(): void {
		const { ship, tutorial } = buildTutorial(this.rng);
		this.#board(ship, TUTORIAL_DIFFICULTY, baseDrones(), "TRAINING HULK PRIMER", 0, tutorial);
		this.sink.log("TRAINING TETHER: TRAINING HULK PRIMER. Simulated hazards; real lessons.", "head", true);
		this.sink.log("Follow the highlighted line under the log. The map pulses where to look.", "note", true);
	}

	#newCampaign(): void {
		this.campaign = { seed: Math.floor(this.rng() * 1e6), jump: 0, fuel: START_FUEL, scrap: 0, drones: baseDrones(), stats: { scrap: 0, rooms: 0, kills: 0 }, ended: false };
		this.sink.log("New contract. The hopper burns its first fuel cell toward Lacuna…", "head");
		this.#jump(true);
	}

	#continue(): void {
		const save = this.saves.campaign();
		if (save === null) {
			this.sink.log("No contract on file.", "warn");
			return;
		}
		this.campaign = structuredClone(save);
		this.#enterDrydock(true);
	}

	#jump(first = false): void {
		const camp = this.campaign!;
		if (camp.fuel < 1) {
			this.sink.log("No fuel. BUY FUEL or the hopper stays grounded.", "warn");
			this.sink.sound("err");
			return;
		}
		if (!camp.drones.some((d) => d.alive)) {
			this.sink.log("No working drones. REBUILD one first.", "warn");
			this.sink.sound("err");
			return;
		}
		camp.fuel--;
		camp.jump = camp.ended ? camp.jump + 1 : Math.min(camp.jump + 1, FINAL_SITE);
		this.sink.sound("jump");
		const site = camp.jump, region = regionOf(site);
		this.#keepNear(site);
		const o = difficulty(site, this.rng());
		const ship = generate((camp.seed + site * 7919) % 999983, o, false, this.rng);
		const m = this.#board(ship, o, camp.drones, siteName(site), site, null);
		this.#when(
			() => this.#regions.has(region.id),
			() => {
				if (this.mission !== m) return;
				this.#placeTerminals(m);
				const typed = (text: string, kind: LogKind) => this.sink.log(text, kind, true);
				if (site === region.first) for (const line of this.#regions.get(region.id)!.beat) typed(line, "head");
				const firstDoor = m.doors.find((d) => !d.air && (d.a === m.start || d.b === m.start));
				typed(`SITE ${site}${site <= FINAL_SITE ? `/${FINAL_SITE}` : ""} · ${m.ship} · ${region.name}`, "head");
				typed(`${o.creatures} biological trace${o.creatures > 1 ? "s" : ""} on the sweep${o.rad ? `, ${o.rad} radiation leak${o.rad > 1 ? "s" : ""}` : ""}. Fuel left after this hop: ${camp.fuel}.`, "warn");
				typed(first ? `TYPE HELP OR PRESS F1.  Try:  nav 1 r${m.rooms[m.start]!.num}  ·  open ${firstDoor?.name ?? "d1"}  ·  motion  ·  read` : "Drones standing by in the dock behind a1. Powered terminals hold the crew's logs: READ them.", "note");
			},
		);
	}

	#finish(kind: "undock" | "lost"): void {
		const m = this.mission!;
		if (m.end !== null) return;
		m.end = kind;
		if (kind === "undock") {
			for (const d of m.drones.filter((x) => x.alive && x.node !== m.dock)) {
				d.alive = false;
				d.state = "LOST";
				this.sink.log(`${d.name} left behind at ${m.ship}. Signal fades.`, "warn");
			}
			this.sink.log(`════════ LIFTED OFF FROM ${m.ship} ════════`, "head");
			this.sink.sound("ping");
		} else this.sink.log("════════ ALL DRONE SIGNALS LOST — HOPPER LIFTS OFF ════════", "alarm");
		const surveyed = m.rooms.filter((r) => r.seen).length, kills = m.creatures.filter((c) => !c.alive).length;
		this.sink.log(`Recovered ${m.bank.scrap} scrap, ${m.bank.fuel} fuel · ${surveyed}/${m.rooms.length} rooms surveyed`, "head");
		if (m.tutorial !== null) {
			this.saves.finishTutorial();
			if (kind === "undock") {
				this.sink.log("Hulk cleared. One more stop: the drydock, where scrap becomes repairs, upgrades and fuel.", "loot");
				this.#after(CAST_OFF.toDrydock, () => this.#enterDrill(m));
			} else {
				this.sink.log("Training drones lost. That is the lesson: close doors behind you.", "loot");
				this.#after(CAST_OFF.toMenu, () => this.showMenu());
			}
			return;
		}
		const camp = this.campaign!;
		camp.drones = m.drones.map(specOf);
		camp.scrap += m.bank.scrap;
		camp.fuel += m.bank.fuel;
		camp.stats.scrap += m.bank.scrap;
		camp.stats.rooms += surveyed;
		camp.stats.kills += kills;
		const finale = kind === "undock" && m.site === FINAL_SITE && !camp.ended;
		this.#after(CAST_OFF.toDrydock, () => (finale ? this.#enterEnding() : this.#enterDrydock(false)));
	}

	#leaveMission(): void {
		const m = this.mission;
		if (m !== null && m.tutorial === null && this.campaign !== null) this.sink.log("Back to the last drydock save.", "note");
		this.showMenu();
	}

	#enterEnding(): void {
		this.mission = null;
		this.mode = "ending";
		this.#chosen = null;
		this.sink.clear();
		this.saves.keepCampaign(this.campaign);
		if (this.#ending === null) this.#load("ending", loadEnding, (text) => (this.#ending = text));
		this.#when(() => this.#ending !== null, () => {
			for (const line of this.#ending!.prompt) this.sink.log(line, "head", true);
		});
	}

	#endingCommand(camp: Campaign, cmd: string): void {
		const text = this.#ending;
		if ((cmd === "deliver" || cmd === "broadcast") && text !== null) {
			if (this.#chosen !== null) {
				this.sink.log("The choice is made.", "note");
				return;
			}
			this.#chosen = cmd;
			const knew = this.saves.archive().includes(FINAL_LOG);
			const words = cmd === "deliver" ? text.deliver : knew ? text.broadcast : text.broadcastBlind;
			if (cmd === "deliver") camp.scrap += DELIVERY_PAY;
			camp.ended = true;
			this.saves.keepEnding(cmd);
			this.saves.keepCampaign(camp);
			for (const line of words) this.sink.log(line, "loot", true);
			if (cmd === "deliver") this.sink.log(`+${DELIVERY_PAY} scrap`, "ok", true);
			for (const line of text.after) this.sink.log(line, "head", true);
		} else if ((cmd === "jump" || cmd === "continue") && this.#chosen !== null) this.#enterDrydock(false);
		else if (cmd === "menu") this.showMenu();
		else this.sink.log(this.#chosen === null ? "DELIVER or BROADCAST?" : "HOP on into the deep sectors, or MENU.", "warn");
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
		this.#keepNear(camp.jump);
		const next = camp.ended ? camp.jump + 1 : Math.min(camp.jump + 1, FINAL_SITE);
		const typed = (text: string, kind: LogKind) => this.sink.log(text, kind, true);
		typed(resumed ? `Contract resumed · site ${camp.jump}.` : "Hopper clear of the site. Drydock systems online.", "head");
		typed(`Scrap ${camp.scrap} · fuel ${camp.fuel} · drones ${alive}/3. Spend scrap on repairs, rebuilds and upgrades.`, "ok");
		typed(camp.fuel > 0 ? `Next: site ${next}, ${siteName(next)}. Type HOP (F7) when ready. Progress saves here.` : `No fuel — BUY FUEL (${PRICE.fuel} scrap) before you can hop.`, camp.fuel > 0 ? "note" : "warn");
		typed("Type HELP for drydock commands, ARCHIVE for the logs you've recovered.", "note");
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
		this.sink.log(` CONTRACT TERMINATED — ${reason} `, "alarm", true);
		this.sink.log(`Sites reached: ${this.over.jump} · scrap salvaged: ${this.over.scrap} · rooms surveyed: ${this.over.rooms} · lifeforms killed: ${this.over.kills}`, "head", true);
		this.sink.log("The logs you read stay in the ARCHIVE. Type CONTRACT for a new contract, ORIENTATION, or MENU.", "note", true);
	}
}

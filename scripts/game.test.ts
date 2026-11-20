// The game's modes, rules and saves, played through commands on its own clock: run with npm test.
import assert from "node:assert/strict";
import { test } from "node:test";
import { askedCommand, type Best, type Campaign, CAST_OFF, DELIVERY_PAY, difficulty, FINAL_SITE, findPath, Game, type LogKind, PRICE, lureReach, READ_SECONDS, roomThreat, type SaveStore, seeded, type Sink, type Sound, START_FUEL, SUSPECT_SECONDS, type Typing } from "../src/features/game/shared/index.ts";
import { mix } from "../src/features/console/client/soundscape.ts";

class Recorder implements Sink {
	lines: { text: string; kind: LogKind; typed: Typing }[] = [];
	sounds: Sound[] = [];
	log(text: string, kind: LogKind, typed: Typing = false): void {
		this.lines.push({ text, kind, typed });
	}
	sound(name: Sound): void {
		this.sounds.push(name);
	}
	soundOn(): boolean {
		return false;
	}
	clear(): void {
		this.lines = [];
	}
	toggleSound(): boolean {
		return false;
	}
	saw(pattern: RegExp): boolean {
		return this.lines.some((l) => pattern.test(l.text));
	}
}

class MemorySaves implements SaveStore {
	saved: Campaign | null = null;
	record: Best | null = null;
	done = false;
	writes = 0;
	logs: string[] = [];
	seen = true;
	ends: string[] = [];
	archive(): readonly string[] {
		return this.logs;
	}
	keepLog(id: string): void {
		if (!this.logs.includes(id)) this.logs.push(id);
	}
	introSeen(): boolean {
		return this.seen;
	}
	markIntroSeen(): void {
		this.seen = true;
	}
	endings(): readonly string[] {
		return this.ends;
	}
	keepEnding(e: string): void {
		this.ends.push(e);
	}
	campaign(): Campaign | null {
		return this.saved === null ? null : structuredClone(this.saved);
	}
	best(): Best | null {
		return this.record;
	}
	tutorialDone(): boolean {
		return this.done;
	}
	keepCampaign(c: Campaign | null): void {
		this.saved = c === null ? null : structuredClone(c);
		this.writes++;
	}
	keepBest(b: Best): void {
		this.record = b;
	}
	finishTutorial(): void {
		this.done = true;
	}
}

function setup(): { game: Game; sink: Recorder; saves: MemorySaves } {
	const sink = new Recorder(), saves = new MemorySaves();
	const game = new Game(sink, saves, seeded(99));
	game.showMenu();
	return { game, sink, saves };
}

function run(game: Game, seconds: number): void {
	for (let t = 0; t < seconds; t += 0.05) game.tick(0.05);
}

test("the tutorial walks through all seven steps by doing what each one asks", () => {
	const { game, saves } = setup();
	game.command("1");
	const tutorial = game.mission!.tutorial!;
	for (let step = 0; step < tutorial.steps.length - 1; step++) {
		assert.equal(tutorial.i, step);
		game.command(askedCommand(tutorial.steps[step]!.text));
		run(game, 8);
		assert.equal(tutorial.i, step + 1, `step ${step + 1} did not complete`);
	}
	for (const part of askedCommand(tutorial.steps[tutorial.i]!.text).split("; ")) {
		game.command(part);
		run(game, 8);
	}
	run(game, CAST_OFF.toMenu);
	assert.equal(game.mode, "menu");
	assert.equal(saves.done, true);
});

test("an empty-handed first boarding still reaches the drydock and is saved there", () => {
	const { game, saves } = setup();
	game.command("2");
	assert.equal(game.mode, "mission");
	assert.equal(game.campaign!.fuel, START_FUEL - 1);
	game.command("undock");
	assert.equal(game.mode, "mission");
	run(game, CAST_OFF.toDrydock + 0.2);
	assert.equal(game.mode, "drydock");
	assert.equal(saves.saved?.jump, 1);
	assert.equal(saves.saved?.fuel, START_FUEL - 1);
});

test("cargo counts only once it reaches the dock, and drones left aboard are lost", () => {
	const { game } = setup();
	game.command("2");
	const m = game.mission!;
	const [wren, moth] = m.drones;
	moth!.cargo = 4;
	moth!.fuel = 1;
	wren!.cargo = 3;
	wren!.node = m.start;
	run(game, 0.1);
	assert.deepEqual(m.bank, { scrap: 4, fuel: 1 });
	game.command("undock");
	assert.equal(game.mission!.end, null, "undocking with a drone aboard asks first");
	game.command("undock");
	run(game, CAST_OFF.toDrydock + 0.2);
	const camp = game.campaign!;
	assert.equal(camp.scrap, 4);
	assert.equal(camp.fuel, START_FUEL - 1 + 1);
	assert.equal(camp.drones[0]!.alive, false);
	assert.equal(camp.drones[1]!.alive, true);
});

test("the drydock charges what it says and refuses what can't be paid", () => {
	const { game, sink } = setup();
	game.command("2; undock");
	run(game, CAST_OFF.toDrydock + 0.2);
	const camp = game.campaign!;
	camp.scrap = 9;
	camp.drones[0]!.hull = 40;
	game.command("repair 1");
	assert.equal(camp.drones[0]!.hull, 100);
	assert.equal(camp.scrap, 9 - 3 * PRICE.repairPer25);
	game.command("upgrade 2 armour");
	assert.equal(camp.drones[1]!.armour, 1);
	assert.equal(camp.scrap, 9 - 3 - PRICE.armour);
	game.command("upgrade wren mk2");
	assert.equal(camp.drones[0]!.mk2, false);
	assert.ok(sink.saw(/needs 5 scrap, you have 2/));
	game.command("buy fuel");
	assert.equal(camp.fuel, START_FUEL - 1);
	assert.equal(camp.scrap, 2);
});

test("each hop burns fuel and flies to the next, bigger site", () => {
	const { game } = setup();
	game.command("2");
	const first = game.mission!;
	game.command("undock");
	run(game, CAST_OFF.toDrydock + 0.2);
	game.command("hop");
	const second = game.mission!;
	assert.equal(game.campaign!.jump, 2);
	assert.equal(game.campaign!.fuel, START_FUEL - 2);
	assert.equal(second.ship, "LANDING PAD CONTROL");
	assert.ok(second.o.W > first.o.W);
});

test("lifeforms grow more numerous, faster and deadlier across the three regions", () => {
	const [surface, underworks, bore] = [1, 8, 15].map((site) => difficulty(site));
	for (const key of ["creatures", "chase", "dmg"] as const) {
		assert.ok(surface![key] < underworks![key] && underworks![key] < bore![key], key);
	}
});

test("with no fuel and nothing to buy it with, the campaign ends and the best run is kept", () => {
	const { game, saves } = setup();
	game.command("2; undock");
	run(game, CAST_OFF.toDrydock + 0.2);
	game.command("jump; undock");
	run(game, CAST_OFF.toDrydock + 0.2);
	assert.equal(game.mode, "over");
	assert.match(game.over!.reason, /STRANDED/);
	assert.equal(saves.saved, null);
	assert.deepEqual(saves.record, { jump: 2, scrap: 0 });
});

test("losing every drone casts off on its own and counts as a lost fleet", () => {
	const { game } = setup();
	game.command("2");
	for (const d of game.mission!.drones) d.hull = -1;
	run(game, CAST_OFF.afterLoss + CAST_OFF.toDrydock + 0.5);
	assert.equal(game.mode, "over");
	assert.match(game.over!.reason, /FLEET LOST/);
});

test("a closed door stops a drone, and a door can't close on one", () => {
	const { game, sink } = setup();
	game.command("2");
	const m = game.mission!;
	const door = m.doors.find((d) => !d.air && (d.a === m.start || d.b === m.start))!;
	const beyond = door.a === m.start ? door.b : door.a;
	door.open = false;
	game.command(`nav 1 r${m.rooms[beyond]!.num}`);
	assert.ok(sink.saw(/no open route/));
	game.command(`open ${door.name}; nav 1 r${m.rooms[beyond]!.num}`);
	const wren = m.drones[0]!;
	for (let t = 0; t < 10 && Math.hypot(wren.x - door.x, wren.y - door.y) > 0.3; t += 0.02) game.tick(0.02);
	game.command(`close ${door.name}`);
	assert.equal(door.open, true);
	assert.ok(sink.saw(/obstructed/));
});

test("the map marks a room red while a lifeform is in sight, and suspected after a scan or once sight is lost", () => {
	const { game } = setup();
	game.command("2");
	const m = game.mission!, room = m.start, centre = m.rooms[room]!, wren = m.drones[0]!;
	const [lifeform, ...rest] = m.creatures;
	for (const c of rest) c.alive = false;
	Object.assign(lifeform!, { node: room, x: centre.cx, y: centre.cy, path: [] });
	for (const d of m.doors) if (d.a === room || d.b === room) d.open = false;
	const place = (node: number) => Object.assign(wren, { node, x: node === m.dock ? wren.x : centre.cx, y: node === m.dock ? wren.y : centre.cy, path: [], state: "IDLE" });
	const home = { x: wren.x, y: wren.y };

	game.command("motion");
	assert.deepEqual(roomThreat(m, room), { seen: false, suspected: 1 });
	run(game, 5);
	const fading = roomThreat(m, room).suspected;
	assert.ok(fading > 0.6 && fading < 0.9, `suspicion after 5 s: ${fading}`);

	place(room);
	game.tick(0.05);
	assert.equal(roomThreat(m, room).seen, true);
	Object.assign(wren, { node: m.dock, x: home.x, y: home.y });
	game.tick(0.05);
	assert.equal(roomThreat(m, room).seen, false);
	assert.ok(roomThreat(m, room).suspected > 0.95, "losing sight leaves the room freshly suspected");
	run(game, SUSPECT_SECONDS + 1);
	assert.equal(roomThreat(m, room).suspected, 0, "suspicion runs out");

	m.motionCd = 0;
	game.command("motion");
	lifeform!.alive = false;
	place(room);
	game.tick(0.05);
	assert.deepEqual(roomThreat(m, room), { seen: false, suspected: 0 }, "a drone that looks in and finds nothing clears it");
});

test("the background sound follows the boarding: hum aboard, servos while moving, and a tracker that quickens near lifeforms", () => {
	const { game } = setup();
	assert.deepEqual(mix(game, 0), { ambient: 0, servo: 0, grind: 0, reading: 0, crackle: 0, tracker: 0 }, "silent at the menu");
	game.command("2");
	const m = game.mission!, wren = m.drones[0]!;
	for (const c of m.creatures) c.alive = false;
	assert.equal(mix(game, 0).ambient, 1);
	assert.equal(mix(game, 0).tracker, 0, "nothing sensed while docked");
	game.command(`nav 1 r${m.rooms[m.start]!.num}`);
	game.tick(0.05);
	assert.equal(mix(game, 0).servo, 0.5, "one of two servos' worth while WREN moves");
	Object.assign(wren, { node: m.start, path: [], state: "IDLE" });
	const next = m.adj[m.start]!.map((l) => l.to).find((n) => n < m.rooms.length)!;
	m.suspect.set(next, SUSPECT_SECONDS);
	assert.equal(mix(game, 0).tracker, 0.35, "suspected next door");
	m.suspect.set(m.start, SUSPECT_SECONDS);
	assert.equal(mix(game, 0).tracker, 0.6, "suspected in WREN's own room");
	Object.assign(m.creatures[0]!, { alive: true, vis: true, node: m.start });
	assert.equal(mix(game, 0).tracker, 1, "in sight");
	for (let t = 0; t < 30; t += 0.5) assert.ok(mix(game, t).crackle >= 0 && mix(game, t).crackle <= 1);
});

test("a decoy is heard only through open doors, as far as BUOY's reach", () => {
	const { game } = setup();
	game.command("2");
	const m = game.mission!, buoy = m.drones[2]!;
	Object.assign(buoy, { node: m.start, x: m.rooms[m.start]!.cx, y: m.rooms[m.start]!.cy, path: [], state: "IDLE" });
	assert.equal(lureReach(m).size, 0, "silent before the lure");
	for (const d of m.doors) if (!d.air) d.open = false;
	game.command("lure");
	assert.deepEqual([...lureReach(m)], [[m.start, 0]], "every door shut: only BUOY's room hears it");
	for (const d of m.doors) d.open = true;
	const heard = lureReach(m);
	const reachable = (steps: number) => [...heard.values()].filter((s) => s === steps).length;
	assert.ok(reachable(1) >= 1, "open doors carry it to the next rooms");
	assert.ok([...heard.values()].every((s) => s <= m.lure!.reach), "never past the reach");
	assert.ok(!heard.has(m.dock), "never into the dock");
	for (const [room, steps] of heard) assert.equal(steps, findPath(m, m.start, room, { noDock: true })!.length, "the same routes a lifeform would follow");
	m.lure!.t = 0;
	assert.equal(lureReach(m).size, 0, "gone once the decoy stops");
});

test("drones can be renamed in a boarding or at the drydock, the name answers commands and is saved", () => {
	const { game, sink, saves } = setup();
	game.command("2");
	const m = game.mission!;
	game.command("rename 1 kestrel");
	assert.equal(m.drones[0]!.name, "KESTREL");
	assert.equal(game.campaign!.drones[0]!.name, "KESTREL", "the contract's drone takes the name too");
	game.command(`nav kestrel r${m.rooms[m.start]!.num}`);
	game.tick(0.05);
	assert.equal(m.drones[0]!.state, "MOVING", "commands answer to the new name");
	for (const [line, why] of [["rename 2 kestrel", /already drone 1/], ["rename 3 dock", /reserved/], ["rename 3 r5", /reserved/], ["rename 3 x", /2 to 8/], ["rename 3 waytoolongname", /2 to 8/], ["rename 3 9lives", /starting with a letter/], ["rename", /Usage/]] as const) {
		game.command(line);
		assert.ok(sink.saw(why), line);
	}
	assert.deepEqual(m.drones.map((d) => d.name), ["KESTREL", "MOTH", "BUOY"], "refused names change nothing");
	game.command("nav all dock");
	run(game, 40);
	game.command("undock");
	run(game, CAST_OFF.toDrydock + 0.5);
	assert.equal(game.mode, "drydock");
	game.command("rename moth ox-9");
	assert.deepEqual(saves.campaign()!.drones.map((d) => d.name), ["KESTREL", "OX-9", "BUOY"], "the drydock saves the names");
});

test("a purge kills every lifeform in its room, once", () => {
	const { game, sink } = setup();
	game.command("2");
	const m = game.mission!;
	const lair = m.creatures[0]!.node, room = m.rooms[lair]!;
	room.seen = true;
	room.purge = true;
	game.command(`purge r${room.num}`);
	assert.ok(m.creatures.filter((c) => c.node === lair).every((c) => !c.alive));
	game.command(`purge r${room.num}`);
	assert.ok(sink.saw(/valve already spent/));
});

async function settle(game: Game): Promise<void> {
	await game.ready();
	game.tick(0);
}

async function toDrydockAt(site: number): Promise<{ game: Game; sink: Recorder; saves: MemorySaves }> {
	const t = setup();
	t.game.command("2");
	await settle(t.game);
	t.game.campaign!.jump = site - 1;
	t.game.command("undock");
	run(t.game, CAST_OFF.toDrydock + 0.2);
	t.game.campaign!.fuel = 5;
	return t;
}

test("a first campaign opens with the intro, which plays through or skips into site 1", async () => {
	for (const skip of [false, true]) {
		const { game, sink, saves } = setup();
		saves.seen = false;
		game.command("2");
		assert.equal(game.mode, "intro");
		await settle(game);
		if (skip) game.skip();
		else {
			run(game, 2);
			assert.ok(sink.saw(/INCOMING TRANSMISSION/));
			run(game, 31);
		}
		assert.equal(game.mode, "mission", skip ? "skipped" : "played");
		assert.equal(game.mission!.site, 1);
		assert.equal(saves.seen, true);
	}
});

test("site 1 holds the first story log, and reading it archives it", async () => {
	const { game, sink, saves } = setup();
	game.command("2");
	await settle(game);
	const m = game.mission!;
	const room = m.rooms.findIndex((r) => r.terminal?.story === true);
	assert.ok(room >= 0, "no story terminal at site 1");
	assert.equal(m.rooms[room]!.terminal!.log, "S01");
	const moth = m.drones[1]!;
	Object.assign(moth, { node: room, x: m.rooms[room]!.cx, y: m.rooms[room]!.cy });
	game.command("read 2");
	run(game, READ_SECONDS + 0.2);
	assert.deepEqual(saves.logs.filter((id) => id.startsWith("S")), ["S01"]);
	assert.ok(sink.saw(/Warm water at 2\.1 km/));
	assert.ok(sink.saw(/ARCHIVE ENTRY 1 RECOVERED/));
});

test("story logs come in order, only as deep as the site allows, and never twice", async () => {
	const { game, saves } = setup();
	saves.logs = ["S01", "S02", "S03"];
	game.command("2");
	await settle(game);
	assert.ok(game.mission!.rooms.every((r) => r.terminal?.story !== true), "S04 waits for site 5");
	const later = await toDrydockAt(5);
	later.saves.logs = ["S01", "S02", "S03"];
	later.game.command("hop");
	await settle(later.game);
	assert.deepEqual(later.game.mission!.rooms.filter((r) => r.terminal?.story).map((r) => r.terminal!.log), ["S04"]);
});

test("only the current and next region's text stays in memory", async () => {
	const { game } = await toDrydockAt(8);
	await settle(game);
	assert.deepEqual(game.loadedRegions().sort(), ["surface", "underworks"], "after site 7 the Underworks is fetched ahead");
	game.command("hop");
	await settle(game);
	assert.equal(game.mission!.site, 8);
	assert.deepEqual(game.loadedRegions(), ["underworks"], "the Surface's text is let go");
});

test("undocking from the Bore floor brings the ending, and the run goes on into the deep sectors", async () => {
	const { game, sink, saves } = await toDrydockAt(FINAL_SITE);
	game.command("hop");
	await settle(game);
	assert.equal(game.mission!.ship, "THE BORE FLOOR");
	game.command("undock");
	run(game, CAST_OFF.toDrydock + 0.2);
	await settle(game);
	assert.equal(game.mode, "ending");
	const scrap = game.campaign!.scrap;
	game.command("deliver");
	assert.equal(game.campaign!.scrap, scrap + DELIVERY_PAY);
	assert.deepEqual(saves.ends, ["deliver"]);
	game.command("broadcast");
	assert.ok(sink.saw(/The choice is made/));
	game.command("hop");
	assert.equal(game.mode, "drydock");
	game.command("hop");
	assert.equal(game.mission!.ship, "DEEP SECTOR 1");
});

test("losing the fleet on the Bore floor means trying it again, not skipping the ending", async () => {
	const { game } = await toDrydockAt(FINAL_SITE);
	game.command("hop");
	game.campaign!.scrap = 20;
	for (const d of game.mission!.drones) d.hull = -1;
	run(game, CAST_OFF.afterLoss + CAST_OFF.toDrydock + 0.5);
	assert.equal(game.mode, "drydock");
	game.command("rebuild 1; hop");
	assert.equal(game.mission!.site, FINAL_SITE);
});

test("the archive lists what was found and reads it back", async () => {
	const { game, sink, saves } = setup();
	saves.logs = ["S01", "C-U03"];
	game.command("4");
	await settle(game);
	assert.ok(sink.saw(/ARCHIVE · entries 1 · crew 1$/));
	assert.ok(sink.saw(/S01 {2}/) && !sink.saw(/S02 {2}/) && !sink.saw(/not yet recovered|\/15|\/30/), "only what was recovered is listed, with no totals");
	game.command("archive c-u03");
	await settle(game);
	assert.ok(sink.saw(/Twenty if Okafor keeps sleepwalking/));
});

test("the intro chimes, types slowly, cuts hard to SIGNAL LOST, shows the crust, and plays its sounds in order", async () => {
	const { game, sink, saves } = setup();
	saves.seen = false;
	game.command("2");
	await settle(game);
	assert.ok(sink.saw(/Sound is off\. Press F8/));
	run(game, 14.3);
	const lost = sink.lines.find((l) => /SIGNAL LOST/.test(l.text));
	assert.equal(lost?.typed, false, "the cut is instant");
	assert.equal(sink.lines.find((l) => /^CONTRACT 7731-K/.test(l.text))?.typed, "slow");
	assert.deepEqual(sink.sounds.filter((s) => ["hum", "incoming", "sos", "static"].includes(s)), ["hum", "incoming", "incoming", "sos", "static"]);
	const intro = game.intro!;
	assert.equal(intro.scene, "cut");
	run(game, 2);
	assert.deepEqual(game.intro!.cards.map((c) => c.title), ["LACUNA"]);
	run(game, 4);
	assert.equal(game.intro!.scene, "section");
	run(game, 10);
	assert.ok(sink.sounds.includes("rumble") && sink.sounds.includes("boom"));
});

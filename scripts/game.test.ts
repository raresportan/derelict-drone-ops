// The game's modes, rules and saves, played through commands on its own clock: run with npm test.
import assert from "node:assert/strict";
import { test } from "node:test";
import { askedCommand, type Best, type Campaign, CAST_OFF, Game, type LogKind, PRICE, type SaveStore, seeded, type Sink, START_FUEL } from "../src/features/game/shared/index.ts";

class Recorder implements Sink {
	lines: { text: string; kind: LogKind }[] = [];
	log(text: string, kind: LogKind): void {
		this.lines.push({ text, kind });
	}
	sound(): void {}
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

test("each jump burns fuel and boards a bigger, busier derelict", () => {
	const { game } = setup();
	game.command("2");
	const first = game.mission!;
	game.command("undock");
	run(game, CAST_OFF.toDrydock + 0.2);
	game.command("jump");
	const second = game.mission!;
	assert.equal(game.campaign!.jump, 2);
	assert.equal(game.campaign!.fuel, START_FUEL - 2);
	assert.ok(second.creatures.length > first.creatures.length);
	assert.ok(second.o.W > first.o.W);
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

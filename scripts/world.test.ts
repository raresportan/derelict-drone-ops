// Every derelict can be boarded: run with npm test.
import assert from "node:assert/strict";
import { test } from "node:test";
import { difficulty, findPath, generate, seeded } from "../src/features/game/shared/index.ts";

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 13);

test("every room can be reached from the dock once its doors are open", () => {
	for (const jump of [1, 3, 6]) {
		for (const seed of SEEDS) {
			const ship = generate(seed, difficulty(jump), false, seeded(seed));
			for (const d of ship.doors) d.open = true;
			ship.rooms.forEach((_, i) => assert.notEqual(findPath(ship, ship.dock, i), null, `seed ${seed}, jump ${jump}: room ${i} is cut off`));
		}
	}
});

test("a ship is the same for the same seed", () => {
	const a = generate(4242, difficulty(2), false, seeded(1)), b = generate(4242, difficulty(2), false, seeded(1));
	assert.deepEqual(a.rooms.map((r) => [r.x, r.y, r.w, r.h, r.num]), b.rooms.map((r) => [r.x, r.y, r.w, r.h, r.num]));
	assert.deepEqual(a.doors.map((d) => d.name), b.doors.map((d) => d.name));
});

test("names are unique and the airlock starts open", () => {
	for (const seed of SEEDS) {
		const ship = generate(seed, difficulty(2), false, seeded(seed));
		assert.equal(new Set(ship.rooms.map((r) => r.num)).size, ship.rooms.length);
		assert.equal(new Set(ship.doors.map((d) => d.name)).size, ship.doors.length);
		const airlock = ship.doors.filter((d) => d.air);
		assert.equal(airlock.length, 1);
		assert.equal(airlock[0]!.open, true);
		assert.equal(airlock[0]!.name, "a1");
	}
});

test("each ship carries the fuel and lifeforms its difficulty promises", () => {
	for (const seed of SEEDS) {
		const o = difficulty(1);
		const ship = generate(seed, o, false, seeded(seed));
		const fuel = ship.rooms.flatMap((r) => r.items).filter((i) => i.kind === "fuel").length;
		assert.equal(fuel, o.fuel, `seed ${seed}`);
		assert.equal(ship.creatures.length, o.creatures, `seed ${seed}`);
		assert.ok(ship.creatures.every((c) => c.node !== ship.start), `seed ${seed}: a lifeform waits in the first room`);
	}
});

test("a route only passes open doors unless told otherwise", () => {
	const ship = generate(77, difficulty(2), false, seeded(77));
	for (const d of ship.doors) d.open = d.air;
	const far = ship.rooms.findIndex((_, i) => i !== ship.start);
	assert.equal(findPath(ship, ship.dock, far), null);
	const anyway = findPath(ship, ship.dock, far, { open: false });
	assert.ok(anyway !== null && anyway.length > 1);
	for (const step of anyway) ship.doors[step.door]!.open = true;
	assert.deepEqual(findPath(ship, ship.dock, far), anyway);
});

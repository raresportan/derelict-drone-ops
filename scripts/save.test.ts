// A campaign survives what a file can do to it: run with npm test.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SaveFile } from "../src/features/game/host/store.ts";
import { baseDrones, EMPTY_SAVE, parseSave, type SaveData } from "../src/features/game/shared/index.ts";

const sample = (jump: number): SaveData => ({
	campaign: { seed: 7, jump, fuel: 1, scrap: 12, drones: baseDrones(), stats: { scrap: 20, rooms: 9, kills: 1 }, ended: false },
	best: { jump: 3, scrap: 40 },
	tutorialDone: true,
	archive: ["H-00", "S01", "C-S04"],
	introSeen: true,
	endings: ["deliver"],
});

function inScratch(run: (file: string) => Promise<void>): () => Promise<void> {
	return async () => {
		const folder = mkdtempSync(join(tmpdir(), "ddo-save-"));
		try {
			await run(join(folder, "saves.json"));
		} finally {
			rmSync(folder, { recursive: true, force: true });
		}
	};
}

test("a missing or damaged file reads as no save", inScratch(async (file) => {
	assert.deepEqual(await new SaveFile(file).read(), EMPTY_SAVE);
	for (const damaged of ["{", "null", "[]", '"x"']) {
		writeFileSync(file, damaged);
		assert.deepEqual(await new SaveFile(file).read(), EMPTY_SAVE, damaged);
	}
}));

test("a damaged campaign is dropped but the rest is kept", () => {
	const good = sample(2);
	const cases: unknown[] = [
		{ ...good, campaign: { ...good.campaign, jump: 0 } },
		{ ...good, campaign: { ...good.campaign, fuel: -1 } },
		{ ...good, campaign: { ...good.campaign, drones: good.campaign!.drones.slice(1) } },
		{ ...good, campaign: { ...good.campaign, drones: [{ ...good.campaign!.drones[0], armour: 9 }, ...good.campaign!.drones.slice(1)] } },
		{ ...good, campaign: { ...good.campaign, stats: null } },
	];
	for (const raw of cases) {
		const read = parseSave(raw);
		assert.equal(read.campaign, null, JSON.stringify(raw));
		assert.deepEqual(read.best, good.best);
		assert.equal(read.tutorialDone, true);
	}
	assert.deepEqual(parseSave(good), good);
});

test("the archive keeps only real log ids, once each", () => {
	const read = parseSave({ ...sample(1), archive: ["S01", "S01", "C-U07", "S1", "x", 42, "H-00"], endings: ["deliver", "nope", "broadcast"] });
	assert.deepEqual(read.archive, ["S01", "C-U07", "H-00"]);
	assert.deepEqual(read.endings, ["deliver", "broadcast"]);
});

test("a save is kept for the next run, as whole JSON", inScratch(async (file) => {
	await new SaveFile(file).write(sample(4));
	assert.deepEqual(await new SaveFile(file).read(), sample(4));
	assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), sample(4));
}));

test("writes land in the order asked, and a read waits for them", inScratch(async (file) => {
	const store = new SaveFile(file);
	const writes = [store.write(sample(1)), store.write(sample(2)), store.write(sample(3))];
	assert.equal((await store.read()).campaign?.jump, 3);
	await Promise.all(writes);
	assert.equal((await new SaveFile(file).read()).campaign?.jump, 3);
}));

test("a drone's call sign is kept, and a damaged one falls back to the role name", () => {
	const named = sample(2);
	named.campaign!.drones[0]!.name = "KESTREL";
	named.campaign!.drones[1]!.name = "no good!";
	assert.deepEqual(parseSave(JSON.parse(JSON.stringify(named))).campaign?.drones.map((d) => d.name), ["KESTREL", "MOTH", "BUOY"]);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { interference } from "../src/features/console/client/cam.ts";

const bursts = (channel: number, seconds: number) => {
	const found: number[] = [];
	let start = -1;
	for (let t = 0; t <= seconds; t += 0.05) {
		const on = interference(t, channel) > 0;
		if (on && start < 0) start = t;
		if (!on && start >= 0) {
			found.push(t - start);
			start = -1;
		}
	}
	return found;
};

test("every cam breaks up now and then, for a few seconds at a time, each on its own schedule", () => {
	for (const channel of [1, 2, 3]) {
		const found = bursts(channel, 700);
		assert.ok(found.length >= 25 && found.length <= 80, `channel ${channel}: ${found.length} bursts in 700 s`);
		for (const length of found) assert.ok(length >= 1.4 && length <= 4.6, `channel ${channel}: a burst of ${length.toFixed(2)} s`);
	}
	const together = Array.from({ length: 7000 }, (_, i) => i / 10).filter((t) => [1, 2, 3].every((c) => interference(t, c) > 0)).length;
	assert.ok(together < 7000 * 0.1, `all three cams break up together ${together / 10} s of 700`);
});

/** A random source: each call gives a number in [0, 1). */
export type Rng = () => number;

/** A repeatable random source for `seed`, so the same seed always builds the same ship. */
export function seeded(seed: number): Rng {
	let a = seed | 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A whole number from 0 up to, not including, `n`. */
export const below = (rng: Rng, n: number): number => Math.floor(rng() * n);

/** Shuffles `list` in place and returns it. */
export function shuffle<T>(rng: Rng, list: T[]): T[] {
	for (let i = list.length - 1; i > 0; i--) {
		const j = below(rng, i + 1);
		[list[i], list[j]] = [list[j] as T, list[i] as T];
	}
	return list;
}

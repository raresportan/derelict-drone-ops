/** One beep of the beacon: when it starts after the SOS scene begins, how long it lasts, and how strong it gets through. */
export interface Mark {
	at: number;
	length: number;
	strength: number;
}

const DOT = 0.1;
const START = 0.5;

/**
 * The dying beacon's signal, shared by the sound and the scope so each burst is heard as it's seen: S O S, then a second
 * S O S that fades and breaks off as the hard cut lands.
 */
export const SOS_MARKS: readonly Mark[] = (() => {
	const marks: Mark[] = [];
	const fades = [1, 1, 0.9, 1, 0.8, 1, 0.9, 1, 1, 0.7, 0.55, 0.8, 0.35, 0.5, 0.2, 0.3];
	let at = START, n = 0;
	for (const letter of ["...", "---", "...", "...", "---", "-"]) {
		for (const mark of letter) {
			const length = mark === "." ? DOT : DOT * 3;
			marks.push({ at, length, strength: fades[n++] ?? 0.2 });
			at += length + DOT;
		}
		at += DOT * 2;
	}
	return marks;
})();

/** How strongly the beacon is sounding `t` seconds into the SOS scene: 0 between beeps. */
export function beaconAt(t: number): number {
	return SOS_MARKS.find((m) => t >= m.at && t < m.at + m.length)?.strength ?? 0;
}

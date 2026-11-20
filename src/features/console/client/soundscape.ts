import { type Game, type Mission, roomThreat } from "../../game/shared/index.ts";
import type { Beeper } from "./audio.ts";
import { interference } from "./cam.ts";

/** How loud each part of the background should be this frame, from 0 to 1. */
export interface Mix {
	ambient: number;
	servo: number;
	grind: number;
	reading: number;
	crackle: number;
	tracker: number;
}

const SILENT: Mix = { ambient: 0, servo: 0, grind: 0, reading: 0, crackle: 0, tracker: 0 };

/**
 * How close the nearest lifeform is to any drone, as the tracker hears it: 1 in sight, 0.7 seen next door, 0.6 suspected
 * in the drone's own room, 0.35 suspected next door, 0 nothing sensed nearby.
 */
function closeness(m: Mission): number {
	let level = 0;
	for (const d of m.drones) {
		if (!d.alive || d.node === m.dock) continue;
		const here = roomThreat(m, d.node);
		level = Math.max(level, here.seen ? 1 : here.suspected > 0 ? 0.6 : 0);
		for (const link of m.adj[d.node] ?? []) {
			if (link.to >= m.rooms.length) continue;
			const next = roomThreat(m, link.to);
			level = Math.max(level, next.seen ? 0.7 : next.suspected > 0 ? 0.35 : 0);
		}
	}
	return level;
}

/** The background mix for the game as it stands, `t` seconds in: silent outside a boarding. */
export function mix(game: Game, t: number): Mix {
	const m = game.mode === "mission" ? game.mission : null;
	if (m === null || m.end !== null) return SILENT;
	const live = m.drones.filter((d) => d.alive);
	return {
		ambient: 1,
		servo: Math.min(1, live.filter((d) => d.state === "MOVING").length / 2),
		grind: live.some((d) => d.state === "GATHERING") ? 1 : 0,
		reading: live.some((d) => d.state === "READING") ? 1 : 0,
		crackle: Math.max(0, ...live.map((d) => interference(t, d.id))),
		tracker: closeness(m),
	};
}

/** Plays the mix: loops follow their levels, and chirps, tracker beeps and hull creaks are timed from the frame clock. */
export class Soundscape {
	readonly #beeper: Beeper;
	#chirpAt = 0;
	#beepAt = 0;
	#creakAt = 0;

	constructor(beeper: Beeper) {
		this.#beeper = beeper;
	}

	update(game: Game, now: number): void {
		const t = now / 1000, m = mix(game, t), b = this.#beeper;
		b.loop("ambient", m.ambient);
		b.loop("servo", m.servo);
		b.loop("grind", m.grind);
		b.loop("crackle", m.crackle);
		if (!b.on) return;
		if (m.reading > 0 && t >= this.#chirpAt) {
			b.chirp();
			this.#chirpAt = t + 0.06 + Math.random() * 0.08;
		}
		if (m.tracker > 0 && t >= this.#beepAt) {
			b.tracker(m.tracker);
			this.#beepAt = t + 1.5 - 1.15 * m.tracker;
		} else if (m.tracker === 0) this.#beepAt = Math.min(this.#beepAt, t);
		if (m.ambient > 0 && t >= this.#creakAt) {
			if (this.#creakAt > 0) b.creak();
			this.#creakAt = t + 7 + Math.random() * 12;
		}
	}
}

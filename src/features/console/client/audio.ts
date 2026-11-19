import type { Sound } from "../../game/shared/index.ts";

/** Square-wave beeps, silent until switched on, and made only after a key press asked for them. */
export class Beeper {
	#context: AudioContext | null = null;
	on = false;

	toggle(): boolean {
		this.on = !this.on;
		if (this.on && this.#context === null) this.#context = new AudioContext();
		return this.on;
	}

	play(name: Sound): void {
		const tones: Record<Sound, readonly [number, number, number, OscillatorType, number][]> = {
			key: [[1400, 0.02, 0.012, "square", 0]],
			ok: [[880, 0.06, 0.03, "square", 0]],
			err: [[220, 0.12, 0.04, "square", 0]],
			door: [[140, 0.18, 0.05, "sawtooth", 0], [90, 0.2, 0.04, "triangle", 0.05]],
			alarm: [[1040, 0.12, 0.05, "square", 0], [760, 0.14, 0.05, "square", 0.15], [1040, 0.12, 0.05, "square", 0.3]],
			ping: [[1800, 0.25, 0.03, "sine", 0], [1200, 0.3, 0.02, "sine", 0.12]],
			boom: [[60, 0.5, 0.08, "sawtooth", 0]],
			jump: Array.from({ length: 8 }, (_, i) => [200 + i * 120, 0.12, 0.03, "triangle", i * 0.06] as [number, number, number, OscillatorType, number]),
		};
		for (const [f, d, v, type, when] of tones[name]) this.#tone(f, d, v, type, when);
	}

	#tone(freq: number, duration: number, volume: number, type: OscillatorType, when: number): void {
		const ac = this.#context;
		if (!this.on || ac === null) return;
		const t = ac.currentTime + when, osc = ac.createOscillator(), gain = ac.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t);
		gain.gain.setValueAtTime(volume, t);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
		osc.connect(gain).connect(ac.destination);
		osc.start(t);
		osc.stop(t + duration + 0.02);
	}
}

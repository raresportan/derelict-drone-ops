import type { Sound } from "../../game/shared/index.ts";

type Tone = readonly [freq: number, seconds: number, volume: number, type: OscillatorType, when: number];

const TONES: Partial<Record<Sound, readonly Tone[]>> = {
	key: [[1400, 0.02, 0.012, "square", 0]],
	ok: [[880, 0.06, 0.03, "square", 0]],
	err: [[220, 0.12, 0.04, "square", 0]],
	door: [[140, 0.18, 0.05, "sawtooth", 0], [90, 0.2, 0.04, "triangle", 0.05]],
	alarm: [[1040, 0.12, 0.05, "square", 0], [760, 0.14, 0.05, "square", 0.15], [1040, 0.12, 0.05, "square", 0.3]],
	ping: [[1800, 0.25, 0.03, "sine", 0], [1200, 0.3, 0.02, "sine", 0.12]],
	boom: [[60, 0.5, 0.08, "sawtooth", 0]],
	jump: Array.from({ length: 8 }, (_, i): Tone => [200 + i * 120, 0.12, 0.03, "triangle", i * 0.06]),
};

const DOT = 0.11;

/** S-O-S as beeps: dots and dashes with the gaps morse code puts between them. */
function morse(): Tone[] {
	const tones: Tone[] = [];
	let at = 0;
	for (const letter of ["...", "---", "..."]) {
		for (const mark of letter) {
			const length = mark === "." ? DOT : DOT * 3;
			tones.push([690, length, 0.035, "sine", at]);
			at += length + DOT;
		}
		at += DOT * 2;
	}
	return tones;
}

/** Square-wave beeps and filtered noise, silent until switched on, and made only after a key press asked for them. */
export class Beeper {
	#context: AudioContext | null = null;
	#noise: AudioBuffer | null = null;
	on = false;

	toggle(): boolean {
		this.on = !this.on;
		if (this.on && this.#context === null) this.#context = new AudioContext();
		return this.on;
	}

	play(name: Sound): void {
		if (name === "morse") for (const tone of morse()) this.#tone(...tone);
		else if (name === "hum") {
			this.#tone(55, 7.5, 0.03, "sine", 0, 1.2);
			this.#tone(110, 7.5, 0.012, "sine", 0, 1.2);
		} else if (name === "static") this.#hiss(0.8, 0.07, "highpass", 1800);
		else if (name === "rumble") this.#hiss(4, 0.09, "lowpass", 140, 0.8);
		else for (const tone of TONES[name] ?? []) this.#tone(...tone);
	}

	#tone(freq: number, duration: number, volume: number, type: OscillatorType, when: number, rise = 0): void {
		const ac = this.#context;
		if (!this.on || ac === null) return;
		const t = ac.currentTime + when, osc = ac.createOscillator(), gain = ac.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t);
		gain.gain.setValueAtTime(rise > 0 ? 0.0001 : volume, t);
		if (rise > 0) gain.gain.exponentialRampToValueAtTime(volume, t + rise);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
		osc.connect(gain).connect(ac.destination);
		osc.start(t);
		osc.stop(t + duration + 0.02);
	}

	#hiss(duration: number, volume: number, type: BiquadFilterType, cutoff: number, rise = 0.01): void {
		const ac = this.#context;
		if (!this.on || ac === null) return;
		if (this.#noise === null) {
			this.#noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
			const data = this.#noise.getChannelData(0);
			for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
		}
		const t = ac.currentTime, source = ac.createBufferSource(), filter = ac.createBiquadFilter(), gain = ac.createGain();
		source.buffer = this.#noise;
		source.loop = true;
		filter.type = type;
		filter.frequency.value = cutoff;
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(volume, t + rise);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
		source.connect(filter).connect(gain).connect(ac.destination);
		source.start(t);
		source.stop(t + duration + 0.05);
	}
}

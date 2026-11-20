import type { Sound } from "../../game/shared/index.ts";
import { SOS_MARKS } from "./sos.ts";

export type Loop = "ambient" | "servo" | "grind" | "crackle";

const LOOP_VOLUME: Record<Loop, number> = { ambient: 0.05, servo: 0.018, grind: 0.035, crackle: 0.045 };

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
	incoming: [[1320, 0.09, 0.04, "square", 0], [990, 0.09, 0.04, "square", 0.13], [1320, 0.2, 0.045, "square", 0.26]],
};

/** Square-wave beeps, filtered noise and background loops, silent until switched on, and made only after a key press asked for them. */
export class Beeper {
	#context: AudioContext | null = null;
	#noise: AudioBuffer | null = null;
	readonly #loops = new Map<Loop, GainNode>();
	on = false;

	toggle(): boolean {
		this.on = !this.on;
		if (this.on && this.#context === null) this.#context = new AudioContext();
		if (!this.on) for (const name of this.#loops.keys()) this.loop(name, 0);
		return this.on;
	}

	/** Fades a background loop toward `level` (0 to 1), building it the first time it's wanted. */
	loop(name: Loop, level: number): void {
		const ac = this.#context;
		if (ac === null) return;
		const target = this.on ? level * LOOP_VOLUME[name] : 0;
		let gain = this.#loops.get(name);
		if (gain === undefined) {
			if (target === 0) return;
			gain = this.#build(ac, name);
			this.#loops.set(name, gain);
		}
		gain.gain.setTargetAtTime(target, ac.currentTime, name === "crackle" ? 0.05 : 0.25);
	}

	/** A data chirp from a terminal being read. */
	chirp(): void {
		this.#tone(1600 + Math.random() * 1800, 0.025, 0.01, "square", 0);
	}

	/** One motion-tracker beep, higher and louder the closer the lifeform (`closeness` 0 to 1). */
	tracker(closeness: number): void {
		const pitch = 1150 + closeness * 350, volume = 0.025 + closeness * 0.03;
		this.#tone(pitch, 0.09, volume, "sine", 0);
		this.#tone(pitch * 0.5, 0.18, volume * 0.35, "triangle", 0.02);
	}

	/** The hull settling: a low metal groan with a faint ring. */
	creak(): void {
		const ac = this.#context;
		if (!this.on || ac === null) return;
		const t = ac.currentTime, osc = ac.createOscillator(), filter = ac.createBiquadFilter(), gain = ac.createGain();
		const from = 60 + Math.random() * 40;
		osc.type = "sawtooth";
		osc.frequency.setValueAtTime(from, t);
		osc.frequency.exponentialRampToValueAtTime(from * 0.6, t + 1.1);
		filter.type = "lowpass";
		filter.frequency.value = 380;
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(0.045, t + 0.25);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
		osc.connect(filter).connect(gain).connect(ac.destination);
		osc.start(t);
		osc.stop(t + 1.25);
		this.#tone(290 + Math.random() * 80, 0.9, 0.008, "sine", 0.3);
	}

	#build(ac: AudioContext, name: Loop): GainNode {
		const out = ac.createGain();
		out.gain.value = 0;
		out.connect(ac.destination);
		const noise = (type: BiquadFilterType, cutoff: number, q = 1) => {
			const source = ac.createBufferSource(), filter = ac.createBiquadFilter();
			source.buffer = this.#noiseBuffer(ac);
			source.loop = true;
			filter.type = type;
			filter.frequency.value = cutoff;
			filter.Q.value = q;
			source.connect(filter);
			source.start();
			return filter;
		};
		const osc = (type: OscillatorType, freq: number) => {
			const o = ac.createOscillator();
			o.type = type;
			o.frequency.value = freq;
			o.start();
			return o;
		};
		const wobble = (target: AudioParam, rate: number, depth: number, type: OscillatorType = "sine") => {
			const depthGain = ac.createGain();
			depthGain.gain.value = depth;
			osc(type, rate).connect(depthGain).connect(target);
		};
		if (name === "ambient") {
			const low = ac.createGain();
			low.gain.value = 0.6;
			osc("sine", 46).connect(low).connect(out);
			const harmonic = ac.createGain();
			harmonic.gain.value = 0.25;
			osc("sine", 92.5).connect(harmonic).connect(out);
			noise("lowpass", 110).connect(out);
			wobble(out.gain, 0.13, 0.004);
		} else if (name === "servo") {
			const whine = osc("sawtooth", 170), filter = ac.createBiquadFilter();
			wobble(whine.frequency, 5.5, 22);
			filter.type = "bandpass";
			filter.frequency.value = 900;
			filter.Q.value = 2;
			whine.connect(filter).connect(out);
		} else if (name === "grind") {
			const chop = ac.createGain();
			chop.gain.value = 0.5;
			wobble(chop.gain, 8.5, 0.5, "square");
			noise("bandpass", 650, 3).connect(chop).connect(out);
			const clank = ac.createGain();
			clank.gain.value = 0.3;
			wobble(clank.gain, 2.2, 0.3, "square");
			osc("square", 110).connect(clank).connect(out);
		} else {
			const pops = ac.createGain();
			pops.gain.value = 0.55;
			wobble(pops.gain, 17, 0.45, "square");
			wobble(pops.gain, 6.3, 0.3, "sawtooth");
			noise("highpass", 2200).connect(pops).connect(out);
			noise("bandpass", 700, 0.8).connect(out);
		}
		return out;
	}

	#noiseBuffer(ac: AudioContext): AudioBuffer {
		if (this.#noise === null) {
			this.#noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
			const data = this.#noise.getChannelData(0);
			for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
		}
		return this.#noise;
	}

	play(name: Sound): void {
		if (name === "sos") this.#beacon();
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

	/** The SOS as a weak radio signal: a bed of static, a wavering filtered tone for each beep, and the odd crackle. */
	#beacon(): void {
		const ac = this.#context;
		if (!this.on || ac === null) return;
		this.#hiss(6, 0.03, "bandpass", 1400, 0.3);
		const t0 = ac.currentTime;
		for (const mark of SOS_MARKS) {
			const t = t0 + mark.at, osc = ac.createOscillator(), filter = ac.createBiquadFilter(), gain = ac.createGain();
			osc.type = "square";
			osc.frequency.setValueAtTime(612, t);
			osc.frequency.linearRampToValueAtTime(612 + (Math.random() - 0.5) * 18, t + mark.length);
			filter.type = "bandpass";
			filter.frequency.value = 820;
			filter.Q.value = 4;
			const peak = 0.05 * mark.strength;
			gain.gain.setValueAtTime(0.0001, t);
			gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
			gain.gain.setValueAtTime(peak * (0.6 + Math.random() * 0.4), t + mark.length * 0.5);
			gain.gain.exponentialRampToValueAtTime(0.0001, t + mark.length + 0.02);
			osc.connect(filter).connect(gain).connect(ac.destination);
			osc.start(t);
			osc.stop(t + mark.length + 0.05);
		}
		for (let i = 0; i < 9; i++) this.#hiss(0.05 + Math.random() * 0.08, 0.05, "highpass", 2500, 0.005, 0.4 + Math.random() * 5.4);
	}

	#hiss(duration: number, volume: number, type: BiquadFilterType, cutoff: number, rise = 0.01, delay = 0): void {
		const ac = this.#context;
		if (!this.on || ac === null) return;
		const t = ac.currentTime + delay, source = ac.createBufferSource(), filter = ac.createBiquadFilter(), gain = ac.createGain();
		source.buffer = this.#noiseBuffer(ac);
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

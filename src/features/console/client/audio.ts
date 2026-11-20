import type { Sound } from "../../game/shared/index.ts";
import { SOS_MARKS } from "./sos.ts";

export type Loop = "ambient" | "servo" | "grind" | "crackle";

const LOOP_VOLUME: Record<Loop, number> = { ambient: 0.05, servo: 0.02, grind: 0.04, crackle: 0.06 };
const LOOP_SPACE: Record<Loop, number> = { ambient: 0.3, servo: 0.25, grind: 0.35, crackle: 0.04 };

/** The shape of one sound layer: when it starts, how it swells, holds and dies, and how much of the hull's echo it gets. */
interface Shape {
	at?: number;
	attack?: number;
	hold?: number;
	decay: number;
	volume: number;
	space?: number;
	filter?: readonly [type: BiquadFilterType, freq: number, q?: number];
	filterTo?: number;
}

/** An oscillator layer that can glide in pitch over `glide` seconds and be doubled slightly out of tune for weight. */
interface Tone extends Shape {
	kind: "tone";
	wave: OscillatorType;
	freq: number;
	to?: number;
	glide?: number;
	detune?: number;
}

/** A filtered-noise layer: hiss, hydraulics, rumble, squelch. */
interface Hiss extends Shape {
	kind: "hiss";
}

type Layer = Tone | Hiss;

const tone = (wave: OscillatorType, freq: number, shape: Omit<Tone, "kind" | "wave" | "freq">): Tone => ({ kind: "tone", wave, freq, ...shape });
const hiss = (shape: Omit<Hiss, "kind">): Hiss => ({ kind: "hiss", ...shape });

const KLAXON = (at: number): Layer[] => [
	tone("sawtooth", 392, { to: 523, glide: 0.4, at, attack: 0.03, hold: 0.32, decay: 0.16, volume: 0.022, filter: ["lowpass", 1500], space: 0.45, detune: 9 }),
];

const RECIPES: Partial<Record<Sound, readonly Layer[]>> = {
	key: [hiss({ decay: 0.018, volume: 0.03, filter: ["bandpass", 3200, 1.5], space: 0.05 }), tone("sine", 1900, { decay: 0.012, volume: 0.005 })],
	ok: [tone("sine", 880, { decay: 0.14, volume: 0.026, space: 0.25 }), tone("sine", 1320, { at: 0.07, decay: 0.2, volume: 0.02, space: 0.3 })],
	err: [tone("sawtooth", 98, { attack: 0.01, hold: 0.12, decay: 0.2, volume: 0.03, filter: ["lowpass", 520], detune: 14, space: 0.2 })],
	door: [
		hiss({ attack: 0.02, hold: 0.22, decay: 0.35, volume: 0.05, filter: ["bandpass", 1400, 1.2], filterTo: 350, space: 0.3 }),
		tone("sine", 72, { to: 42, glide: 0.2, at: 0.42, decay: 0.35, volume: 0.1, space: 0.4 }),
		hiss({ at: 0.42, decay: 0.08, volume: 0.05, filter: ["lowpass", 900] }),
	],
	alarm: [...KLAXON(0), ...KLAXON(0.6)],
	ping: [tone("sine", 1046, { attack: 0.004, decay: 1.4, volume: 0.028, space: 0.7 }), tone("sine", 2092, { decay: 0.3, volume: 0.005 })],
	boom: [
		tone("sine", 58, { to: 28, glide: 1, attack: 0.005, decay: 1.4, volume: 0.16, space: 0.5 }),
		hiss({ decay: 1.1, volume: 0.09, filter: ["lowpass", 500], filterTo: 120, space: 0.6 }),
	],
	jump: [
		hiss({ attack: 1.2, hold: 0.2, decay: 0.7, volume: 0.06, filter: ["lowpass", 180], filterTo: 2400, space: 0.4 }),
		tone("sawtooth", 48, { to: 120, glide: 1.4, attack: 1, hold: 0.3, decay: 0.7, volume: 0.025, filter: ["lowpass", 400], filterTo: 1600, space: 0.3, detune: 7 }),
	],
	incoming: [
		hiss({ decay: 0.07, volume: 0.03, filter: ["bandpass", 2400, 2] }),
		tone("sine", 1174, { at: 0.08, decay: 0.35, volume: 0.024, space: 0.5 }),
		tone("sine", 880, { at: 0.26, decay: 0.5, volume: 0.02, space: 0.5 }),
	],
	hum: [tone("sine", 55, { attack: 1.2, hold: 5, decay: 1.3, volume: 0.03 }), tone("sine", 110, { attack: 1.2, hold: 5, decay: 1.3, volume: 0.012 })],
	static: [hiss({ attack: 0.01, hold: 0.3, decay: 0.5, volume: 0.07, filter: ["highpass", 1800], space: 0.3 })],
	rumble: [hiss({ attack: 0.8, hold: 2.2, decay: 1, volume: 0.1, filter: ["lowpass", 140], space: 0.2 })],
};

const CHIRPS = [1760, 2093, 2637, 3136];

/** The console's sound: layered tones and filtered noise through a hull-sized echo, silent until switched on, and made only after a key press asked for them. */
export class Beeper {
	#context: AudioContext | null = null;
	#noise: AudioBuffer | null = null;
	#bus: { dry: AudioNode; wet: AudioNode } | null = null;
	readonly #loops = new Map<Loop, GainNode>();
	on = false;

	toggle(): boolean {
		this.on = !this.on;
		if (this.on && this.#context === null) this.#context = new AudioContext();
		if (!this.on) for (const name of this.#loops.keys()) this.loop(name, 0);
		return this.on;
	}

	play(name: Sound): void {
		if (name === "sos") this.#beacon();
		else for (const layer of RECIPES[name] ?? []) this.#layer(layer);
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

	/** A soft data blip from a terminal being read. */
	chirp(): void {
		this.#layer(tone("sine", CHIRPS[Math.floor(Math.random() * CHIRPS.length)]!, { decay: 0.03, volume: 0.007, filter: ["lowpass", 3500], space: 0.15 }));
	}

	/** One motion-tracker pulse, a falling blip, higher and louder the closer the lifeform (`closeness` 0 to 1). */
	tracker(closeness: number): void {
		const pitch = 1150 + closeness * 350, volume = 0.022 + closeness * 0.03;
		this.#layer(tone("sine", pitch, { to: pitch * 0.82, glide: 0.09, attack: 0.003, decay: 0.16, volume, space: 0.45 }));
		this.#layer(tone("sine", pitch * 2, { decay: 0.05, volume: volume * 0.15 }));
	}

	/** The hull settling: a low metal groan under stress, with a faint ring. */
	creak(): void {
		const from = 60 + Math.random() * 40;
		this.#layer(tone("sawtooth", from, { to: from * 0.6, glide: 1.1, attack: 0.25, decay: 0.95, volume: 0.045, filter: ["lowpass", 380], space: 0.6 }));
		this.#layer(hiss({ attack: 0.3, decay: 0.8, volume: 0.03, filter: ["bandpass", 180, 6], space: 0.6 }));
		this.#layer(tone("sine", 290 + Math.random() * 80, { at: 0.3, decay: 0.9, volume: 0.008, space: 0.7 }));
	}

	#layer(layer: Layer): void {
		const ac = this.#context;
		if (!this.on || ac === null) return;
		const t = ac.currentTime + (layer.at ?? 0), attack = layer.attack ?? 0.005, hold = layer.hold ?? 0, end = t + attack + hold + layer.decay;
		const gain = ac.createGain();
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(layer.volume, t + attack);
		gain.gain.setValueAtTime(layer.volume, t + attack + hold);
		gain.gain.exponentialRampToValueAtTime(0.0001, end);
		let head: AudioNode = gain;
		if (layer.filter !== undefined) {
			const filter = ac.createBiquadFilter();
			[filter.type, filter.frequency.value, filter.Q.value] = [layer.filter[0], layer.filter[1], layer.filter[2] ?? 1];
			if (layer.filterTo !== undefined) filter.frequency.exponentialRampToValueAtTime(layer.filterTo, t + attack + hold + layer.decay * 0.5);
			filter.connect(gain);
			head = filter;
		}
		const sources: AudioScheduledSourceNode[] = [];
		if (layer.kind === "hiss") {
			const source = ac.createBufferSource();
			source.buffer = this.#noiseBuffer(ac);
			source.loop = true;
			sources.push(source);
		} else {
			for (const cents of layer.detune === undefined ? [0] : [-layer.detune, layer.detune]) {
				const osc = ac.createOscillator();
				osc.type = layer.wave;
				osc.detune.value = cents;
				osc.frequency.setValueAtTime(layer.freq, t);
				if (layer.to !== undefined) osc.frequency.exponentialRampToValueAtTime(layer.to, t + (layer.glide ?? layer.decay));
				sources.push(osc);
			}
		}
		this.#send(ac, gain, layer.space ?? 0);
		for (const source of sources) {
			source.connect(head);
			source.start(t);
			source.stop(end + 0.05);
		}
	}

	/** Routes `node` to the speakers, with `space` (0 to 1) of it sent into the hull's echo. */
	#send(ac: AudioContext, node: AudioNode, space: number): void {
		const bus = this.#busFor(ac);
		node.connect(bus.dry);
		if (space <= 0) return;
		const send = ac.createGain();
		send.gain.value = space;
		node.connect(send).connect(bus.wet);
	}

	#busFor(ac: AudioContext): { dry: AudioNode; wet: AudioNode } {
		if (this.#bus !== null) return this.#bus;
		const master = ac.createDynamicsCompressor();
		master.threshold.value = -20;
		master.ratio.value = 3;
		master.connect(ac.destination);
		const echo = ac.createConvolver(), seconds = 2.6, length = Math.floor(ac.sampleRate * seconds);
		const impulse = ac.createBuffer(2, length, ac.sampleRate);
		for (let channel = 0; channel < 2; channel++) {
			const data = impulse.getChannelData(channel);
			for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3.2;
		}
		echo.buffer = impulse;
		const wet = ac.createGain();
		wet.gain.value = 0.8;
		echo.connect(wet).connect(master);
		this.#bus = { dry: master, wet: echo };
		return this.#bus;
	}

	#build(ac: AudioContext, name: Loop): GainNode {
		const out = ac.createGain();
		out.gain.value = 0;
		this.#send(ac, out, LOOP_SPACE[name]);
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
		const level = (value: number) => {
			const g = ac.createGain();
			g.gain.value = value;
			return g;
		};
		const wobble = (target: AudioParam, rate: number, depth: number, type: OscillatorType = "sine") => {
			osc(type, rate).connect(level(depth)).connect(target);
		};
		if (name === "ambient") {
			osc("sine", 46).connect(level(0.6)).connect(out);
			osc("sine", 92.5).connect(level(0.25)).connect(out);
			noise("lowpass", 110).connect(out);
			wobble(out.gain, 0.13, 0.004);
		} else if (name === "servo") {
			const motor = osc("triangle", 140), filter = ac.createBiquadFilter();
			wobble(motor.frequency, 4, 8);
			filter.type = "lowpass";
			filter.frequency.value = 700;
			motor.connect(filter).connect(out);
			noise("bandpass", 1300, 5).connect(level(0.35)).connect(out);
		} else if (name === "grind") {
			const chop = level(0.5);
			wobble(chop.gain, 7, 0.5, "square");
			noise("bandpass", 320, 2).connect(chop).connect(out);
			const ring = level(0.3);
			wobble(ring.gain, 2.2, 0.3, "square");
			noise("bandpass", 1900, 14).connect(level(3)).connect(ring).connect(out);
		} else {
			const snow = ac.createBiquadFilter();
			snow.type = "lowpass";
			snow.frequency.value = 7500;
			noise("highpass", 250, 0.5).connect(snow).connect(out);
			const sheen = level(0.25);
			wobble(sheen.gain, 0.7, 0.08);
			noise("bandpass", 3200, 0.6).connect(sheen).connect(out);
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

	/** The SOS as a weak radio signal: a bed of static, a wavering filtered tone for each beep, and the odd crackle. */
	#beacon(): void {
		const ac = this.#context;
		if (!this.on || ac === null) return;
		this.#layer(hiss({ attack: 0.3, decay: 5.7, volume: 0.03, filter: ["bandpass", 1400] }));
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
			osc.connect(filter).connect(gain);
			this.#send(ac, gain, 0.25);
			osc.start(t);
			osc.stop(t + mark.length + 0.05);
		}
		for (let i = 0; i < 9; i++) this.#layer(hiss({ at: 0.4 + Math.random() * 5.4, attack: 0.005, decay: 0.05 + Math.random() * 0.08, volume: 0.05, filter: ["highpass", 2500] }));
	}
}

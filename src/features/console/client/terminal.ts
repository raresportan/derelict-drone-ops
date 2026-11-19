import type { LogKind, Sink, Sound, Typing } from "../../game/shared/index.ts";
import type { Beeper } from "./audio.ts";
import { LINE_CLASS } from "./palette.ts";

const KEEP_LINES = 400;
const FAST_CPS = 420;
const SLOW_CPS = 48;
const GAP_MS = 60;

interface Pending {
	text: string;
	kind: LogKind;
	cps: number;
}

/** The command log. Lines appear at once, or type themselves out a character at a time, like the terminal printing them. */
export class Terminal implements Sink {
	readonly #out: HTMLElement;
	readonly #beeper: Beeper;
	readonly #reduced: boolean;
	#queue: Pending[] = [];
	#typing: { line: Pending; el: HTMLElement; started: number } | null = null;
	#nextAt = 0;

	constructor(out: HTMLElement, beeper: Beeper, reduced: boolean) {
		this.#out = out;
		this.#beeper = beeper;
		this.#reduced = reduced;
	}

	log(text: string, kind: LogKind, typed: Typing = false): void {
		if (typed !== false && !this.#reduced) this.#queue.push({ text, kind, cps: typed === "slow" ? SLOW_CPS : FAST_CPS });
		else {
			this.#flushAll();
			this.#print(text, kind);
		}
	}

	sound(name: Sound): void {
		this.#beeper.play(name);
	}

	toggleSound(): boolean {
		return this.#beeper.toggle();
	}

	soundOn(): boolean {
		return this.#beeper.on;
	}

	clear(): void {
		this.#queue = [];
		this.#typing = null;
		this.#out.replaceChildren();
	}

	/** Types the line in progress and starts the next one when its turn comes. Called every frame with the time. */
	pump(now: number): void {
		const typing = this.#typing;
		if (typing !== null) {
			const shown = Math.min(typing.line.text.length, Math.floor(((now - typing.started) / 1000) * typing.line.cps));
			typing.el.textContent = typing.line.text.slice(0, shown) + (shown < typing.line.text.length ? "▌" : "");
			this.#scroll();
			if (shown < typing.line.text.length) return;
			this.#typing = null;
			this.#nextAt = now + GAP_MS;
		}
		if (this.#queue.length === 0 || now < this.#nextAt) return;
		const line = this.#queue.shift()!;
		this.#typing = { line, el: this.#print("", line.kind), started: now };
	}

	#flushAll(): void {
		if (this.#typing !== null) this.#typing.el.textContent = this.#typing.line.text;
		this.#typing = null;
		for (const line of this.#queue.splice(0)) this.#print(line.text, line.kind);
	}

	#print(text: string, kind: LogKind): HTMLElement {
		const line = document.createElement("div");
		line.className = LINE_CLASS[kind];
		if (kind === "alarm") line.style.display = "table";
		line.textContent = text;
		this.#out.appendChild(line);
		while (this.#out.children.length > KEEP_LINES) this.#out.firstElementChild?.remove();
		this.#scroll();
		return line;
	}

	#scroll(): void {
		this.#out.scrollTop = this.#out.scrollHeight;
	}
}

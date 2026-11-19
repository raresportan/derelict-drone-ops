import type { LogKind, Sink, Sound } from "../../game/shared/index.ts";
import type { Beeper } from "./audio.ts";
import { LINE_CLASS } from "./palette.ts";

const KEEP_LINES = 400;
const TYPE_GAP_MS = 110;

/** The command log: lines appear at once, or one after another when typed, like the terminal printing them. */
export class Terminal implements Sink {
	readonly #out: HTMLElement;
	readonly #beeper: Beeper;
	readonly #reduced: boolean;
	#queue: { text: string; kind: LogKind }[] = [];
	#nextAt = 0;

	constructor(out: HTMLElement, beeper: Beeper, reduced: boolean) {
		this.#out = out;
		this.#beeper = beeper;
		this.#reduced = reduced;
	}

	log(text: string, kind: LogKind, typed = false): void {
		if (typed && !this.#reduced) this.#queue.push({ text, kind });
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

	clear(): void {
		this.#queue = [];
		this.#out.replaceChildren();
	}

	/** Prints the next typed line once its turn comes. Called every frame with the time. */
	pump(now: number): void {
		if (this.#queue.length === 0 || now < this.#nextAt) return;
		const line = this.#queue.shift()!;
		this.#print(line.text, line.kind);
		this.#nextAt = now + TYPE_GAP_MS;
	}

	#flushAll(): void {
		for (const line of this.#queue.splice(0)) this.#print(line.text, line.kind);
	}

	#print(text: string, kind: LogKind): void {
		const line = document.createElement("div");
		line.className = LINE_CLASS[kind];
		if (kind === "alarm") line.style.display = "table";
		line.textContent = text;
		this.#out.appendChild(line);
		while (this.#out.children.length > KEEP_LINES) this.#out.firstElementChild?.remove();
		this.#out.scrollTop = this.#out.scrollHeight;
	}
}

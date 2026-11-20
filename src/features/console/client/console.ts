import { Game, type SaveStore } from "../../game/shared/index.ts";
import { Beeper } from "./audio.ts";
import { Panels } from "./panels.ts";
import { Screens } from "./screens.ts";
import { Soundscape } from "./soundscape.ts";
import { Terminal } from "./terminal.ts";

const MAX_STEP = 0.05;

/** Builds the terminal on `doc` and runs the game on it, one frame at a time. */
export function mountConsole(doc: Document, saves: SaveStore): Game {
	const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const out = doc.getElementById("out")!, input = doc.getElementById("cmd") as HTMLInputElement, canvas = doc.getElementById("map") as HTMLCanvasElement;
	const beeper = new Beeper();
	const soundscape = new Soundscape(beeper);
	const terminal = new Terminal(out, beeper, reduced);
	const game = new Game(terminal, saves);
	const screens = new Screens(canvas);
	const history: string[] = [];
	let recall = 0;

	const issue = (line: string): void => {
		terminal.log(`> ${line}`, "echo");
		history.push(line);
		recall = history.length;
		game.command(line);
		input.focus({ preventScroll: true });
	};
	const panels = new Panels(doc, issue);

	addEventListener("keydown", (event) => {
		const f = /^F([1-9])$/.exec(event.key);
		if (f === null) return;
		event.preventDefault();
		const key = game.fkeys()[Number(f[1]) - 1];
		if (key) issue(key[1]);
	});
	input.addEventListener("keydown", (event) => {
		if (event.key === "'" && input.value === "") {
			event.preventDefault();
			game.labels = !game.labels;
		} else if (event.key === "Enter") {
			const line = input.value.trim();
			input.value = "";
			if (line !== "") issue(line);
			else game.skip();
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			if (recall > 0) input.value = history[--recall] ?? "";
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			recall = Math.min(history.length, recall + 1);
			input.value = history[recall] ?? "";
		} else if (event.key === "Escape") {
			input.value = "";
			game.skip();
		}
		else if (event.key === "Tab") {
			event.preventDefault();
			const parts = input.value.split(/(\s+)/), last = (parts[parts.length - 1] ?? "").toLowerCase();
			const matches = game.completions(parts.length === 1).filter((w) => w.startsWith(last));
			if (matches.length === 1) {
				parts[parts.length - 1] = `${matches[0]} `;
				input.value = parts.join("");
			} else if (matches.length > 1 && last !== "") terminal.log(matches.join("  "), "note");
		} else if (event.key.length === 1) beeper.play("key");
	});
	doc.addEventListener("mousedown", (event) => {
		const target = event.target as HTMLElement;
		if (target !== input && target.closest("button") === null) requestAnimationFrame(() => getSelection()?.toString() || input.focus({ preventScroll: true }));
	});
	canvas.addEventListener("click", (event) => {
		game.skip();
		const word = screens.wordAt(game, event.clientX, event.clientY);
		if (word === null) return;
		input.value = `${input.value !== "" && !/\s$/.test(input.value) ? `${input.value} ` : input.value}${word} `;
		input.focus();
		beeper.play("key");
	});
	new ResizeObserver(() => screens.resize()).observe(doc.getElementById("mapbox")!);
	screens.resize();

	let last = performance.now();
	const frame = (now: number): void => {
		const dt = Math.min(MAX_STEP, (now - last) / 1000);
		last = now;
		game.tick(dt);
		terminal.pump(now);
		screens.draw(game, dt, now);
		panels.update(game, now);
		soundscape.update(game, now);
		requestAnimationFrame(frame);
	};
	game.showMenu();
	requestAnimationFrame(frame);
	doc.getElementById("term")!.addEventListener("animationend", (event) => event.target === doc.getElementById("screen") && doc.getElementById("term")!.classList.remove("booting"));
	input.focus();
	return game;
}

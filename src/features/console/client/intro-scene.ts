import type { IntroScene } from "../../game/shared/index.ts";
import { alpha, C } from "./palette.ts";

const FONT = 'Menlo,Consolas,"Courier New",monospace';

/** What the intro needs drawn: a scene, seconds into it and into the intro, and the title cards on screen. */
export interface Frame {
	scene: IntroScene;
	t: number;
	at: number;
	cards: readonly { title: string; sub: string; t: number; left: number }[];
}

const hash = (i: number): number => {
	const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};
const ease = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, colour: string, size: number, align: CanvasTextAlign = "center", blur = 8): void {
	ctx.font = `${size}px ${FONT}`;
	ctx.textAlign = align;
	ctx.textBaseline = "middle";
	ctx.fillStyle = colour;
	ctx.shadowColor = colour;
	ctx.shadowBlur = blur;
	ctx.fillText(s, x, y);
	ctx.shadowBlur = 0;
}

function stars(ctx: CanvasRenderingContext2D, w: number, h: number, at: number, drift: number): void {
	for (let i = 0; i < 180; i++) {
		const x = (((hash(i) - at * drift * (0.2 + hash(i + 9) * 0.8)) % 1) + 1) % 1, y = hash(i + 3);
		const twinkle = 0.75 + 0.25 * Math.sin(at * (1 + hash(i + 7) * 3) + i);
		ctx.fillStyle = alpha(C.n, (0.15 + hash(i + 5) * 0.5) * twinkle);
		ctx.fillRect(x * w, y * h, hash(i + 11) > 0.93 ? 2 : 1.3, hash(i + 11) > 0.93 ? 2 : 1.3);
	}
}

function card(ctx: CanvasRenderingContext2D, w: number, h: number, c: Frame["cards"][number]): void {
	const fade = Math.min(1, c.t / 0.25, c.left / 0.4);
	const big = Math.max(18, Math.min(40, w / 26)), small = Math.max(12, Math.min(18, w / 60));
	const titleShown = Math.min(c.title.length, Math.floor(c.t * 22));
	const subShown = Math.min(c.sub.length, Math.max(0, Math.floor((c.t - c.title.length / 22 - 0.15) * 30)));
	const y = h * 0.82;
	ctx.globalAlpha = Math.max(0, fade);
	ctx.font = `bold ${big}px ${FONT}`;
	const width = ctx.measureText(c.title).width + big;
	ctx.fillStyle = C.n;
	ctx.shadowColor = C.n;
	ctx.shadowBlur = 20;
	ctx.fillRect(w / 2 - width / 2, y - big * 0.75, (width * titleShown) / c.title.length, big * 1.5);
	ctx.shadowBlur = 0;
	ctx.font = `bold ${big}px ${FONT}`;
	ctx.textAlign = "left";
	ctx.textBaseline = "middle";
	ctx.fillStyle = C.tube;
	ctx.fillText(c.title.slice(0, titleShown), w / 2 - width / 2 + big / 2, y + 1);
	if (subShown > 0) text(ctx, c.sub.slice(0, subShown) + (subShown < c.sub.length ? "▌" : ""), w / 2, y + big * 1.35, C.hi, small);
	ctx.globalAlpha = 1;
}

function halvardMark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, at: number): void {
	ctx.lineWidth = 2;
	ctx.strokeStyle = C.n;
	ctx.shadowColor = C.n;
	ctx.shadowBlur = 14;
	ctx.beginPath();
	for (let i = 0; i <= 6; i++) {
		const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
		const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.stroke();
	ctx.lineWidth = r * 0.16;
	ctx.beginPath();
	ctx.moveTo(x - r * 0.38, y - r * 0.45);
	ctx.lineTo(x - r * 0.38, y + r * 0.45);
	ctx.moveTo(x + r * 0.38, y - r * 0.45);
	ctx.lineTo(x + r * 0.38, y + r * 0.45);
	ctx.moveTo(x - r * 0.38, y);
	ctx.lineTo(x + r * 0.38, y);
	ctx.stroke();
	ctx.shadowBlur = 0;
	const scan = ((at * 0.7) % 1) * r * 2 - r;
	ctx.fillStyle = alpha(C.hi, 0.12);
	ctx.fillRect(x - r, y + scan, r * 2, r * 0.08);
}

function transmission(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame): void {
	stars(ctx, w, h, f.at, 0.003);
	const sw = Math.min(w * 0.5, h * 0.9), sh = sw * 0.62, sx = w / 2 - sw / 2, sy = h * 0.36 - sh / 2;
	const on = ease(f.t / 0.6);
	ctx.strokeStyle = alpha(C.mid, 0.8);
	ctx.lineWidth = 1.5;
	ctx.strokeRect(sx, sy + (sh / 2) * (1 - on), sw, sh * on);
	if (on < 1) return;
	ctx.fillStyle = alpha(C.n, 0.04 + 0.02 * Math.sin(f.at * 30));
	ctx.fillRect(sx, sy, sw, sh);
	halvardMark(ctx, w / 2, sy + sh * 0.42, sh * 0.26, f.at);
	text(ctx, "HALVARD", w / 2, sy + sh * 0.84, C.hi, Math.max(12, sh * 0.09));
	const cols = Math.max(4, Math.floor(w / 140));
	ctx.font = `${Math.max(10, Math.min(13, w / 90))}px ${FONT}`;
	ctx.textAlign = "left";
	for (let c = 0; c < cols; c++) {
		const x = c < cols / 2 ? 16 + c * 64 : w - 16 - (cols - c) * 64;
		for (let row = 0; row < 18; row++) {
			const v = Math.floor(hash(c * 31 + row + Math.floor(f.at * 6)) * 65536);
			ctx.fillStyle = alpha(C.mid, 0.25 + 0.35 * hash(c + row * 7));
			ctx.fillText(v.toString(16).toUpperCase().padStart(4, "0"), x, 20 + ((row * 22 + f.at * 40) % (h * 0.7)));
		}
	}
	for (let i = 0; i < 16; i++) {
		const level = 0.25 + 0.75 * Math.abs(Math.sin(f.at * 2.6 + i * 0.6)) * (0.6 + 0.4 * hash(i + Math.floor(f.at * 8)));
		ctx.fillStyle = alpha(i < 11 ? C.n : C.hot, 0.75);
		ctx.fillRect(w / 2 - 8 * 10 + i * 10, sy + sh + 34 - level * 24, 7, level * 24);
	}
}

const MORSE = [1, 0, 1, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0];

function sos(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame): void {
	stars(ctx, w, h, f.at, 0.002);
	const left = w * 0.08, right = w * 0.92, top = h * 0.12, bottom = h * 0.62, mid = (top + bottom) / 2, amp = (bottom - top) * 0.36;
	ctx.lineWidth = 1;
	for (let gx = 0; gx <= 10; gx++) {
		ctx.strokeStyle = alpha(C.dim, gx === 5 ? 0.8 : 0.4);
		ctx.beginPath();
		ctx.moveTo(left + ((right - left) * gx) / 10, top);
		ctx.lineTo(left + ((right - left) * gx) / 10, bottom);
		ctx.stroke();
	}
	for (let gy = 0; gy <= 6; gy++) {
		ctx.strokeStyle = alpha(C.dim, gy === 3 ? 0.8 : 0.4);
		ctx.beginPath();
		ctx.moveTo(left, top + ((bottom - top) * gy) / 6);
		ctx.lineTo(right, top + ((bottom - top) * gy) / 6);
		ctx.stroke();
	}
	const trace = (lag: number, a: number) => {
		ctx.strokeStyle = alpha(C.n, a);
		ctx.shadowColor = C.n;
		ctx.shadowBlur = a > 0.8 ? 12 : 0;
		ctx.lineWidth = a > 0.8 ? 2 : 1.2;
		ctx.beginPath();
		for (let x = left; x <= right; x += 2) {
			const u = (x - left) / (right - left), time = f.t - lag;
			const symbol = MORSE[Math.floor((u * 6 + time * 2.6) * 1) % MORSE.length]!;
			const dropout = Math.sin(u * 9 + time * 4) > 0.9 ? 0.15 : 1;
			const noise = (hash(Math.floor(x * 1.3 + time * 400)) - 0.5) * (0.25 + 0.5 * Math.max(0, f.t - 4.5));
			const y = mid - (symbol * dropout * Math.sin(u * 160 + time * 30) * 0.9 + noise) * amp;
			if (x === left) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();
		ctx.shadowBlur = 0;
	};
	trace(0.18, 0.15);
	trace(0.09, 0.35);
	trace(0, 1);
	const size = Math.max(11, Math.min(14, w / 70));
	text(ctx, "CH 7 · 406.025 MHz · BEACON LACUNA-COMPLEX", left, top - size, C.mid, size, "left", 3);
	text(ctx, `T−41d ${String(Math.floor(f.t * 100) % 100).padStart(2, "0")}`, right, top - size, C.mid, size, "right", 3);
}

function cut(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame): void {
	ctx.fillStyle = C.tube;
	ctx.fillRect(0, 0, w, h);
	if (f.t > 0.35) return;
	for (let i = 0; i < 1400; i++) {
		ctx.fillStyle = alpha(C.hi, hash(i + Math.floor(f.t * 60) * 1400) * 0.6);
		ctx.fillRect(hash(i * 3 + f.t) * w, hash(i * 5 + f.t * 2) * h, 2, 2);
	}
}

const REGION_LABELS = ["THE SURFACE", "THE UNDERWORKS", "THE BORE"];

function moon(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame): void {
	stars(ctx, w, h, f.at, 0.004);
	const pan = ease(f.t / 6);
	const gx = w * (1.05 - 0.1 * pan), gy = h * 0.05, gr = Math.max(w, h) * 0.5;
	ctx.save();
	ctx.beginPath();
	ctx.arc(gx, gy, gr, 0, 7);
	ctx.clip();
	for (let b = 0; b < 18; b++) {
		const wobble = Math.sin(b * 1.7 + f.at * 0.2) * gr * 0.02;
		ctx.fillStyle = alpha(b % 3 === 0 ? C.mid : C.dim, 0.14 + (b % 4) * 0.04);
		ctx.fillRect(gx - gr, gy - gr + (b * 2 * gr) / 18 + wobble, gr * 2, (2 * gr) / 18);
	}
	const shade = ctx.createLinearGradient(gx - gr, 0, gx + gr * 0.2, 0);
	shade.addColorStop(0, alpha(C.tube, 0.85));
	shade.addColorStop(1, alpha(C.tube, 0));
	ctx.fillStyle = shade;
	ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
	ctx.restore();
	ctx.strokeStyle = alpha(C.mid, 0.6);
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.arc(gx, gy, gr, 0, 7);
	ctx.stroke();
	ctx.strokeStyle = alpha(C.mid, 0.35);
	ctx.beginPath();
	ctx.ellipse(gx, gy, gr * 1.35, gr * 0.16, -0.25, 0.2, Math.PI - 0.1);
	ctx.stroke();

	const mx = w * (0.62 - 0.22 * pan), my = h * 0.46, mr = Math.min(w, h) * (0.24 + 0.05 * pan);
	ctx.save();
	ctx.beginPath();
	ctx.arc(mx, my, mr, 0, 7);
	ctx.clip();
	ctx.fillStyle = C.tube;
	ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
	ctx.fillStyle = alpha(C.dim, 0.35);
	ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
	ctx.lineWidth = 1;
	for (let i = 0; i < 26; i++) {
		const u = (((hash(i) + f.at * 0.012) % 1) + 1) % 1, cx = mx - mr + u * mr * 2.4 - mr * 0.2, cy = my + (hash(i + 20) - 0.5) * mr * 1.8;
		const r = mr * (0.03 + hash(i + 40) * 0.09), squash = Math.max(0.15, Math.cos(((cx - mx) / mr) * 1.4));
		ctx.strokeStyle = alpha(C.mid, 0.55);
		ctx.beginPath();
		ctx.ellipse(cx, cy, r * squash, r, 0, 0, 7);
		ctx.stroke();
	}
	const night = ctx.createLinearGradient(mx - mr * 0.1, 0, mx + mr, 0);
	night.addColorStop(0, alpha(C.tube, 0));
	night.addColorStop(0.45, alpha(C.tube, 0.8));
	night.addColorStop(1, alpha(C.tube, 0.95));
	ctx.fillStyle = night;
	ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
	ctx.restore();
	ctx.strokeStyle = C.n;
	ctx.shadowColor = C.n;
	ctx.shadowBlur = 16;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(mx, my, mr, Math.PI * 0.5, Math.PI * 1.5);
	ctx.stroke();
	ctx.shadowBlur = 0;
	ctx.strokeStyle = alpha(C.mid, 0.4);
	ctx.beginPath();
	ctx.arc(mx, my, mr, -Math.PI * 0.5, Math.PI * 0.5);
	ctx.stroke();

	const shown = Math.min(21, Math.floor(Math.max(0, f.t - 4.6) * 4));
	const size = Math.max(11, Math.min(15, w / 64));
	const site = (i: number) => {
		const a = Math.PI * 0.62 + (i / 20) * Math.PI * 1.55, rr = mr * (0.84 - (i / 20) * 0.78);
		return { x: mx + Math.cos(a) * rr, y: my + Math.sin(a) * rr * 0.92 };
	};
	for (let i = 0; i < 21; i++) {
		const { x, y } = site(i);
		const lit = i < shown, region = Math.floor(i / 7), colour = region === 2 ? C.hot : C.hi;
		if (lit && i > 0) {
			const prev = site(i - 1);
			ctx.strokeStyle = alpha(colour, 0.45);
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(prev.x, prev.y);
			ctx.lineTo(x, y);
			ctx.stroke();
		}
		ctx.fillStyle = lit ? colour : alpha(C.dim, 0.7);
		ctx.shadowColor = colour;
		ctx.shadowBlur = lit ? 10 : 0;
		ctx.fillRect(x - 3, y - 3, 6, 6);
		ctx.shadowBlur = 0;
	}
	REGION_LABELS.forEach((label, region) => {
		if (shown <= region * 7) return;
		const first = site(region * 7), colour = region === 2 ? C.hot : C.hi;
		const lx = mx - mr - size, ly = my - mr * 0.55 + region * size * 2.2;
		ctx.strokeStyle = alpha(colour, 0.5);
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(lx + 4, ly);
		ctx.lineTo(first.x, first.y);
		ctx.stroke();
		text(ctx, label, lx, ly, colour, size, "right");
	});
}

function descent(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame): void {
	const land = 3.8, landed = f.t >= land;
	const shake = landed && f.t < land + 0.5 ? (hash(Math.floor(f.t * 60)) - 0.5) * 8 * (1 - (f.t - land) / 0.5) : 0;
	ctx.save();
	ctx.translate(0, shake);
	stars(ctx, w, h * 0.6, f.at, 0.001);
	const horizon = h * 0.48;
	ctx.fillStyle = alpha(C.dim, 0.18);
	ctx.beginPath();
	ctx.moveTo(0, horizon + 18);
	ctx.quadraticCurveTo(w / 2, horizon - 24, w, horizon + 18);
	ctx.lineTo(w, h);
	ctx.lineTo(0, h);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = C.n;
	ctx.shadowColor = C.n;
	ctx.shadowBlur = 10;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(0, horizon + 18);
	ctx.quadraticCurveTo(w / 2, horizon - 24, w, horizon + 18);
	ctx.stroke();
	ctx.shadowBlur = 0;
	ctx.lineWidth = 1;
	for (let i = -12; i <= 12; i++) {
		ctx.strokeStyle = alpha(C.mid, 0.22);
		ctx.beginPath();
		ctx.moveTo(w / 2 + i * 14, horizon);
		ctx.lineTo(w / 2 + i * w * 0.14, h);
		ctx.stroke();
	}
	for (let k = 1; k < 7; k++) {
		const y = horizon + ((h - horizon) * k * k) / 49;
		ctx.strokeStyle = alpha(C.mid, 0.22);
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(w, y);
		ctx.stroke();
	}
	const domes: [number, number][] = [[0.14, 34], [0.24, 22], [0.7, 40], [0.82, 26], [0.9, 18]];
	for (const [u, r] of domes) {
		const x = w * u, y = horizon - 6 + Math.abs(u - 0.5) * 30;
		ctx.strokeStyle = alpha(C.n, 0.75);
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(x, y, r, Math.PI, 0);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x - r * 0.6, y - r * 0.55);
		ctx.lineTo(x + r * 0.6, y - r * 0.55);
		ctx.stroke();
	}
	ctx.strokeStyle = alpha(C.mid, 0.6);
	ctx.beginPath();
	ctx.moveTo(w * 0.24 + 22, horizon + 2);
	ctx.lineTo(w * 0.42, horizon + 6);
	ctx.moveTo(w * 0.58, horizon + 6);
	ctx.lineTo(w * 0.7 - 40, horizon + 4);
	ctx.stroke();
	const padY = horizon + Math.min(30, h * 0.07), padW = w * 0.12;
	ctx.strokeStyle = C.n;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(w / 2, padY, padW, padW * 0.16, 0, 0, 7);
	ctx.stroke();
	if (Math.floor(f.at * 2.5) % 2) {
		ctx.fillStyle = C.hot;
		ctx.shadowColor = C.hot;
		ctx.shadowBlur = 12;
		for (const s of [-1, 1]) ctx.fillRect(w / 2 + s * padW - 3, padY - 3, 6, 6);
		ctx.shadowBlur = 0;
	}
	const fall = ease(f.t / land), hx = w / 2, hy = h * 0.08 + fall * (padY - 14 - h * 0.08), size = 1 + fall * 0.5;
	if (!landed) {
		const flame = (14 + hash(Math.floor(f.at * 24)) * 16) * size;
		ctx.fillStyle = C.hot;
		ctx.shadowColor = C.hot;
		ctx.shadowBlur = 16;
		ctx.beginPath();
		ctx.moveTo(hx - 8 * size, hy);
		ctx.lineTo(hx + 8 * size, hy);
		ctx.lineTo(hx, hy + flame);
		ctx.closePath();
		ctx.fill();
		ctx.shadowBlur = 0;
	}
	ctx.fillStyle = C.hi;
	ctx.shadowColor = C.hi;
	ctx.shadowBlur = 12;
	ctx.beginPath();
	ctx.moveTo(hx - 24 * size, hy);
	ctx.lineTo(hx + 24 * size, hy);
	ctx.lineTo(hx + 15 * size, hy - 18 * size);
	ctx.lineTo(hx - 15 * size, hy - 18 * size);
	ctx.closePath();
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.strokeStyle = C.hi;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(hx - 18 * size, hy);
	ctx.lineTo(hx - 26 * size, hy + 10 * size);
	ctx.moveTo(hx + 18 * size, hy);
	ctx.lineTo(hx + 26 * size, hy + 10 * size);
	ctx.stroke();
	const dustFrom = land - 0.9;
	if (f.t > dustFrom) {
		const age = f.t - dustFrom;
		for (let i = 0; i < 70; i++) {
			const dir = hash(i) < 0.5 ? -1 : 1, speed = 40 + hash(i + 1) * 160, life = 1.2 + hash(i + 2) * 1.6;
			if (age > life) continue;
			const k = age / life;
			const x = hx + dir * speed * age * (1 - k * 0.4), y = padY - hash(i + 3) * 26 * Math.sin(k * Math.PI);
			ctx.fillStyle = alpha(C.mid, 0.6 * (1 - k));
			ctx.fillRect(x, y, 2.5, 2.5);
		}
	}
	ctx.restore();
	const label = Math.max(11, Math.min(14, w / 70));
	text(ctx, `ALT ${String(Math.max(0, Math.round((1 - fall) * 2400))).padStart(4, "0")} M`, 18, 22, C.hi, label, "left", 4);
	text(ctx, landed ? "CONTACT · ENGINES SAFE" : `V/S −${Math.round((1 - fall) * 38 + 2)} M/S`, 18, 22 + label * 1.6, landed ? C.n : C.mid, label, "left", 4);
}

/** Draws one frame of the intro. Loaded only when the intro or the ending is shown. */
export function drawIntro(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame): void {
	if (f.scene === "transmission") transmission(ctx, w, h, f);
	else if (f.scene === "sos") sos(ctx, w, h, f);
	else if (f.scene === "cut") cut(ctx, w, h, f);
	else if (f.scene === "moon") moon(ctx, w, h, f);
	else descent(ctx, w, h, f);
	for (const c of f.cards) card(ctx, w, h, c);
}

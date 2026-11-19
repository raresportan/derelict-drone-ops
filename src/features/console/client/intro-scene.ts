import type { IntroScene } from "../../game/shared/index.ts";
import { alpha, C } from "./palette.ts";

const FONT = 'Menlo,Consolas,"Courier New",monospace';

const hash = (i: number): number => {
	const x = Math.sin(i * 127.1) * 43758.5453;
	return x - Math.floor(x);
};

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, colour: string, size: number, align: CanvasTextAlign = "center"): void {
	ctx.font = `${size}px ${FONT}`;
	ctx.textAlign = align;
	ctx.textBaseline = "middle";
	ctx.fillStyle = colour;
	ctx.shadowColor = colour;
	ctx.shadowBlur = 8;
	ctx.fillText(s, x, y);
	ctx.shadowBlur = 0;
}

function stars(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, drift: number): void {
	for (let i = 0; i < 160; i++) {
		const x = ((hash(i) - t * drift * (0.2 + hash(i + 9) * 0.8)) % 1 + 1) % 1, y = hash(i + 3);
		ctx.fillStyle = alpha(C.n, 0.2 + hash(i + 5) * 0.5);
		ctx.fillRect(x * w, y * h, 1.4, 1.4);
	}
}

function transmission(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
	stars(ctx, w, h, t, 0.004);
	const cx = w / 2, cy = h * 0.46, r = Math.min(w, h) * 0.28;
	ctx.lineWidth = 1.2;
	for (let k = 1; k <= 4; k++) {
		ctx.strokeStyle = alpha(C.mid, 0.35);
		ctx.beginPath();
		ctx.arc(cx, cy, (r * k) / 4, 0, 7);
		ctx.stroke();
	}
	const sweep = t * 2.2;
	for (let i = 0; i < 40; i++) {
		ctx.strokeStyle = alpha(C.n, (1 - i / 40) * 0.5);
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx + Math.cos(sweep - i * 0.02) * r, cy + Math.sin(sweep - i * 0.02) * r);
		ctx.stroke();
	}
	const pulse = (t * 0.6) % 1;
	ctx.strokeStyle = alpha(C.hi, 1 - pulse);
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(cx + r * 0.55, cy - r * 0.35, 4 + pulse * r * 0.5, 0, 7);
	ctx.stroke();
	ctx.fillStyle = C.hot;
	ctx.shadowColor = C.hot;
	ctx.shadowBlur = 14;
	ctx.beginPath();
	ctx.arc(cx + r * 0.55, cy - r * 0.35, 4, 0, 7);
	ctx.fill();
	ctx.shadowBlur = 0;
	const size = Math.max(12, Math.min(18, w / 50));
	if (Math.floor(t * 2) % 2) text(ctx, "▸ RECEIVING · HALVARD MINERAL TRUST", cx, cy + r + size * 2, C.hi, size);
	for (let i = 0; i < 12; i++) {
		const level = 0.3 + 0.7 * Math.abs(Math.sin(t * 3 + i * 0.7));
		ctx.fillStyle = alpha(C.n, 0.7);
		ctx.fillRect(cx - 6 * 9 + i * 9, cy + r + size * 4 - level * 26, 6, level * 26);
	}
}

function sos(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
	stars(ctx, w, h, t, 0.002);
	const mid = h * 0.45, amp = h * 0.16;
	const morse = [1, 0, 1, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0];
	ctx.strokeStyle = alpha(C.dim, 0.6);
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, mid);
	ctx.lineTo(w, mid);
	ctx.stroke();
	ctx.lineWidth = 2;
	ctx.strokeStyle = C.n;
	ctx.shadowColor = C.n;
	ctx.shadowBlur = 10;
	ctx.beginPath();
	for (let x = 0; x <= w; x += 2) {
		const u = x / w * 8 + t * 2.5;
		const on = morse[Math.floor(u * 2) % morse.length]!;
		const dropout = Math.sin(u * 1.7 + t * 3) > 0.92 ? 0 : 1;
		const noise = (hash(Math.floor(x + t * 300)) - 0.5) * 0.35;
		const y = mid - (on * dropout * Math.sin(u * 40) + noise) * amp;
		if (x === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.stroke();
	ctx.shadowBlur = 0;
	const size = Math.max(12, Math.min(18, w / 50));
	text(ctx, "· · ·   — — —   · · ·", w / 2, mid + amp + size * 2, C.hi, size * 1.4);
	text(ctx, "LAST SIGNAL FROM LACUNA · 41 DAYS OLD", w / 2, mid + amp + size * 4, C.mid, size);
}

const REGION_LABELS = ["THE SURFACE", "THE UNDERWORKS", "THE BORE"];

function moon(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
	stars(ctx, w, h, t, 0.003);
	const zoom = 1 + Math.max(0, t) * 0.015;
	const gx = w * 0.92, gy = -h * 0.1, gr = Math.max(w, h) * 0.55 * zoom;
	ctx.save();
	ctx.beginPath();
	ctx.arc(gx, gy, gr, 0, 7);
	ctx.clip();
	for (let b = 0; b < 14; b++) {
		ctx.fillStyle = alpha(b % 2 ? C.mid : C.dim, 0.18 + (b % 3) * 0.05);
		ctx.fillRect(gx - gr, gy - gr + (b * 2 * gr) / 14, gr * 2, (2 * gr) / 14);
	}
	ctx.restore();
	ctx.strokeStyle = alpha(C.mid, 0.7);
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.arc(gx, gy, gr, 0, 7);
	ctx.stroke();
	const mx = w * 0.38, my = h * 0.55, mr = Math.min(w, h) * 0.3 * zoom;
	ctx.fillStyle = alpha(C.tube, 0.95);
	ctx.beginPath();
	ctx.arc(mx, my, mr, 0, 7);
	ctx.fill();
	ctx.strokeStyle = C.n;
	ctx.shadowColor = C.n;
	ctx.shadowBlur = 14;
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.shadowBlur = 0;
	ctx.lineWidth = 1;
	for (let i = 0; i < 9; i++) {
		ctx.strokeStyle = alpha(C.mid, 0.45);
		ctx.beginPath();
		ctx.ellipse(mx + (hash(i) - 0.5) * mr * 1.3, my + (hash(i + 20) - 0.5) * mr * 1.3, mr * (0.05 + hash(i + 40) * 0.1), mr * (0.03 + hash(i + 40) * 0.06), 0, 0, 7);
		ctx.stroke();
	}
	const shown = Math.min(21, Math.floor(Math.max(0, t) * 3.2));
	const size = Math.max(11, Math.min(15, w / 64));
	for (let i = 0; i < 21; i++) {
		const a = -2.2 + (i / 20) * 2.6, rr = mr * (0.78 - (i / 20) * 0.62);
		const x = mx + Math.cos(a) * rr, y = my + Math.sin(a) * rr;
		const lit = i < shown, region = Math.floor(i / 7);
		ctx.fillStyle = lit ? (region === 2 ? C.hot : C.hi) : alpha(C.dim, 0.7);
		ctx.shadowColor = ctx.fillStyle;
		ctx.shadowBlur = lit ? 10 : 0;
		ctx.fillRect(x - 3, y - 3, 6, 6);
		ctx.shadowBlur = 0;
		if (i % 7 === 0 && lit) text(ctx, REGION_LABELS[region]!, x + 12, y - 12, region === 2 ? C.hot : C.hi, size, "left");
	}
	text(ctx, "LACUNA", mx, my + mr + size * 2, C.hi, size * 1.4);
}

function descent(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
	stars(ctx, w, h, t, 0.001);
	const horizon = h * 0.68;
	ctx.strokeStyle = C.n;
	ctx.shadowColor = C.n;
	ctx.shadowBlur = 10;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(0, horizon + 20);
	ctx.quadraticCurveTo(w / 2, horizon - 30, w, horizon + 20);
	ctx.stroke();
	ctx.shadowBlur = 0;
	ctx.lineWidth = 1;
	for (let i = -10; i <= 10; i++) {
		ctx.strokeStyle = alpha(C.mid, 0.3);
		ctx.beginPath();
		ctx.moveTo(w / 2 + i * 12, horizon);
		ctx.lineTo(w / 2 + i * w * 0.12, h);
		ctx.stroke();
	}
	for (let k = 1; k < 6; k++) {
		const y = horizon + ((h - horizon) * (k * k)) / 36;
		ctx.strokeStyle = alpha(C.mid, 0.3);
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(w, y);
		ctx.stroke();
	}
	const fall = Math.min(1, Math.max(0, t) / 4);
	const hx = w / 2, hy = h * 0.12 + fall * (horizon - h * 0.2);
	ctx.fillStyle = C.hi;
	ctx.shadowColor = C.hi;
	ctx.shadowBlur = 12;
	ctx.beginPath();
	ctx.moveTo(hx - 22, hy);
	ctx.lineTo(hx + 22, hy);
	ctx.lineTo(hx + 14, hy - 16);
	ctx.lineTo(hx - 14, hy - 16);
	ctx.closePath();
	ctx.fill();
	ctx.shadowBlur = 0;
	const flame = 10 + hash(Math.floor(t * 20)) * 14;
	ctx.fillStyle = C.hot;
	ctx.beginPath();
	ctx.moveTo(hx - 8, hy);
	ctx.lineTo(hx + 8, hy);
	ctx.lineTo(hx, hy + flame);
	ctx.closePath();
	ctx.fill();
	const size = Math.max(12, Math.min(16, w / 56));
	text(ctx, `ALT ${String(Math.max(0, Math.round((1 - fall) * 2400))).padStart(4, "0")} M   ·   SITE 1 · PERIMETER HAB 3`, w / 2, h * 0.93, C.hi, size);
}

/** Draws one frame of the intro's `scene`, `t` seconds into it. Loaded only when the intro or the ending is shown. */
export function drawIntro(ctx: CanvasRenderingContext2D, w: number, h: number, scene: IntroScene, t: number): void {
	if (scene === "transmission") transmission(ctx, w, h, t);
	else if (scene === "sos") sos(ctx, w, h, t);
	else if (scene === "moon") moon(ctx, w, h, t);
	else descent(ctx, w, h, t);
}

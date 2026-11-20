import type { IntroScene } from "../../game/shared/index.ts";
import { alpha, C } from "./palette.ts";
import { beaconAt } from "./sos.ts";

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

function companyMark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, at: number): void {
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
	ctx.arc(x, y, r * 0.48, Math.PI * 0.28, Math.PI * 1.72);
	ctx.stroke();
	ctx.fillStyle = C.n;
	ctx.beginPath();
	ctx.moveTo(x + r * 0.08, y - r * 0.2);
	ctx.lineTo(x + r * 0.26, y);
	ctx.lineTo(x + r * 0.08, y + r * 0.2);
	ctx.lineTo(x - r * 0.1, y);
	ctx.closePath();
	ctx.fill();
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
	companyMark(ctx, w / 2, sy + sh * 0.42, sh * 0.26, f.at);
	text(ctx, "CYBERDIME", w / 2, sy + sh * 0.84, C.hi, Math.max(12, sh * 0.09));
	const size = Math.max(15, Math.min(24, w / 42)), step = size * 4, lines = Math.ceil(h / (size * 1.5)) + 1;
	const cols = Math.max(2, Math.floor((sx - 24) / step)) * 2;
	ctx.font = `${size}px ${FONT}`;
	ctx.textAlign = "left";
	ctx.textBaseline = "middle";
	for (let c = 0; c < cols; c++) {
		const x = c < cols / 2 ? 18 + c * step : w - 18 - (cols - c) * step;
		for (let row = 0; row < lines; row++) {
			const v = Math.floor(hash(c * 31 + row + Math.floor(f.at * 5)) * 65536);
			const y = (((row * size * 1.5 - f.at * 34) % (lines * size * 1.5)) + lines * size * 1.5) % (lines * size * 1.5);
			ctx.fillStyle = alpha(C.mid, 0.16 + 0.3 * hash(c + row * 7));
			ctx.fillText(v.toString(16).toUpperCase().padStart(4, "0"), x, y);
		}
	}
	for (let i = 0; i < 16; i++) {
		const level = 0.25 + 0.75 * Math.abs(Math.sin(f.at * 2.6 + i * 0.6)) * (0.6 + 0.4 * hash(i + Math.floor(f.at * 8)));
		ctx.fillStyle = alpha(i < 11 ? C.n : C.hot, 0.75);
		ctx.fillRect(w / 2 - 8 * 10 + i * 10, sy + sh + 34 - level * 24, 7, level * 24);
	}
}

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
			const u = (x - left) / (right - left), time = f.t - lag - (1 - u) * 0.6;
			const signal = beaconAt(time);
			const noise = (hash(Math.floor(x * 1.3 + f.t * 400)) - 0.5) * (0.22 + 0.4 * Math.max(0, f.t - 3.5));
			const y = mid - (signal * Math.sin(u * 180 + time * 40) * 0.92 + noise) * amp;
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

	if (f.t > 1.2) {
		const tx = mx - mr * 0.42, ty = my - mr * 0.18, pulse = (f.t * 0.8) % 1, size = Math.max(11, Math.min(15, w / 64));
		ctx.strokeStyle = alpha(C.hot, 1 - pulse);
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(tx, ty, 6 + pulse * mr * 0.25, 0, 7);
		ctx.stroke();
		ctx.strokeStyle = C.hot;
		ctx.shadowColor = C.hot;
		ctx.shadowBlur = 10;
		const r = mr * 0.09;
		ctx.beginPath();
		for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
			ctx.moveTo(tx + dx * r, ty + dy * r * 0.4);
			ctx.lineTo(tx + dx * r, ty + dy * r);
			ctx.lineTo(tx + dx * r * 0.4, ty + dy * r);
		}
		ctx.stroke();
		ctx.fillStyle = C.hot;
		ctx.fillRect(tx - 2, ty - 2, 4, 4);
		ctx.shadowBlur = 0;
		ctx.strokeStyle = alpha(C.hot, 0.6);
		ctx.beginPath();
		ctx.moveTo(tx - r, ty);
		ctx.lineTo(mx - mr - size * 0.6, ty);
		ctx.stroke();
		text(ctx, "LACUNA COMPLEX", mx - mr - size, ty - size * 0.7, C.hot, size, "right");
		text(ctx, "NO CARRIER · 412 DAYS", mx - mr - size, ty + size * 0.8, C.mid, size * 0.85, "right", 3);
	}
}

const LAYERS = [
	{ name: "THE SURFACE", range: "SITES 1–7" },
	{ name: "THE UNDERWORKS", range: "SITES 8–14" },
	{ name: "THE BORE", range: "SITES 15–21" },
];

function section(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame): void {
	const reveal = ease(f.t / 0.8);
	const top = h * 0.14, under = h * 0.3, deep = h * 0.56, left = w * 0.24, right = w * 0.94;
	stars(ctx, w, top, f.at, 0.002);
	ctx.fillStyle = alpha(C.dim, 0.14 * reveal);
	ctx.fillRect(0, top, w, h - top);
	for (let i = 0; i < 260; i++) {
		const x = hash(i + 500) * w, y = top + hash(i + 900) * (h - top);
		ctx.fillStyle = alpha(C.mid, 0.12 * reveal);
		ctx.fillRect(x, y, 6, 1);
	}
	ctx.strokeStyle = C.n;
	ctx.shadowColor = C.n;
	ctx.shadowBlur = 10;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(0, top);
	ctx.lineTo(w, top);
	ctx.stroke();
	ctx.shadowBlur = 0;
	const shaftX = w * 0.78;
	const sites: { x: number; y: number }[] = [];
	for (let i = 0; i < 7; i++) sites.push({ x: left + ((shaftX - left) * i) / 6, y: top });
	for (let i = 0; i < 7; i++) sites.push({ x: shaftX - ((shaftX - left) * i) / 6, y: under });
	for (let i = 0; i < 7; i++) sites.push(i < 4 ? { x: shaftX, y: under + ((deep - under) * (i + 1)) / 4.6 } : { x: shaftX + (i - 3.4) * (right - shaftX) * 0.3, y: deep + h * 0.055 });
	ctx.lineWidth = 1.5;
	ctx.strokeStyle = alpha(C.mid, 0.7 * reveal);
	ctx.beginPath();
	ctx.moveTo(left - 10, under);
	ctx.lineTo(shaftX + 10, under);
	ctx.moveTo(left - 10, under + 10);
	ctx.lineTo(shaftX + 10, under + 10);
	ctx.stroke();
	ctx.strokeStyle = alpha(C.hot, 0.8 * reveal);
	ctx.beginPath();
	ctx.moveTo(shaftX - 7, top);
	ctx.lineTo(shaftX - 7, deep + h * 0.03);
	ctx.moveTo(shaftX + 7, top);
	ctx.lineTo(shaftX + 7, deep + h * 0.03);
	ctx.stroke();
	ctx.fillStyle = alpha(C.hot, 0.12 * reveal);
	ctx.beginPath();
	ctx.ellipse(shaftX + (right - shaftX) * 0.32, deep + h * 0.06, (right - shaftX) * 0.7, h * 0.05, 0, 0, 7);
	ctx.fill();
	ctx.strokeStyle = alpha(C.hot, 0.6 * reveal);
	ctx.stroke();
	for (const [u, r] of [[0.08, 14], [0.33, 10], [0.58, 16]] as const) {
		ctx.strokeStyle = alpha(C.n, 0.8 * reveal);
		ctx.beginPath();
		ctx.arc(left + (shaftX - left) * u, top, r, Math.PI, 0);
		ctx.stroke();
	}
	const shown = Math.min(21, Math.floor(Math.max(0, f.t - 0.6) * 7.5));
	for (let i = 1; i < shown; i++) {
		if (i === 7 || i === 14) continue;
		ctx.strokeStyle = alpha(i >= 14 ? C.hot : C.hi, 0.35);
		ctx.setLineDash([3, 4]);
		ctx.beginPath();
		ctx.moveTo(sites[i - 1]!.x, sites[i - 1]!.y);
		ctx.lineTo(sites[i]!.x, sites[i]!.y);
		ctx.stroke();
		ctx.setLineDash([]);
	}
	sites.forEach((p, i) => {
		const lit = i < shown, colour = i >= 14 ? C.hot : C.hi;
		ctx.fillStyle = lit ? colour : alpha(C.dim, 0.8 * reveal);
		ctx.shadowColor = colour;
		ctx.shadowBlur = lit ? 10 : 0;
		ctx.fillRect(p.x - 3.5, p.y - 3.5, 7, 7);
		ctx.shadowBlur = 0;
	});
	const size = Math.max(11, Math.min(15, w / 64));
	LAYERS.forEach((layer, i) => {
		if (shown <= i * 7) return;
		const y = [top, under, (under + deep) / 2 + h * 0.04][i]!, colour = i === 2 ? C.hot : C.hi;
		text(ctx, layer.name, left - size * 2, y - size * 0.6, colour, size, "right");
		text(ctx, layer.range, left - size * 2, y + size * 0.7, C.mid, size * 0.85, "right", 3);
	});
	text(ctx, "−2.1 KM", shaftX - (right - shaftX) * 0.5, deep + h * 0.06, C.hot, size * 0.85, "right", 4);
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
	const padY = horizon + Math.min(30, h * 0.07), padW = w * 0.15;
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
	const fall = ease(f.t / land), unit = (1.3 + fall * 0.95) * Math.max(1, Math.min(1.6, w / 800));
	const legs = ease((fall - 0.5) / 0.35), footY = 9 + 13 * legs;
	const hx = w / 2, hy = h * 0.06 + fall * (padY - h * 0.06) - footY * unit;
	const near = ease((fall - 0.35) / 0.65);
	ctx.fillStyle = alpha(C.tube, 0.55 * near);
	ctx.beginPath();
	ctx.ellipse(hx, padY, 54 * unit * (0.4 + near * 0.6), 6 * unit * (0.4 + near * 0.6), 0, 0, 7);
	ctx.fill();
	if (!landed && fall > 0.25) {
		const cone = ctx.createLinearGradient(0, hy + 8 * unit, 0, padY);
		cone.addColorStop(0, alpha(C.hi, 0.22));
		cone.addColorStop(1, alpha(C.hi, 0));
		ctx.fillStyle = cone;
		ctx.beginPath();
		ctx.moveTo(hx - 3 * unit, hy + 9 * unit);
		ctx.lineTo(hx + 3 * unit, hy + 9 * unit);
		ctx.lineTo(hx + 50 * unit, padY);
		ctx.lineTo(hx - 50 * unit, padY);
		ctx.closePath();
		ctx.fill();
	}
	lander(ctx, hx, hy, unit, legs, landed ? 0 : 1 - fall * 0.35, f.at);
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
	ctx.lineWidth = 1;
	for (let i = 0; i < 70; i++) {
		const sx = (((hash(i + 40) + f.at * (0.18 + hash(i + 41) * 0.2)) % 1) + 1) % 1, sy = (((hash(i + 42) + f.at * 0.05) % 1) + 1) % 1;
		ctx.strokeStyle = alpha(C.hi, 0.12 + hash(i + 43) * 0.25);
		ctx.beginPath();
		ctx.moveTo(sx * w, sy * h);
		ctx.lineTo(sx * w - 10, sy * h - 2);
		ctx.stroke();
	}
	ctx.restore();
	const label = Math.max(11, Math.min(14, w / 70));
	text(ctx, `ALT ${String(Math.max(0, Math.round((1 - fall) * 2400))).padStart(4, "0")} M`, 18, 22, C.hi, label, "left", 4);
	text(ctx, landed ? "CONTACT · ENGINES SAFE" : `V/S −${Math.round((1 - fall) * 38 + 2)} M/S`, 18, 22 + label * 1.6, landed ? C.n : C.mid, label, "left", 4);
}

/**
 * The dropship, side on with its nose to the left: an armoured wedge of a hull with a slit cockpit, a tail fin, a striped
 * VTOL nacelle, hydraulic landing struts and running lights. It noses up a little until the struts are down; `thrust` 0
 * means engines off.
 */
function lander(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, legs: number, thrust: number, at: number): void {
	const P = (dx: number, dy: number): [number, number] => [dx * u, dy * u];
	const path = (points: [number, number][], close = true) => {
		ctx.beginPath();
		points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(...P(px, py)) : ctx.lineTo(...P(px, py))));
		if (close) ctx.closePath();
	};
	const shape = (points: [number, number][], fill: string, glow = 0) => {
		path(points);
		ctx.fillStyle = fill;
		ctx.fill();
		ctx.shadowColor = C.hi;
		ctx.shadowBlur = glow;
		ctx.stroke();
		ctx.shadowBlur = 0;
	};
	const line = (points: [number, number][], colour: string) => {
		ctx.strokeStyle = colour;
		path(points, false);
		ctx.stroke();
		ctx.strokeStyle = C.hi;
	};
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(-0.06 * (1 - legs));
	if (thrust > 0) {
		const flicker = 0.75 + hash(Math.floor(at * 30)) * 0.5;
		for (const [dx, dy, len, wide] of [[15, 11, 36, 5], [-30, 9, 12, 2], [36, 7.5, 12, 2]] as const) {
			const [fx, fy] = P(dx, dy), reach = len * u * thrust * flicker, flame = ctx.createLinearGradient(0, fy, 0, fy + reach);
			flame.addColorStop(0, C.hi);
			flame.addColorStop(0.35, C.hot);
			flame.addColorStop(1, alpha(C.hot, 0));
			ctx.fillStyle = flame;
			ctx.beginPath();
			ctx.moveTo(fx - wide * u, fy);
			ctx.lineTo(fx + wide * u, fy);
			ctx.lineTo(fx, fy + reach);
			ctx.closePath();
			ctx.fill();
		}
	}
	ctx.lineWidth = Math.max(1.1, 1.2 * u);
	ctx.strokeStyle = C.hi;
	const foot = 9 + 13 * legs;
	for (const gx of [-24, 28]) {
		shape([[gx - 1.6, 8], [gx + 1.6, 8], [gx + 1.6, 8 + 7 * legs], [gx - 1.6, 8 + 7 * legs]], C.tube);
		line([[gx, 8 + 7 * legs], [gx, foot - 1.5]], C.hi);
		line([[gx + 7, 8.5], [gx + 1.6, 8 + 8 * legs]], alpha(C.hi, 0.7));
		shape([[gx - 5, foot - 1.5], [gx + 5, foot - 1.5], [gx + 6, foot], [gx - 6, foot]], C.tube);
	}
	shape([[24, -11], [36, -23], [43, -23], [41, -9]], C.tube, 8);
	shape([[-6, -14], [18, -14], [20, -11], [-8, -11]], C.tube);
	for (const [gx, gw, gh] of [[-4, 3, 2], [1, 5, 1.4], [13, 4, 1.4]] as const) shape([[gx, -14 - gh], [gx + gw, -14 - gh], [gx + gw, -14], [gx, -14]], C.tube);
	line([[10, -14], [10, -20]], C.hi);
	line([[8.5, -18], [11.5, -18]], C.hi);
	const hull: [number, number][] = [[-47, 3], [-42, -2], [-30, -8], [-12, -11], [22, -11], [34, -8], [44, -6], [47, 0], [42, 6], [30, 9], [-30, 9], [-40, 7]];
	shape(hull, C.tube, 12);
	ctx.save();
	path(hull);
	ctx.clip();
	ctx.fillStyle = alpha(C.dim, 0.35);
	ctx.fillRect(...P(-50, 3), 100 * u, 8 * u);
	ctx.restore();
	line([[-44, 3], [44, 3]], alpha(C.mid, 0.7));
	for (const sx of [-22, -2]) line([[sx, sx === -22 ? -9.5 : -11], [sx, 9]], alpha(C.mid, 0.7));
	line([[34, -8], [38, 3]], alpha(C.mid, 0.7));
	shape([[-43, -0.5], [-31.5, -6.6], [-25, -7.4], [-27, -3.6], [-38.5, 0.9]], alpha(C.hi, 0.45));
	for (const k of [0.33, 0.66]) line([[-43 + 18 * k, -0.5 - 6.9 * k], [-38.5 + 11.5 * k, 0.9 - 4.5 * k]], C.tube);
	shape([[-33, 9], [-27, 9], [-27.5, 10.5], [-32.5, 10.5]], C.tube);
	for (let i = 0; i < 4; i++) {
		ctx.fillStyle = alpha(C.n, 0.5 + 0.4 * hash(i + Math.floor(at * 0.7)));
		ctx.fillRect(...P(-19 + i * 4, -6), 2 * u, 1.6 * u);
	}
	const pod: [number, number][] = [[6, -7], [26, -7], [29, -3], [29, 4], [26, 6], [6, 6], [3, 3], [3, -4]];
	shape(pod, C.tube, 6);
	ctx.save();
	path(pod);
	ctx.clip();
	ctx.lineWidth = 1.6 * u;
	for (let i = -2; i < 6; i++) line([[2 + i * 2.6, 7], [8 + i * 2.6, -8]], alpha(C.hot, 0.7));
	ctx.restore();
	ctx.lineWidth = Math.max(1.1, 1.2 * u);
	line([[10, -7], [10, 6]], C.hi);
	for (const gx of [21, 23, 25]) line([[gx, -4], [gx, 3]], alpha(C.mid, 0.8));
	shape([[10, 6], [20, 6], [21.5, 11], [8.5, 11]], C.tube);
	line([[9.5, 8.5], [20.5, 8.5]], alpha(C.mid, 0.8));
	if (u * 2.6 >= 5) {
		ctx.font = `bold ${2.6 * u}px ${FONT}`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = alpha(C.n, 0.75);
		ctx.fillText("CMC·OTAGO", ...P(-12, 6));
	}
	const blink = Math.floor(at * 2.2) % 2, strobe = Math.floor(at * 6) % 5 === 0;
	ctx.shadowBlur = 12;
	ctx.fillStyle = blink ? C.hot : alpha(C.hot, 0.2);
	ctx.shadowColor = C.hot;
	ctx.fillRect(...P(40, -24.5), 2.6 * u, 2.6 * u);
	ctx.fillStyle = strobe ? C.hi : alpha(C.hi, 0.25);
	ctx.shadowColor = C.hi;
	ctx.fillRect(...P(-48.5, 1.8), 2.2 * u, 2.2 * u);
	ctx.fillRect(...P(-1, 9), 2.2 * u, 1.4 * u);
	ctx.shadowBlur = 0;
	ctx.restore();
}

/** Draws one frame of the intro. Loaded only when the intro or the ending is shown. */
export function drawIntro(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame): void {
	if (f.scene === "transmission") transmission(ctx, w, h, f);
	else if (f.scene === "sos") sos(ctx, w, h, f);
	else if (f.scene === "cut") cut(ctx, w, h, f);
	else if (f.scene === "moon") moon(ctx, w, h, f);
	else if (f.scene === "section") section(ctx, w, h, f);
	else descent(ctx, w, h, f);
	for (const c of f.cards) card(ctx, w, h, c);
}

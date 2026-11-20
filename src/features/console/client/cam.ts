import { alpha, C } from "./palette.ts";

export const CAM_W = 144, CAM_H = 24;

export type CamScene = "static" | "standby" | "bay" | "idle" | "moving" | "gathering" | "reading" | "blocked";

/** What one drone's camera sees this frame: a scene, how far along a job is, the room it is in, and what's overlaid. */
export interface CamView {
	scene: CamScene;
	progress: number;
	room: number;
	heading: number;
	scanning: boolean;
	luring: boolean;
	threat: boolean;
	rad: boolean;
}

const hash = (i: number): number => {
	const x = Math.sin(i * 91.7 + 47.3) * 43758.5453;
	return x - Math.floor(x);
};

const CX = CAM_W / 2, CY = CAM_H / 2, BACK_W = 26, BACK_H = 7;

function frameAt(ctx: CanvasRenderingContext2D, depth: number, sway: number, colour: string): void {
	const k = 1 / (1 + depth * 1.8), w = BACK_W + (CAM_W + 40 - BACK_W) * k, h = BACK_H + (CAM_H + 10 - BACK_H) * k;
	ctx.strokeStyle = colour;
	ctx.strokeRect(Math.round(CX + sway * (1 - k) - w / 2) + 0.5, Math.round(CY - h / 2) + 0.5, Math.round(w), Math.round(h));
}

function corridor(ctx: CanvasRenderingContext2D, sway: number, travel: number, bright: number, room: number): void {
	const bx = CX + sway;
	ctx.lineWidth = 1;
	ctx.strokeStyle = alpha(C.mid, 0.8 * bright);
	ctx.beginPath();
	for (const [sx, sy, ex, ey] of [[0, 0, -1, -1], [CAM_W, 0, 1, -1], [0, CAM_H, -1, 1], [CAM_W, CAM_H, 1, 1]] as const) {
		ctx.moveTo(sx, sy);
		ctx.lineTo(bx + (ex * BACK_W) / 2, CY + (ey * BACK_H) / 2);
	}
	ctx.stroke();
	ctx.fillStyle = alpha(C.dim, 0.5 * bright);
	ctx.fillRect(Math.round(bx - BACK_W / 2), Math.round(CY - BACK_H / 2), BACK_W, BACK_H);
	if (hash(room) > 0.4) {
		ctx.fillStyle = alpha(C.n, 0.5 * bright);
		ctx.fillRect(Math.round(bx - 2), Math.round(CY - BACK_H / 2) + 1, 4, 1);
	}
	for (let i = 0; i < 6; i++) {
		const depth = (((i - travel) % 6) + 6) % 6;
		frameAt(ctx, depth, sway, alpha(C.n, (0.3 + 0.6 / (1 + depth)) * bright));
	}
}

function progressBar(ctx: CanvasRenderingContext2D, progress: number): void {
	ctx.fillStyle = alpha(C.dim, 0.9);
	ctx.fillRect(2, CAM_H - 3, CAM_W - 4, 2);
	ctx.fillStyle = C.hi;
	ctx.fillRect(2, CAM_H - 3, Math.round((CAM_W - 4) * Math.max(0, Math.min(1, progress))), 2);
}

function crateAndClaw(ctx: CanvasRenderingContext2D, t: number, progress: number): void {
	const x = CX - 9, y = CY - 3;
	ctx.fillStyle = C.tube;
	ctx.fillRect(x, y, 18, 11);
	ctx.strokeStyle = C.n;
	ctx.strokeRect(x + 0.5, y + 0.5, 17, 10);
	ctx.beginPath();
	ctx.moveTo(x + 1, y + 1);
	ctx.lineTo(x + 17, y + 10);
	ctx.moveTo(x + 17, y + 1);
	ctx.lineTo(x + 1, y + 10);
	ctx.stroke();
	const reach = Math.sin(t * 9) * 2, tipX = CX + 12 + reach, tipY = CY + 1 - progress * 2;
	ctx.strokeStyle = C.hi;
	ctx.beginPath();
	ctx.moveTo(CAM_W - 10, CAM_H);
	ctx.lineTo(CAM_W - 22, CY + 3);
	ctx.lineTo(tipX + 3, tipY);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(tipX + 3, tipY);
	ctx.lineTo(tipX - 1, tipY - 2);
	ctx.moveTo(tipX + 3, tipY);
	ctx.lineTo(tipX - 1, tipY + 2);
	ctx.stroke();
	ctx.fillStyle = C.hot;
	for (let i = 0; i < 4; i++) if (Math.random() < 0.6) ctx.fillRect(Math.round(tipX - 2 + Math.random() * 5), Math.round(tipY - 3 + Math.random() * 6), 1, 1);
}

function terminal(ctx: CanvasRenderingContext2D, t: number): void {
	const x = CX - 22, y = CY - 8, w = 44, h = 15;
	ctx.fillStyle = C.tube;
	ctx.fillRect(x, y, w, h);
	ctx.strokeStyle = C.mid;
	ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
	const scroll = Math.floor(t * 6);
	for (let row = 0; row < 5; row++) {
		const line = scroll + row, length = 6 + Math.floor(hash(line) * 30);
		ctx.fillStyle = alpha(C.n, row === 4 ? 1 : 0.55 + row * 0.1);
		ctx.fillRect(x + 3, y + 2 + row * 2, row === 4 ? Math.min(length, Math.floor((t * 60) % 40)) : length, 1);
	}
	if (Math.floor(t * 3) % 2) {
		ctx.fillStyle = C.hi;
		ctx.fillRect(x + 3, y + 12, 2, 1);
	}
	ctx.fillStyle = alpha(C.dim, 0.9);
	ctx.fillRect(x + w / 2 - 6, y + h, 12, 2);
}

function door(ctx: CanvasRenderingContext2D, t: number): void {
	const x = CX - 20, y = 2, w = 40, h = CAM_H - 4;
	ctx.fillStyle = C.tube;
	ctx.fillRect(x, y, w, h);
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.clip();
	ctx.strokeStyle = alpha(C.hot, Math.floor(t * 2) % 2 ? 0.85 : 0.45);
	ctx.lineWidth = 2;
	for (let i = -4; i < 12; i++) {
		ctx.beginPath();
		ctx.moveTo(x + i * 6, y + h);
		ctx.lineTo(x + i * 6 + h, y);
		ctx.stroke();
	}
	ctx.restore();
	ctx.lineWidth = 1;
	ctx.strokeStyle = C.n;
	ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
	ctx.beginPath();
	ctx.moveTo(CX + 0.5, y);
	ctx.lineTo(CX + 0.5, y + h);
	ctx.stroke();
}

function bay(ctx: CanvasRenderingContext2D, t: number): void {
	corridor(ctx, 0, 0, 0.6, 0);
	ctx.fillStyle = C.tube;
	ctx.strokeStyle = C.mid;
	for (const side of [-1, 1]) {
		const x = side < 0 ? 6 : CAM_W - 22;
		ctx.fillRect(x, CY - 5, 16, 10);
		ctx.strokeRect(x + 0.5, CY - 4.5, 15, 9);
	}
	ctx.fillStyle = Math.floor(t * 1.5) % 2 ? C.n : alpha(C.n, 0.25);
	ctx.fillRect(13, CY - 1, 2, 2);
	ctx.fillRect(CAM_W - 15, CY - 1, 2, 2);
}

function sweep(ctx: CanvasRenderingContext2D, t: number, room: number): void {
	const x = ((t * 0.9) % 1) * (CAM_W + 30) - 15;
	const trail = ctx.createLinearGradient(x - 30, 0, x, 0);
	trail.addColorStop(0, alpha(C.hi, 0));
	trail.addColorStop(1, alpha(C.hi, 0.35));
	ctx.fillStyle = trail;
	ctx.fillRect(x - 30, 0, 30, CAM_H);
	ctx.fillStyle = C.hi;
	ctx.fillRect(Math.round(x), 0, 1, CAM_H);
	for (let i = 0; i < 3; i++) {
		const bx = hash(room * 7 + i) * CAM_W;
		if (bx < x && x - bx < 50) {
			ctx.fillStyle = alpha(C.hot, 1 - (x - bx) / 50);
			ctx.fillRect(Math.round(bx), Math.round(3 + hash(room * 7 + i + 3) * (CAM_H - 6)), 2, 2);
		}
	}
}

function rings(ctx: CanvasRenderingContext2D, t: number): void {
	for (let i = 0; i < 3; i++) {
		const k = ((t * 0.8 + i / 3) % 1), r = 2 + k * 40;
		ctx.strokeStyle = alpha(C.hot, 0.8 * (1 - k));
		ctx.beginPath();
		ctx.ellipse(CX, CY, r, r * 0.45, 0, 0, Math.PI * 2);
		ctx.stroke();
	}
}

function lifeform(ctx: CanvasRenderingContext2D, t: number, room: number): void {
	if (Math.sin(t * 2.3 + room) < -0.3) return;
	const x = Math.round(CX - 22 + Math.sin(t * 0.7 + room) * 22), y = CY - 2;
	ctx.fillStyle = C.tube;
	ctx.beginPath();
	ctx.ellipse(x, y, 9, 4, -0.25, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillRect(x - 3, y + 2, 6, 10);
	ctx.strokeStyle = C.hot;
	ctx.beginPath();
	ctx.ellipse(x, y, 9, 4, -0.25, 0, Math.PI * 2);
	ctx.stroke();
	ctx.fillStyle = C.hot;
	ctx.fillRect(x - 6, y - 1, 2, 1);
	ctx.strokeRect(x - 2.5, y + 2.5, 5, 9);
}

/** Draws one drone's camera feed: the scene for what it's doing, its overlays, then static, scanlines and a rolling bar. */
export function drawCam(ctx: CanvasRenderingContext2D, view: CamView, t: number, threatPixel: readonly [number, number, number], phosphor: (v: number) => readonly [number, number, number]): void {
	ctx.fillStyle = C.tube;
	ctx.fillRect(0, 0, CAM_W, CAM_H);
	const s = view.scene;
	if (s === "idle") corridor(ctx, Math.sin(t * 0.4 + view.room) * 10, 0, 0.75, view.room);
	else if (s === "moving") corridor(ctx, Math.sin(view.heading) * 14 + Math.sin(t * 7) * 1.2, t * 2.4, 1, view.room);
	else if (s === "bay") bay(ctx, t);
	else if (s === "gathering") {
		corridor(ctx, 0, 0, 0.45, view.room);
		crateAndClaw(ctx, t, view.progress);
		progressBar(ctx, view.progress);
	} else if (s === "reading") {
		corridor(ctx, 0, 0, 0.35, view.room);
		terminal(ctx, t);
		progressBar(ctx, view.progress);
	} else if (s === "blocked") {
		corridor(ctx, 0, 0, 0.5, view.room);
		door(ctx, t);
	}
	if (s !== "static" && s !== "standby") {
		if (view.threat) lifeform(ctx, t, view.room);
		if (view.scanning) sweep(ctx, t, view.room);
		if (view.luring) rings(ctx, t);
	}
	const image = ctx.getImageData(0, 0, CAM_W, CAM_H), px = image.data;
	const roll = Math.floor(t * 18) % CAM_H, grain = s === "static" ? 1 : view.rad ? 0.25 : s === "standby" ? 0.02 : 0.025;
	for (let p = 0; p < CAM_W * CAM_H; p++) {
		const n = Math.random(), row = Math.floor(p / CAM_W), i = p * 4;
		if (s === "static") {
			const [r, g, b] = phosphor(n * 170);
			px[i] = r;
			px[i + 1] = g;
			px[i + 2] = b;
			continue;
		}
		if (view.threat && n < 0.08) {
			[px[i], px[i + 1], px[i + 2]] = threatPixel;
			continue;
		}
		if (n < grain) {
			const [r, g, b] = phosphor(70 + n * 1100);
			px[i] = Math.max(px[i]!, r);
			px[i + 1] = Math.max(px[i + 1]!, g);
			px[i + 2] = Math.max(px[i + 2]!, b);
		}
		const lift = row === roll || row === (roll + 1) % CAM_H ? 1.35 : row % 2 ? 0.8 : 1;
		px[i] = Math.min(255, px[i]! * lift);
		px[i + 1] = Math.min(255, px[i + 1]! * lift);
		px[i + 2] = Math.min(255, px[i + 2]! * lift);
	}
	ctx.putImageData(image, 0, 0);
}

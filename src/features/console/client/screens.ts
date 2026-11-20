import { difficulty, type Drone, type DroneSpec, FINAL_SITE, type Game, MK2, type Mission, PRICE, regionOf, type Room, lureReach, roomThreat, siteName } from "../../game/shared/index.ts";
import { drawDrone } from "./drone-art.ts";
import { alpha, C } from "./palette.ts";

const FONT = 'Menlo,Consolas,"Courier New",monospace';

const GLYPH: Record<string, readonly string[]> = {
	D: ["1110", "1001", "1001", "1001", "1110"],
	E: ["1111", "1000", "1110", "1000", "1111"],
	R: ["1110", "1001", "1110", "1010", "1001"],
	L: ["1000", "1000", "1000", "1000", "1111"],
	I: ["111", "010", "010", "010", "111"],
	C: ["0111", "1000", "1000", "1000", "0111"],
	T: ["11111", "00100", "00100", "00100", "00100"],
	A: ["0110", "1001", "1111", "1001", "1001"],
	U: ["1001", "1001", "1001", "1001", "0110"],
	N: ["1001", "1101", "1011", "1001", "1001"],
};

type SceneModule = typeof import("./intro-scene.ts");

export const bar = (f: number, n: number): string => {
	const c = Math.round(Math.max(0, Math.min(1, f)) * n);
	return "█".repeat(c) + "░".repeat(n - c);
};
export const pips = (n: number, max: number): string => "■".repeat(n) + "□".repeat(max - n);

interface TextStyle {
	bold?: boolean;
	blur?: number;
	align?: CanvasTextAlign;
}

/** The big window: the ship's schematic during a boarding, else the title, drydock or game-over screen. */
export class Screens {
	readonly #canvas: HTMLCanvasElement;
	readonly #ctx: CanvasRenderingContext2D;
	#w = 0;
	#h = 0;
	#dpr = 1;
	#scale = 20;
	#ox = 0;
	#oy = 0;
	#fitted: Mission | null = null;
	#scene: SceneModule | null = null;
	#sceneLoading = false;
	readonly #stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8 }));

	constructor(canvas: HTMLCanvasElement) {
		this.#canvas = canvas;
		this.#ctx = canvas.getContext("2d")!;
	}

	get size(): { width: number; height: number } {
		return { width: this.#w, height: this.#h };
	}

	resize(): void {
		this.#dpr = Math.min(2, devicePixelRatio || 1);
		this.#w = this.#canvas.clientWidth;
		this.#h = this.#canvas.clientHeight;
		this.#canvas.width = Math.max(1, Math.round(this.#w * this.#dpr));
		this.#canvas.height = Math.max(1, Math.round(this.#h * this.#dpr));
		this.#fitted = null;
	}

	/** The room, door or dock under a click, as the word to type for it. */
	wordAt(game: Game, clientX: number, clientY: number): string | null {
		const m = game.mission;
		if (game.mode !== "mission" || m === null) return null;
		const r = this.#canvas.getBoundingClientRect();
		const mx = (clientX - r.left - this.#ox) / this.#scale, my = (clientY - r.top - this.#oy) / this.#scale;
		const door = m.doors.find((d) => Math.abs(mx - d.x) < (d.o === "v" ? 0.7 : 1) && Math.abs(my - d.y) < (d.o === "v" ? 1 : 0.7));
		if (door !== undefined) return door.name;
		const k = m.dockBox;
		if (mx >= k.x && mx <= k.x + k.w && my >= k.y && my <= k.y + k.h) return "dock";
		const room = m.rooms.find((q) => mx >= q.x + 0.5 && mx <= q.x + q.w - 0.5 && my >= q.y + 0.5 && my <= q.y + q.h - 0.5);
		return room === undefined ? null : `r${room.num}`;
	}

	draw(game: Game, dt: number, now: number): void {
		const ctx = this.#ctx;
		for (const s of this.#stars) {
			s.x -= s.z * dt * (game.mode === "drydock" ? 0.06 : 0.014);
			if (s.x < 0) {
				s.x += 1;
				s.y = Math.random();
			}
		}
		ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
		ctx.clearRect(0, 0, this.#w, this.#h);
		if (this.#w < 20 || this.#h < 20) return;
		const m = game.mission;
		if (game.mode === "mission" && m !== null) this.#mission(m, game.labels);
		else if (game.mode === "intro" || game.mode === "ending") this.#cinema(game, now);
		else if (game.mode === "drydock") this.#drydock(game, now);
		else if (game.mode === "over") this.#over(game);
		else this.#menu(game, now);
	}

	#X = (x: number): number => this.#ox + x * this.#scale;
	#Y = (y: number): number => this.#oy + y * this.#scale;

	#fit(m: Mission): void {
		if (this.#fitted === m) return;
		this.#fitted = m;
		let x0 = m.dockBox.x, y0 = m.dockBox.y - 1, x1 = 0, y1 = m.dockBox.y + m.dockBox.h;
		for (const r of m.rooms) {
			x0 = Math.min(x0, r.x);
			y0 = Math.min(y0, r.y);
			x1 = Math.max(x1, r.x + r.w);
			y1 = Math.max(y1, r.y + r.h);
		}
		const pad = Math.min(24, this.#w * 0.03);
		this.#scale = Math.max(4, Math.min((this.#w - pad * 2) / (x1 - x0), (this.#h - pad * 2 - 14) / (y1 - y0)));
		this.#ox = (this.#w - (x1 - x0) * this.#scale) / 2 - x0 * this.#scale;
		this.#oy = (this.#h - 14 - (y1 - y0) * this.#scale) / 2 - y0 * this.#scale;
	}

	#glow(colour: string, blur = 8): void {
		this.#ctx.strokeStyle = colour;
		this.#ctx.shadowColor = colour;
		this.#ctx.shadowBlur = blur;
	}

	#plain(): void {
		this.#ctx.shadowBlur = 0;
	}

	#text(s: string, x: number, y: number, colour: string, size: number, { bold = false, blur = 6, align = "center" }: TextStyle = {}): void {
		const ctx = this.#ctx;
		ctx.font = `${bold ? "bold " : ""}${size}px ${FONT}`;
		ctx.textAlign = align;
		ctx.textBaseline = "middle";
		ctx.fillStyle = colour;
		ctx.shadowColor = colour;
		ctx.shadowBlur = blur;
		ctx.fillText(s, x, y);
		this.#plain();
	}

	#inverse(s: string, x: number, y: number, colour: string, size: number, align: "center" | "left" = "center"): void {
		const ctx = this.#ctx;
		ctx.font = `bold ${size}px ${FONT}`;
		const w = ctx.measureText(s).width + size * 0.8, left = align === "center" ? x - w / 2 : x;
		ctx.fillStyle = colour;
		ctx.shadowColor = colour;
		ctx.shadowBlur = 14;
		ctx.fillRect(left, y - size * 0.72, w, size * 1.44);
		this.#plain();
		this.#text(s, left + w / 2, y + 1, C.tube, size, { bold: true, blur: 0 });
	}

	#triangle(x: number, y: number, s: number, colour: string): void {
		const ctx = this.#ctx;
		ctx.lineWidth = 1.6;
		this.#glow(colour, 10);
		ctx.beginPath();
		ctx.moveTo(x, y - s);
		ctx.lineTo(x + s * 1.05, y + s * 0.8);
		ctx.lineTo(x - s * 1.05, y + s * 0.8);
		ctx.closePath();
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x, y - s * 0.35);
		ctx.lineTo(x, y + s * 0.2);
		ctx.stroke();
		this.#plain();
	}

	/** The rooms a sounding decoy carries to, pulsing outward from BUOY one door at a time. */
	#decoy(m: Mission): void {
		const ctx = this.#ctx, S = this.#scale;
		for (const [i, steps] of lureReach(m)) {
			const r = m.rooms[i];
			if (r === undefined) continue;
			const x = this.#X(r.x + 0.5), y = this.#Y(r.y + 0.5), w = (r.w - 1) * S, h = (r.h - 1) * S;
			const wave = 0.5 + 0.5 * Math.sin(m.t * 5 - steps * 1.3);
			ctx.fillStyle = alpha(C.hot, 0.06 + 0.14 * wave);
			ctx.fillRect(x, y, w, h);
			ctx.lineWidth = 1.5;
			ctx.setLineDash([3, 5]);
			ctx.strokeStyle = alpha(C.hot, 0.4 + 0.5 * wave);
			ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
			ctx.setLineDash([]);
		}
	}

	#room(m: Mission, r: Room, i: number, watched: Set<number>, labels: boolean): void {
		const ctx = this.#ctx, S = this.#scale;
		const x = this.#X(r.x + 0.5), y = this.#Y(r.y + 0.5), w = (r.w - 1) * S, h = (r.h - 1) * S, here = watched.has(i);
		const threat = roomThreat(m, i), danger = threat.seen ? 1 : threat.suspected > 0 ? 0.25 + 0.35 * threat.suspected : 0;
		if (danger > 0) {
			ctx.fillStyle = alpha(C.red, threat.seen ? 0.2 + 0.08 * Math.sin(m.t * 6) : 0.03 + 0.07 * threat.suspected);
			ctx.fillRect(x, y, w, h);
		} else if (here) {
			ctx.fillStyle = alpha(C.n, 0.06);
			ctx.fillRect(x, y, w, h);
		}
		ctx.lineWidth = 1;
		ctx.strokeStyle = r.seen ? alpha(C.mid, 0.3) : alpha(C.dim, 0.38);
		ctx.beginPath();
		for (let gx = 1; gx < r.w - 1; gx++) {
			ctx.moveTo(Math.round(x + gx * S) + 0.5, y);
			ctx.lineTo(Math.round(x + gx * S) + 0.5, y + h);
		}
		for (let gy = 1; gy < r.h - 1; gy++) {
			ctx.moveTo(x, Math.round(y + gy * S) + 0.5);
			ctx.lineTo(x + w, Math.round(y + gy * S) + 0.5);
		}
		ctx.stroke();
		if (labels) this.#text(`r${r.num}`, x + w / 2, y + h / 2, r.seen ? alpha(C.n, 0.3) : alpha(C.dim, 0.6), Math.max(11, Math.min(h * 0.42, w * 0.32)), { blur: 0 });
		ctx.lineWidth = here ? 2.2 : 1.6;
		this.#glow(r.seen ? (here ? C.hi : C.n) : C.dim, here ? 14 : r.seen ? 7 : 3);
		ctx.strokeRect(x, y, w, h);
		if (danger > 0) {
			ctx.lineWidth = threat.seen ? 2.4 : 1.8;
			if (!threat.seen) ctx.setLineDash([6, 4]);
			this.#glow(alpha(C.red, danger), threat.seen ? 16 : 8);
			ctx.strokeRect(x, y, w, h);
			ctx.setLineDash([]);
		}
		this.#plain();
		if (!r.seen) return;
		if (r.rad) {
			const pulse = 0.55 + 0.45 * Math.sin(m.t * 4);
			for (const ax of [0.9, r.w - 1.9]) if (ax >= 0.9) this.#triangle(this.#X(r.x + ax + 0.5), this.#Y(r.y + 1.4), S * 0.36, alpha(C.hot, pulse));
		}
		if (r.purge) {
			const px = this.#X(r.x + r.w - 1.2), py = this.#Y(r.y + r.h - 1.2);
			ctx.lineWidth = 1.3;
			ctx.setLineDash([3, 2]);
			this.#glow(r.purgeUsed ? alpha(C.dim, 0.8) : C.mid, 6);
			ctx.beginPath();
			ctx.arc(px, py, S * 0.3, 0, 7);
			ctx.stroke();
			ctx.setLineDash([]);
			this.#plain();
			if (!r.purgeUsed) this.#text("P", px, py + 1, C.mid, Math.max(9, S * 0.32), { blur: 4 });
		}
		if (r.terminal !== null) {
			const tx = this.#X(r.x + 1.3), ty = this.#Y(r.y + r.h - 1.3), z = S * 0.26, colour = r.terminal.read ? C.dim : C.hi;
			ctx.lineWidth = 1.5;
			this.#glow(colour, r.terminal.read ? 2 : 10);
			ctx.strokeRect(tx - z, ty - z * 0.8, z * 2, z * 1.6);
			ctx.beginPath();
			for (let k = -1; k <= 1; k++) {
				ctx.moveTo(tx - z * 0.6, ty + k * z * 0.4);
				ctx.lineTo(tx + z * (r.terminal.read ? 0.2 : 0.6), ty + k * z * 0.4);
			}
			ctx.stroke();
			this.#plain();
		}
		for (const item of r.items) {
			const sx = this.#X(item.x), sy = this.#Y(item.y), k = 1 + 0.08 * Math.sin(m.t * 3 + item.x);
			ctx.lineWidth = 1.6;
			this.#glow(item.kind === "fuel" ? C.hi : C.n, 10);
			if (item.kind === "core") {
				const z = S * 0.24 * k;
				ctx.beginPath();
				ctx.moveTo(sx, sy - z * 1.3);
				ctx.lineTo(sx + z, sy);
				ctx.lineTo(sx, sy + z * 1.3);
				ctx.lineTo(sx - z, sy);
				ctx.closePath();
				ctx.stroke();
				ctx.fillStyle = C.hi;
				ctx.fillRect(sx - z * 0.3, sy - z * 0.3, z * 0.6, z * 0.6);
			} else if (item.kind === "fuel") {
				const z = S * 0.22 * k;
				ctx.beginPath();
				ctx.arc(sx, sy, z, 0, 7);
				ctx.stroke();
				ctx.fillStyle = C.hi;
				ctx.beginPath();
				ctx.arc(sx, sy, z * 0.4, 0, 7);
				ctx.fill();
			} else {
				const z = S * 0.17 * k;
				ctx.strokeRect(sx - z, sy - z, z * 2, z * 2);
				ctx.fillStyle = C.n;
				ctx.fillRect(sx - z * 0.35, sy - z * 0.35, z * 0.7, z * 0.7);
				if (item.v > 1) ctx.strokeRect(sx + z * 1.5, sy - z * 0.5, z * 1.1, z * 1.1);
			}
			this.#plain();
		}
	}

	#doors(m: Mission, labels: boolean): void {
		const ctx = this.#ctx, S = this.#scale;
		for (const d of m.doors) {
			const v = d.o === "v", bw = (v ? 1.35 : 1.95) * S, bh = (v ? 1.95 : 1.35) * S, x = this.#X(d.x) - bw / 2, y = this.#Y(d.y) - bh / 2;
			const lit = d.air || (d.a < m.rooms.length && m.rooms[d.a]!.seen) || (d.b < m.rooms.length && m.rooms[d.b]!.seen);
			const colour = d.air ? C.hi : lit ? C.n : C.mid;
			ctx.fillStyle = d.open ? alpha(d.air ? C.hi : lit ? C.n : C.mid, d.air ? 0.22 : lit ? 0.2 : 0.12) : C.tube;
			ctx.fillRect(x, y, bw, bh);
			ctx.lineWidth = 1.5;
			if (!d.open) ctx.setLineDash([3, 3]);
			this.#glow(colour, d.bump > 0 ? 18 : lit ? 7 : 3);
			ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
			ctx.setLineDash([]);
			ctx.lineWidth = 2;
			ctx.beginPath();
			if (d.open) {
				const k = S * 0.18;
				if (v) {
					ctx.moveTo(x + 3, y + k);
					ctx.lineTo(x + bw - 3, y + k);
					ctx.moveTo(x + 3, y + bh - k);
					ctx.lineTo(x + bw - 3, y + bh - k);
				} else {
					ctx.moveTo(x + k, y + 3);
					ctx.lineTo(x + k, y + bh - 3);
					ctx.moveTo(x + bw - k, y + 3);
					ctx.lineTo(x + bw - k, y + bh - 3);
				}
			} else if (v) {
				ctx.moveTo(x + bw * 0.18, y + 4);
				ctx.lineTo(x + bw * 0.18, y + bh - 4);
			} else {
				ctx.moveTo(x + 4, y + bh * 0.18);
				ctx.lineTo(x + bw - 4, y + bh * 0.18);
			}
			ctx.stroke();
			this.#plain();
			if (labels) this.#text(d.name, this.#X(d.x) + (v ? S * 0.08 : 0), this.#Y(d.y) + (v ? 0 : S * 0.08), colour, Math.max(10, S * 0.46), { blur: 5 });
		}
	}

	#dock(m: Mission, labels: boolean): void {
		const ctx = this.#ctx, S = this.#scale, k = m.dockBox;
		ctx.lineWidth = 1.8;
		this.#glow(C.hi, 10);
		ctx.strokeRect(this.#X(k.x), this.#Y(k.y), k.w * S, k.h * S);
		this.#plain();
		ctx.strokeStyle = alpha(C.n, 0.2);
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let i = 1; i < k.w; i++) {
			ctx.moveTo(this.#X(k.x + i), this.#Y(k.y));
			ctx.lineTo(this.#X(k.x + i), this.#Y(k.y + k.h));
		}
		ctx.stroke();
		const fs = Math.max(10, S * 0.4);
		if (labels) this.#inverse("DOCK", this.#X(k.cx), this.#Y(k.y) - fs / 2 - 6, C.n, fs);
	}

	#drone(m: Mission, d: Drone): void {
		const ctx = this.#ctx, S = this.#scale, x = this.#X(d.x), y = this.#Y(d.y), z = S * 0.34;
		if (!d.alive) {
			if (!d.wreck) return;
			ctx.lineWidth = 1.5;
			ctx.strokeStyle = alpha(C.dim, 0.9);
			ctx.beginPath();
			ctx.moveTo(x - z, y - z);
			ctx.lineTo(x + z, y + z);
			ctx.moveTo(x + z, y - z);
			ctx.lineTo(x - z, y + z);
			ctx.stroke();
			return;
		}
		if (d.path.length > 0) {
			ctx.setLineDash([2, 5]);
			ctx.lineWidth = 1.2;
			ctx.strokeStyle = alpha(C.hi, 0.55);
			ctx.beginPath();
			ctx.moveTo(x, y);
			for (const p of d.path) ctx.lineTo(this.#X(p.x), this.#Y(p.y));
			ctx.stroke();
			ctx.setLineDash([]);
		}
		const colour = d.hit > 0 && Math.floor(m.t * 14) % 2 ? C.hot : C.hi;
		this.#glow(colour, 14);
		ctx.lineWidth = 1.7;
		for (const rr of [z * 1.7, z * 2.25]) {
			ctx.beginPath();
			ctx.arc(x, y, rr, d.dir - 0.55, d.dir + 0.55);
			ctx.stroke();
		}
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(d.dir);
		ctx.fillStyle = colour;
		ctx.shadowColor = colour;
		ctx.shadowBlur = 14;
		ctx.fillRect(-z, -z, z * 2, z * 2);
		ctx.restore();
		this.#plain();
		this.#text(String(d.id), x, y + 1, C.tube, Math.max(10, S * 0.5), { bold: true, blur: 0 });
		if (d.state === "GATHERING") {
			this.#glow(C.n, 8);
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(x, y, z * 1.35, -Math.PI / 2, -Math.PI / 2 + (1 - d.gather / (d.gatherFor || 2)) * Math.PI * 2);
			ctx.stroke();
			this.#plain();
		}
		if (d.cargo + d.fuel > 0) this.#text(`+${d.cargo + d.fuel}`, x + z * 1.7, y - z * 1.5, C.hi, Math.max(10, S * 0.36));
	}

	#effects(m: Mission): void {
		const ctx = this.#ctx, S = this.#scale;
		for (const f of m.fx) {
			const k = f.t / f.max, X = this.#X(f.x), Y = this.#Y(f.y);
			if (f.type === "blip") {
				ctx.strokeStyle = alpha(C.hot, 1 - k);
				ctx.lineWidth = 1.6;
				for (let i = 0; i < 2; i++) {
					ctx.beginPath();
					ctx.arc(X, Y, S * (0.2 + ((f.t * 1.4 + i * 0.5) % 1) * 0.9), 0, 7);
					ctx.stroke();
				}
				ctx.fillStyle = alpha(C.hot, 1 - k);
				ctx.beginPath();
				ctx.arc(X, Y, S * 0.15, 0, 7);
				ctx.fill();
			} else if (f.type === "scan" || f.type === "ring") {
				ctx.strokeStyle = alpha(C.hi, (f.type === "scan" ? 0.6 : 0.7) * (1 - k));
				ctx.lineWidth = f.type === "scan" ? 2 : 1.3;
				ctx.beginPath();
				ctx.arc(X, Y, f.type === "scan" ? k * S * (f.r ?? 3) * 4.5 : S * (0.3 + k * 2.4), 0, 7);
				ctx.stroke();
			} else if (f.type === "flash" && f.room !== undefined) {
				const r = m.rooms[f.room]!;
				ctx.fillStyle = alpha(C.hi, 0.8 * (1 - k));
				ctx.fillRect(this.#X(r.x + 0.5), this.#Y(r.y + 0.5), (r.w - 1) * S, (r.h - 1) * S);
			} else if (f.type === "boom") {
				ctx.strokeStyle = alpha(C.hot, 1 - k);
				ctx.lineWidth = 2;
				for (let i = 0; i < 8; i++) {
					const a = (i / 8) * 6.283, r0 = S * k * 0.6, r1 = S * (0.2 + k * 1.3);
					ctx.beginPath();
					ctx.moveTo(X + Math.cos(a) * r0, Y + Math.sin(a) * r0);
					ctx.lineTo(X + Math.cos(a) * r1, Y + Math.sin(a) * r1);
					ctx.stroke();
				}
			}
		}
	}

	#target(m: Mission): void {
		const t = m.tutorial;
		const target = t === null ? null : t.steps[t.i]!.target;
		if (target === null) return;
		const ctx = this.#ctx, S = this.#scale;
		ctx.setLineDash([6, 4]);
		ctx.lineDashOffset = -m.t * 20;
		ctx.lineWidth = 2;
		this.#glow(alpha(C.hi, 0.45 + 0.45 * Math.sin(m.t * 5)), 16);
		if ("room" in target) {
			const r = m.rooms[target.room]!;
			ctx.strokeRect(this.#X(r.x + 0.5) - 6, this.#Y(r.y + 0.5) - 6, (r.w - 1) * S + 12, (r.h - 1) * S + 12);
		} else if ("door" in target) {
			const d = m.doors[target.door]!;
			ctx.beginPath();
			ctx.arc(this.#X(d.x), this.#Y(d.y), S * 1.5, 0, 7);
			ctx.stroke();
		} else {
			const k = m.dockBox;
			ctx.strokeRect(this.#X(k.x) - 6, this.#Y(k.y) - 6, k.w * S + 12, k.h * S + 12);
		}
		ctx.setLineDash([]);
		ctx.lineDashOffset = 0;
		this.#plain();
	}

	#mission(m: Mission, labels: boolean): void {
		this.#fit(m);
		const ctx = this.#ctx, step = Math.max(14, this.#scale);
		ctx.fillStyle = alpha(C.mid, 0.12);
		for (let gx = this.#ox % step; gx < this.#w; gx += step) for (let gy = this.#oy % step; gy < this.#h; gy += step) ctx.fillRect(gx, gy, 1, 1);
		const watched = new Set(m.drones.filter((d) => d.alive).map((d) => d.node));
		this.#dock(m, labels);
		m.rooms.forEach((r, i) => this.#room(m, r, i, watched, labels));
		this.#decoy(m);
		this.#doors(m, labels);
		this.#target(m);
		this.#effects(m);
		for (const c of m.creatures) {
			if (!c.alive || !c.vis) continue;
			const x = this.#X(c.x), y = this.#Y(c.y), z = this.#scale * 0.34;
			ctx.fillStyle = C.hot;
			ctx.shadowColor = C.hot;
			ctx.shadowBlur = 18;
			ctx.beginPath();
			for (let i = 0; i < 14; i++) {
				const a = (i / 14) * Math.PI * 2 + c.ph * 0.7, rr = z * (i % 2 ? 0.55 : 1) * (1 + 0.12 * Math.sin(c.ph * 9 + i));
				ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
			}
			ctx.closePath();
			ctx.fill();
			this.#plain();
		}
		for (const d of m.drones) if (!d.alive) this.#drone(m, d);
		for (const d of m.drones) if (d.alive) this.#drone(m, d);
		if (m.end !== null) {
			ctx.fillStyle = alpha(C.tube, 0.72);
			ctx.fillRect(0, 0, this.#w, this.#h);
			const fs = Math.min(44, this.#w / 16);
			this.#inverse(m.end === "undock" ? "UNDOCKED" : "SIGNAL LOST", this.#w / 2, this.#h / 2 - fs * 0.3, m.end === "undock" ? C.n : C.hot, fs);
			this.#text(`+${m.bank.scrap} SCRAP · +${m.bank.fuel} FUEL`, this.#w / 2, this.#h / 2 + fs, C.hi, Math.max(12, Math.min(16, this.#w / 50)), { blur: 8 });
		}
	}

	#starfield(streak: boolean): void {
		const ctx = this.#ctx;
		for (const s of this.#stars) {
			ctx.fillStyle = alpha(C.n, 0.25 + s.z * 0.5);
			ctx.fillRect(s.x * this.#w, s.y * this.#h, Math.max(1, streak ? s.z * 22 : 1), 1.4);
		}
	}

	#pixelWord(word: string, cx: number, cy: number, cell: number, colour: string): number {
		const ctx = this.#ctx;
		const cols = [...word].reduce((n, ch) => n + GLYPH[ch]![0]!.length + 1, -1), y0 = cy - 2.5 * cell;
		let x = cx - (cols * cell) / 2;
		ctx.fillStyle = colour;
		ctx.shadowColor = colour;
		ctx.shadowBlur = cell * 0.9;
		for (const ch of word) {
			const rows = GLYPH[ch]!;
			rows.forEach((row, ry) => [...row].forEach((b, rx) => b === "1" && ctx.fillRect(x + rx * cell + 1, y0 + ry * cell + 1, cell - 2, cell - 2)));
			x += (rows[0]!.length + 1) * cell;
		}
		this.#plain();
		return y0 + 5 * cell;
	}

	#menu(game: Game, now: number): void {
		this.#starfield(false);
		const W = this.#w, H = this.#h;
		const cell = Math.max(5, Math.min(W / 54, H / 18));
		const bottom = this.#pixelWord("LACUNA", W / 2, H * 0.25, cell * 1.15, C.n);
		const sub = Math.max(13, cell * 0.9), subY = bottom + sub * 1.6;
		this.#inverse("SALVAGE-OS · CONTRACT 7731-K", W / 2, subY, C.n, sub);
		const f = Math.max(12, Math.min(17, W / 55));
		let y = subY + f * 3;
		const save = game.saves.campaign();
		const options: [string, string][] = [["1", "TERMINAL ORIENTATION"], ["2", "NEW CONTRACT"], ...(save === null ? [] : [["3", `RESUME CONTRACT · SITE ${save.jump}`] as [string, string]]), ["4", `ARCHIVE · ${game.saves.archive().length} LOGS`], ["5", "MISSION DATA"]];
		for (const [key, label] of options) {
			this.#ctx.font = `${f}px ${FONT}`;
			const left = W / 2 - this.#ctx.measureText(` ${key}  ${label}`).width / 2;
			this.#inverse(key, left, y, C.n, f, "left");
			this.#text(label, left + f * 1.6, y, C.hi, f, { align: "left", blur: 8 });
			y += f * 1.9;
		}
		const best = game.saves.best();
		if (best !== null) this.#text(`FURTHEST · SITE ${best.jump} · ${best.scrap} SCRAP`, W / 2, y + f * 0.8, C.mid, Math.max(11, f * 0.8), { blur: 4 });
		if (Math.floor(now / 530) % 2) this.#text("_", W / 2, y + f * 2.4, C.hot, f, { blur: 10 });
	}

	#drydock(game: Game, now: number): void {
		const camp = game.campaign;
		if (camp === null) return;
		this.#starfield(true);
		const ctx = this.#ctx, W = this.#w, H = this.#h, t = now / 1000;
		const f = Math.max(11, Math.min(15, W / 62)), lh = f * 1.6, x0 = Math.max(14, W * 0.035), right = W - x0;
		let y = Math.max(20, H * 0.06);
		this.#inverse(game.drilling ? "SIMULATED DRYDOCK · ORIENTATION" : `DRYDOCK · AFTER SITE ${camp.jump}${camp.jump <= FINAL_SITE ? `/${FINAL_SITE}` : ""}`, x0, y, C.n, f * 1.15, "left");
		this.#text(`SCRAP ${camp.scrap}   FUEL ${bar(Math.min(camp.fuel, 6) / 6, 6)} ${camp.fuel}`, right, y, C.hi, f, { align: "right", blur: 6 });
		const footer = lh * 3.4, top = y + lh * 1.3, bottom = H - footer - lh * 0.3, gap = Math.max(8, W * 0.015);
		const bw = (right - x0 - gap * 2) / 3, bh = bottom - top;
		camp.drones.forEach((d, i) => this.#bay(d, x0 + i * (bw + gap), top, bw, bh, f, t));
		y = bottom + lh * 0.9;
		const small = f * 0.9;
		this.#text(`PRICES  repair ${PRICE.repairPer25}/25% hull · rebuild ${PRICE.rebuild} · armour ${PRICE.armour} · thrust ${PRICE.thrust} · mk2 ${PRICE.mk2} · fuel ${PRICE.fuel}`, x0, y, C.mid, small, { align: "left", blur: 3 });
		const site = camp.ended ? camp.jump + 1 : Math.min(camp.jump + 1, FINAL_SITE), next = difficulty(site);
		y += lh;
		this.#text(`NEXT  SITE ${site} · ${siteName(site)} · ${regionOf(site).name} · ~${next.creatures} lifeform${next.creatures > 1 ? "s" : ""} · ${next.rad} radiation leak${next.rad === 1 ? "" : "s"}`, x0, y, C.n, small, { align: "left", blur: 5 });
		y += lh;
		this.#text(camp.fuel > 0 ? "Type HOP (F7) to burn 1 fuel and fly there." : `No fuel. BUY FUEL for ${PRICE.fuel} scrap.`, x0, y, camp.fuel > 0 ? C.hi : C.hot, small, { align: "left", blur: 6 });
		ctx.textAlign = "left";
	}

	/** One drone's bay: a blueprint of the drone with its upgrades, then its hull, fittings and what MK2 does for it. */
	#bay(d: DroneSpec, x: number, y: number, w: number, h: number, f: number, t: number): void {
		const ctx = this.#ctx, pad = Math.max(6, w * 0.05), head = f * 1.7, lost = !d.alive;
		ctx.fillStyle = C.tube;
		ctx.fillRect(x, y, w, h);
		ctx.lineWidth = 1;
		ctx.strokeStyle = alpha(C.mid, 0.55);
		ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
		ctx.fillStyle = alpha(C.mid, 0.08);
		for (let gx = x + 12; gx < x + w; gx += 12) for (let gy = y + head + 12; gy < y + h; gy += 12) ctx.fillRect(gx, gy, 1, 1);
		ctx.strokeStyle = C.n;
		ctx.lineWidth = 2;
		for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]] as const) {
			ctx.beginPath();
			ctx.moveTo(cx + sx * 10, cy);
			ctx.lineTo(cx, cy);
			ctx.lineTo(cx, cy + sy * 10);
			ctx.stroke();
		}
		ctx.fillStyle = alpha(C.n, lost ? 0.12 : 0.18);
		ctx.fillRect(x + 1, y + 1, w - 2, head);
		this.#text(`${d.id}  ${d.name}`, x + pad, y + head / 2 + 1, lost ? C.hot : C.hi, f * 1.05, { align: "left", bold: true, blur: 6 });
		this.#text(d.mod + (d.mk2 ? " MK2" : ""), x + w - pad, y + head / 2 + 1, d.mk2 ? C.hi : C.mid, f * 0.85, { align: "right", blur: 4 });
		const stats = f * 5.6, artTop = y + head + f * 0.4, artH = h - head - stats - f * 0.4;
		const size = Math.max(40, Math.min(w * 0.8, artH * 1.2));
		const cx = x + w / 2, cy = artTop + artH * 0.6;
		ctx.save();
		ctx.beginPath();
		ctx.rect(x + 1, y + head + 1, w - 2, h - head - stats);
		ctx.clip();
		drawDrone(ctx, cx, cy, size, d, t);
		ctx.restore();
		if (lost) this.#inverse("LOST", cx, cy - size * 0.05, C.hot, f * 1.1);
		const u = size / 100, dimY = cy + 40 * u;
		if (dimY < y + h - stats - 2) {
			ctx.strokeStyle = alpha(C.mid, 0.6);
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(cx - 36 * u, dimY);
			ctx.lineTo(cx + 36 * u, dimY);
			for (const ex of [-36, 36]) {
				ctx.moveTo(cx + ex * u, dimY - 3);
				ctx.lineTo(cx + ex * u, dimY + 3);
			}
			ctx.stroke();
			this.#text(d.mod === "SHIELD" ? "1.1 M" : d.mod === "MOTION" ? "0.8 M" : "0.9 M", cx, dimY + f * 0.6, C.dim, f * 0.7, { blur: 0 });
		}
		let ly = y + h - stats + f * 0.7;
		const line = (s: string, colour: string, size = f * 0.92, blur = 4): void => {
			this.#text(this.#clip(s, w - pad * 2, size), x + pad, ly, colour, size, { align: "left", blur });
			ly += f * 1.3;
		};
		if (lost) {
			line("NO SIGNAL", C.hot);
			line(`REBUILD ${d.id} · ${PRICE.rebuild} scrap`, C.hi);
			line("Comes back bare: no upgrades.", C.dim, f * 0.8, 0);
			return;
		}
		const hull = Math.max(0, Math.ceil(d.hull));
		line(`HULL ${bar(hull / 100, 8)} ${String(hull).padStart(3)}%`, hull < 40 ? C.hot : C.n);
		line(`ARM ${pips(d.armour, 2)}  THR ${pips(d.thrust, 2)}  MK2 ${d.mk2 ? "■" : "□"}`, C.n);
		const note = f * 0.8;
		for (const part of this.#wrap(d.mk2 ? `MK2: ${MK2[d.mod]}` : `MK2 for ${PRICE.mk2} scrap: ${MK2[d.mod]}`, w - pad * 2, note).slice(0, 2)) {
			this.#text(part, x + pad, ly, d.mk2 ? C.mid : C.dim, note, { align: "left", blur: 0 });
			ly += note * 1.35;
		}
	}

	/** `s` broken into lines that fit `width` at `size`. */
	#wrap(s: string, width: number, size: number): string[] {
		this.#ctx.font = `${size}px ${FONT}`;
		const lines: string[] = [];
		let current = "";
		for (const word of s.split(" ")) {
			const next = current === "" ? word : `${current} ${word}`;
			if (current !== "" && this.#ctx.measureText(next).width > width) {
				lines.push(current);
				current = word;
			} else current = next;
		}
		if (current !== "") lines.push(current);
		return lines;
	}

	/** `s`, cut with an ellipsis to fit `width` at `size`. */
	#clip(s: string, width: number, size: number): string {
		this.#ctx.font = `${size}px ${FONT}`;
		if (this.#ctx.measureText(s).width <= width) return s;
		let cut = s;
		while (cut.length > 1 && this.#ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
		return `${cut}…`;
	}

	#cinema(game: Game, now: number): void {
		if (this.#scene === null) {
			if (!this.#sceneLoading) {
				this.#sceneLoading = true;
				import("./intro-scene.ts")
					.then((scene) => (this.#scene = scene))
					.catch((error: unknown) => {
						this.#sceneLoading = false;
						console.error("Loading the intro scene failed:", error);
					});
			}
			this.#starfield(false);
			return;
		}
		const intro = game.intro;
		if (intro !== null) this.#scene.drawIntro(this.#ctx, this.#w, this.#h, intro);
		else this.#scene.drawIntro(this.#ctx, this.#w, this.#h, { scene: "moon", t: 30, at: now / 1000, cards: [] });
	}

	#over(game: Game): void {
		this.#starfield(false);
		const W = this.#w, H = this.#h, fs = Math.min(40, W / 18), o = game.over;
		this.#inverse("CONTRACT TERMINATED", W / 2, H * 0.36, C.hot, fs);
		if (o === null) return;
		const f = Math.max(12, Math.min(16, W / 50)), y = H * 0.36 + fs * 1.5;
		this.#text(o.reason, W / 2, y, C.hi, f, { blur: 8 });
		this.#text(`SITE ${o.jump} · ${o.scrap} SCRAP · ${o.rooms} ROOMS · ${o.kills} LIFEFORMS`, W / 2, y + f * 2, C.n, f);
		this.#text("TYPE CONTRACT TO SIGN A NEW ONE", W / 2, y + f * 4.5, C.mid, f * 0.9, { blur: 4 });
	}
}

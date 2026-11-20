import type { DroneSpec } from "../../game/shared/index.ts";
import { alpha, C } from "./palette.ts";

type Pt = readonly [number, number];

const hash = (i: number): number => {
	const x = Math.sin(i * 78.233 + 12.9898) * 43758.5453;
	return x - Math.floor(x);
};

/**
 * A drone's side elevation, drawn like a blueprint about (`cx`, `cy`), `size` across: its role's chassis and module, a
 * segmented shell of plating per armour plate, thruster pods and flames, damage, and how MK2 changes the module. A lost drone is a faint dashed outline.
 */
export function drawDrone(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, d: DroneSpec, t: number): void {
	const u = size / 100, lost = !d.alive;
	const P = (x: number, y: number): Pt => [cx + x * u, cy + y * u];
	const path = (points: readonly Pt[], close = true): void => {
		ctx.beginPath();
		points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
		if (close) ctx.closePath();
	};
	const ink = lost ? alpha(C.dim, 0.9) : d.hull < 40 ? C.hot : C.hi;
	const shape = (points: readonly Pt[], glow = 8): void => {
		path(points);
		ctx.fillStyle = C.tube;
		ctx.fill();
		ctx.strokeStyle = ink;
		ctx.shadowColor = ink;
		ctx.shadowBlur = lost ? 0 : glow;
		ctx.stroke();
		ctx.shadowBlur = 0;
	};
	ctx.save();
	ctx.lineWidth = Math.max(1, 1.3 * u);
	ctx.lineJoin = "round";
	if (lost) ctx.setLineDash([4 * u, 3 * u]);

	const hover = lost ? 0 : Math.sin(t * 2.1 + d.id) * 1.2;
	ctx.translate(0, hover * u);
	if (!lost) {
		ctx.fillStyle = alpha(C.mid, 0.18);
		ctx.beginPath();
		ctx.ellipse(cx, cy + (34 - hover) * u, 30 * u, 3.2 * u, 0, 0, Math.PI * 2);
		ctx.fill();
	}

	const hull: readonly Pt[] =
		d.mod === "MOTION"
			? [P(-30, 10), P(28, 10), P(33, 1), P(27, -9), P(-18, -12), P(-31, -2)]
			: d.mod === "SHIELD"
				? [P(-36, 10), P(29, 10), P(33, -4), P(22, -17), P(-30, -17), P(-37, -4)]
				: [P(-27, 10), P(27, 10), P(23, -3), P(13, -14), P(-13, -14), P(-23, -3)];
	const outline = (): void => path(hull);
	const shells = d.armour + (d.mod === "SHIELD" && d.mk2 ? 1 : 0);
	for (let i = shells; i >= 1; i--) {
		const reach = (2.2 + i * 2.6) * u;
		outline();
		ctx.lineWidth = reach * 2;
		ctx.strokeStyle = ink;
		if (!lost) ctx.setLineDash([11 * u, 1.6 * u]);
		ctx.shadowColor = ink;
		ctx.shadowBlur = lost ? 0 : 5;
		ctx.stroke();
		ctx.shadowBlur = 0;
		ctx.setLineDash(lost ? [4 * u, 3 * u] : []);
		outline();
		ctx.lineWidth = reach * 2 - 2.4 * u;
		ctx.strokeStyle = C.tube;
		ctx.stroke();
	}
	ctx.lineWidth = Math.max(1, 1.3 * u);
	const pods = d.thrust >= 2 ? [-26, -9, 9, 26] : d.thrust === 1 ? [-24, 0, 24] : [-20, 20];
	for (const px of pods) {
		if (!lost) {
			const flicker = 0.75 + hash(Math.floor(t * 24) + px) * 0.5, reach = (7 + 5 * d.thrust) * flicker;
			const [fx, fy] = P(px, 16);
			const flame = ctx.createLinearGradient(0, fy, 0, fy + reach * u);
			flame.addColorStop(0, C.hi);
			flame.addColorStop(0.4, C.hot);
			flame.addColorStop(1, alpha(C.hot, 0));
			ctx.fillStyle = flame;
			ctx.beginPath();
			ctx.moveTo(fx - (2.2 + d.thrust * 0.5) * u, fy);
			ctx.lineTo(fx + (2.2 + d.thrust * 0.5) * u, fy);
			ctx.lineTo(fx, fy + reach * u);
			ctx.closePath();
			ctx.fill();
		}
		shape([P(px - 4, 9), P(px + 4, 9), P(px + 3, 16), P(px - 3, 16)], 4);
	}

	if (d.mod === "MOTION") {
		shape(hull, 10);
		const dish = d.mk2 ? 15 : 11, sweep = lost ? 0 : Math.sin(t * 1.4) * 0.55;
		shape([P(-1.5, -12), P(1.5, -12), P(1, -25), P(-1, -25)], 4);
		const [hx, hy] = P(0, -28);
		ctx.strokeStyle = ink;
		ctx.shadowColor = ink;
		ctx.shadowBlur = lost ? 0 : 10;
		ctx.beginPath();
		ctx.arc(hx, hy, dish * u, Math.PI * 1.12 + sweep, Math.PI * 1.88 + sweep);
		ctx.stroke();
		if (d.mk2) {
			ctx.beginPath();
			ctx.arc(hx, hy, dish * 0.62 * u, Math.PI * 1.2 + sweep, Math.PI * 1.8 + sweep);
			ctx.stroke();
		}
		ctx.beginPath();
		ctx.moveTo(hx, hy);
		ctx.lineTo(hx + Math.cos(Math.PI * 1.5 + sweep) * dish * 0.9 * u, hy + Math.sin(Math.PI * 1.5 + sweep) * dish * 0.9 * u);
		ctx.stroke();
		ctx.shadowBlur = 0;
		if (!lost) {
			ctx.fillStyle = C.hot;
			ctx.fillRect(...P(23, -3.5), 3.5 * u, 3.5 * u);
		}
	} else if (d.mod === "SHIELD") {
		shape(hull, 10);
		if (!lost) {
			ctx.save();
			path([P(-6, -13), P(18, -13), P(18, 5), P(-6, 5)]);
			ctx.clip();
			ctx.strokeStyle = alpha(C.hot, 0.65);
			ctx.lineWidth = 2.2 * u;
			for (let i = -3; i < 6; i++) {
				ctx.beginPath();
				ctx.moveTo(...P(-6 + i * 6, 5));
				ctx.lineTo(...P(12 + i * 6, -13));
				ctx.stroke();
			}
			ctx.restore();
			ctx.lineWidth = Math.max(1, 1.3 * u);
		}
		const [sx, sy] = P(18, -3);
		for (let layer = 0; layer < (d.mk2 ? 2 : 1); layer++) {
			ctx.strokeStyle = ink;
			ctx.shadowColor = ink;
			ctx.shadowBlur = lost ? 0 : 12;
			ctx.lineWidth = (3.2 - layer * 1.4) * u;
			ctx.beginPath();
			ctx.arc(sx, sy, (24 + layer * 5) * u, -0.95, 0.95);
			ctx.stroke();
		}
		ctx.shadowBlur = 0;
		ctx.lineWidth = Math.max(1, 1.3 * u);
		if (d.mk2) {
			const reach = lost ? 0 : Math.sin(t * 2.6) * 2;
			shape([P(-14, -17), P(-10, -17), P(-20, -29), P(-24, -27)], 4);
			shape([P(-24, -27), P(-20, -29), P(-31 + reach, -24), P(-33 + reach, -21)], 4);
			ctx.strokeStyle = ink;
			ctx.beginPath();
			ctx.moveTo(...P(-33 + reach, -21));
			ctx.lineTo(...P(-38 + reach, -17));
			ctx.moveTo(...P(-31 + reach, -24));
			ctx.lineTo(...P(-38 + reach, -25));
			ctx.stroke();
		}
	} else {
		shape(hull, 10);
		if (!lost) {
			ctx.save();
			path(hull);
			ctx.clip();
			ctx.fillStyle = alpha(C.hot, 0.18);
			ctx.fillRect(...P(-30, -4), 60 * u, 6 * u);
			ctx.strokeStyle = alpha(C.hot, 0.7);
			ctx.lineWidth = 2 * u;
			for (let i = -6; i < 7; i++) {
				ctx.beginPath();
				ctx.moveTo(...P(i * 5, 2));
				ctx.lineTo(...P(i * 5 + 6, -4));
				ctx.stroke();
			}
			ctx.restore();
			ctx.lineWidth = Math.max(1, 1.3 * u);
		}
		ctx.strokeStyle = ink;
		ctx.beginPath();
		ctx.moveTo(...P(-30, -4));
		ctx.lineTo(...P(30, -4));
		ctx.moveTo(...P(-30, 2));
		ctx.lineTo(...P(30, 2));
		ctx.save();
		path(hull);
		ctx.clip();
		ctx.stroke();
		ctx.restore();
		const top = d.mk2 ? -42 : -35, tiers = d.mk2 ? [-21, -28, -35] : [-21, -28];
		ctx.strokeStyle = ink;
		ctx.shadowColor = ink;
		ctx.shadowBlur = lost ? 0 : 6;
		ctx.beginPath();
		ctx.moveTo(...P(-7, -14));
		ctx.lineTo(...P(-3, top + 3));
		ctx.moveTo(...P(7, -14));
		ctx.lineTo(...P(3, top + 3));
		for (const ty of tiers) {
			const half = 7 - ((ty + 14) / (top + 17)) * 4;
			ctx.moveTo(...P(-half, ty));
			ctx.lineTo(...P(half, ty));
		}
		let flip = -1;
		for (let ty = -14; ty > top + 4; ty -= 5) {
			const at = (y: number) => 7 - ((y + 14) / (top + 17)) * 4;
			ctx.moveTo(...P(flip * at(ty), ty));
			ctx.lineTo(...P(-flip * at(ty - 5), ty - 5));
			flip = -flip;
		}
		ctx.stroke();
		ctx.shadowBlur = 0;
		const lamps = d.mk2 ? [top, top + 9] : [top];
		const on = lost ? false : Math.floor(t * 2.4) % 2 === 0;
		for (const ly of lamps) shape([P(-4, ly + 3), P(4, ly + 3), P(3, ly - 2), P(-3, ly - 2)], 6);
		if (on) {
			ctx.fillStyle = C.hot;
			ctx.shadowColor = C.hot;
			ctx.shadowBlur = 14;
			ctx.fillRect(...P(-2.4, top - 1.2), 4.8 * u, 3.4 * u);
			ctx.shadowBlur = 0;
		}
		if (!lost) {
			for (let i = 0; i < 3; i++) {
				const k = (t * (d.mk2 ? 1 : 0.8) + i / 3) % 1, r = (5 + k * (d.mk2 ? 20 : 15)) * u;
				ctx.strokeStyle = alpha(C.hot, 0.8 * (1 - k));
				ctx.beginPath();
				ctx.arc(cx, cy + top * u, r, Math.PI * 1.1, Math.PI * 1.9);
				ctx.stroke();
			}
		}
	}

	if (!lost && d.hull < 60) {
		ctx.strokeStyle = alpha(C.hot, 0.85);
		ctx.lineWidth = Math.max(1, 1 * u);
		path([P(-4, -9), P(-1, -4), P(-5, 0), P(-2, 6)], false);
		ctx.stroke();
		if (d.hull < 35) {
			path([P(12, -10), P(9, -5), P(13, -1)], false);
			ctx.stroke();
			ctx.fillStyle = C.hot;
			for (let i = 0; i < 4; i++) if (hash(Math.floor(t * 12) + i * 7) > 0.55) ctx.fillRect(...P(-6 + hash(i + Math.floor(t * 9)) * 22, -12 + hash(i * 3 + Math.floor(t * 7)) * 18), 1.4 * u, 1.4 * u);
		}
	}
	ctx.restore();
}

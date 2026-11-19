import { below, type Rng, seeded, shuffle } from "./rng.ts";
import type { Box, Creature, Difficulty, Door, Link, Point, Room, Ship, Waypoint } from "./types.ts";

interface Leaf {
	x: number;
	y: number;
	w: number;
	h: number;
	keep?: boolean;
}

interface Edge {
	a: number;
	b: number;
	x: number;
	y: number;
	o: "v" | "h";
}

function edgesOf(leaves: Leaf[]): Edge[] {
	const edges: Edge[] = [];
	for (let i = 0; i < leaves.length; i++) {
		for (let j = i + 1; j < leaves.length; j++) {
			const A = leaves[i]!, B = leaves[j]!;
			if (A.x + A.w === B.x || B.x + B.w === A.x) {
				const x = A.x + A.w === B.x ? B.x : A.x, y0 = Math.max(A.y, B.y), y1 = Math.min(A.y + A.h, B.y + B.h);
				if (y1 - y0 >= 3) edges.push({ a: i, b: j, x, y: (y0 + y1) / 2, o: "v" });
			} else if (A.y + A.h === B.y || B.y + B.h === A.y) {
				const y = A.y + A.h === B.y ? B.y : A.y, x0 = Math.max(A.x, B.x), x1 = Math.min(A.x + A.w, B.x + B.w);
				if (x1 - x0 >= 3) edges.push({ a: i, b: j, x: (x0 + x1) / 2, y, o: "h" });
			}
		}
	}
	return edges;
}

function connected(leaves: Leaf[]): boolean {
	const edges = edgesOf(leaves), seen = new Set([0]), queue = [0];
	while (queue.length > 0) {
		const n = queue.shift()!;
		for (const e of edges) {
			const other = e.a === n ? e.b : e.b === n ? e.a : -1;
			if (other >= 0 && !seen.has(other)) {
				seen.add(other);
				queue.push(other);
			}
		}
	}
	return seen.size === leaves.length;
}

function partition(rng: Rng, W: number, H: number): Leaf[] {
	const leaves: Leaf[] = [];
	const split = (n: Leaf): void => {
		const canV = n.w >= 8, canH = n.h >= 8, area = n.w * n.h;
		if ((!canV && !canH) || area <= 24 || (area <= 48 && rng() < 0.7)) {
			leaves.push(n);
			return;
		}
		const vertical = canV && (!canH || (n.w / n.h > 1.3 ? true : n.h / n.w > 1.3 ? false : rng() < 0.5));
		if (vertical) {
			const s = 4 + below(rng, n.w - 7);
			split({ x: n.x, y: n.y, w: s, h: n.h });
			split({ x: n.x + s, y: n.y, w: n.w - s, h: n.h });
		} else {
			const s = 4 + below(rng, n.h - 7);
			split({ x: n.x, y: n.y, w: n.w, h: s });
			split({ x: n.x, y: n.y + s, w: n.w, h: n.h - s });
		}
	};
	split({ x: 0, y: 0, w: W, h: H });
	return leaves;
}

/** A random point well inside `room`, clear of its walls. */
export const spotIn = (rng: Rng, room: Box): Point => ({ x: room.x + 1.1 + rng() * (room.w - 2.2), y: room.y + 1.1 + rng() * (room.h - 2.2) });

export const newCreature = (rng: Rng, at: Point, node: number): Creature => ({ ...at, node, path: [], alive: true, think: 2 + rng() * 4, hunt: 0, vis: false, ph: rng() * 6, dir: 0 });

/**
 * The derelict for `seed`: rooms cut from one hull, joined by a spanning tree of doors plus a few extra loops, with the
 * airlock on the left hull. A tutorial ship comes back empty, for the tutorial to stock.
 */
export function generate(seed: number, o: Difficulty, tutorial = false, live: Rng = Math.random): Ship {
	const rng = seeded(seed);
	let leaves = partition(rng, o.W, o.H);
	const startLeaf = leaves.filter((l) => l.x === 0 && l.h >= 4).sort((a, b) => Math.abs(a.y + a.h / 2 - o.H / 2) - Math.abs(b.y + b.h / 2 - o.H / 2))[0]!;
	startLeaf.keep = true;
	let toRemove = Math.floor(leaves.length * o.remove), tries = 60;
	while (toRemove > 0 && tries-- > 0) {
		const i = below(rng, leaves.length);
		if (leaves[i]!.keep) continue;
		const next = leaves.filter((_, k) => k !== i);
		if (connected(next)) {
			leaves = next;
			toRemove--;
		}
	}

	const edges = shuffle(rng, edgesOf(leaves));
	const parent = leaves.map((_, i) => i);
	const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
	const chosen: Edge[] = [];
	for (const e of edges) {
		const ra = find(e.a), rb = find(e.b);
		if (ra !== rb) {
			parent[ra] = rb;
			chosen.push(e);
		} else if (rng() < 0.28) chosen.push(e);
	}

	const rooms: Room[] = leaves.map((L) => ({ x: L.x, y: L.y, w: L.w, h: L.h, cx: L.x + L.w / 2, cy: L.y + L.h / 2, num: 0, seen: false, items: [], rad: false, purge: false, purgeUsed: false, radWarn: false }));
	const roomNums = shuffle(rng, rooms.map((_, i) => i + 1));
	rooms.forEach((r, i) => (r.num = roomNums[i]!));
	const doorNums = shuffle(rng, chosen.map((_, i) => i + 1));
	const doors: Door[] = chosen.map((e, i) => ({ ...e, num: doorNums[i]!, name: `d${doorNums[i]}`, open: rng() < o.openP, air: false, bump: 0 }));

	const dock = rooms.length, start = leaves.indexOf(startLeaf), ay = startLeaf.y + startLeaf.h / 2;
	doors.push({ a: start, b: dock, x: 0, y: ay, o: "v", num: 1, name: "a1", open: true, air: true, bump: 0 });
	const dockBox: Box = { x: -4.6, y: ay - 1.7, w: 3.6, h: 3.4, cx: -2.8, cy: ay };
	const adj: Link[][] = Array.from({ length: rooms.length + 1 }, () => []);
	doors.forEach((d, i) => {
		adj[d.a]!.push({ door: i, to: d.b });
		adj[d.b]!.push({ door: i, to: d.a });
	});

	const depth = rooms.map(() => Infinity);
	depth[start] = 0;
	const queue = [start];
	while (queue.length > 0) {
		const n = queue.shift()!;
		for (const link of adj[n]!) {
			if (link.to < dock && depth[link.to] === Infinity) {
				depth[link.to] = depth[n]! + 1;
				queue.push(link.to);
			}
		}
	}
	const ship: Ship = { seed, rooms, doors, adj, dockBox, dock, start, depth, creatures: [] };
	if (!tutorial) stock(ship, o, rng, live);
	return ship;
}

function stock(ship: Ship, o: Difficulty, rng: Rng, live: Rng): void {
	const { rooms, depth } = ship;
	const pool = (min: number, except: number[] = []) => shuffle(rng, rooms.map((_, i) => i).filter((i) => depth[i]! >= min && !except.includes(i)));
	const rad = pool(2).slice(0, o.rad);
	for (const i of rad) rooms[i]!.rad = true;
	for (const i of pool(1, rad).slice(0, o.purge)) rooms[i]!.purge = true;
	const far = rooms.map((_, i) => i).sort((a, b) => depth[b]! - depth[a]!)[0]!;
	rooms[far]!.items.push({ ...spotIn(rng, rooms[far]!), v: 3, kind: "core" });
	let left = o.scrap;
	const scrapRooms = pool(1, [far]);
	for (let k = 0; left > 0 && scrapRooms.length > 0 && k < scrapRooms.length * 3; k++) {
		const r = rooms[scrapRooms[k % scrapRooms.length]!]!;
		const v = Math.min(left, 1 + below(rng, 2));
		r.items.push({ ...spotIn(rng, r), v, kind: "scrap" });
		left -= v;
	}
	let fuelRooms = pool(2);
	if (fuelRooms.length === 0) fuelRooms = pool(1);
	for (const i of fuelRooms.slice(0, o.fuel)) rooms[i]!.items.push({ ...spotIn(rng, rooms[i]!), v: 1, kind: "fuel" });
	let lairs = pool(3);
	if (lairs.length < o.creatures) lairs = pool(2);
	if (lairs.length === 0) lairs = pool(1);
	for (let k = 0; k < o.creatures && lairs.length > 0; k++) {
		const i = lairs[k % lairs.length]!;
		ship.creatures.push(newCreature(live, spotIn(rng, rooms[i]!), i));
	}
	const guard = ship.creatures[ship.creatures.length - 1];
	if (guard !== undefined && !ship.creatures.some((c) => c.node === far) && depth[far]! >= 3) Object.assign(guard, { ...spotIn(rng, rooms[far]!), node: far });
}

/** Where drone `id` waits in `node`, so drones sharing a room don't overlap. */
export function slot(ship: Ship, id: number, node: number): Point {
	const r = node === ship.dock ? ship.dockBox : ship.rooms[node]!;
	const [ox, oy] = ([[-0.75, -0.55], [0.75, -0.55], [0, 0.65]] as const)[(id - 1) % 3]!;
	const mx = Math.max(0, (r.w - 1) / 2 - 0.6), my = Math.max(0, (r.h - 1) / 2 - 0.6);
	return { x: r.cx + Math.max(-mx, Math.min(mx, ox)), y: r.cy + Math.max(-my, Math.min(my, oy)) };
}

export const nodeName = (ship: Ship, n: number): string => (n === ship.dock ? "dock" : `r${ship.rooms[n]!.num}`);
export const roomByNum = (ship: Ship, num: number): number => ship.rooms.findIndex((r) => r.num === num);
export const doorByName = (ship: Ship, name: string): number => ship.doors.findIndex((d) => d.name === name);

/** The doors to pass from `from` to `to`, shortest first; only open ones unless `open` is false. Null when there's no way. */
export function findPath(ship: Ship, from: number, to: number, { open = true, noDock = false } = {}): Link[] | null {
	if (from === to) return [];
	const prev = new Map<number, { n: number; door: number } | null>([[from, null]]);
	const queue = [from];
	while (queue.length > 0 && !prev.has(to)) {
		const n = queue.shift()!;
		for (const link of ship.adj[n]!) {
			if (open && !ship.doors[link.door]!.open) continue;
			if (noDock && link.to === ship.dock) continue;
			if (prev.has(link.to)) continue;
			prev.set(link.to, { n, door: link.door });
			queue.push(link.to);
		}
	}
	if (!prev.has(to)) return null;
	const route: Link[] = [];
	for (let cur = to; cur !== from; ) {
		const p = prev.get(cur)!;
		route.unshift({ door: p.door, to: cur });
		cur = p.n;
	}
	return route;
}

export const toWaypoints = (ship: Ship, route: Link[]): Waypoint[] => route.map((s) => ({ x: ship.doors[s.door]!.x, y: ship.doors[s.door]!.y, door: s.door, to: s.to }));

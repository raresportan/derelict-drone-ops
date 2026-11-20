import type { Rng } from "./rng.ts";
import { damageTaken, speedOf } from "./rules.ts";
import type { Creature, Drone, Mission, Point, Sink, Waypoint } from "./types.ts";
import { findPath, nodeName, slot, spotIn, toWaypoints } from "./world.ts";

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export function killDrone(m: Mission, d: Drone, why: string, sink: Sink): void {
	if (!d.alive) return;
	Object.assign(d, { alive: false, hull: 0, path: [], state: "LOST", cargo: 0, fuel: 0, wreck: true });
	m.fx.push({ type: "boom", x: d.x, y: d.y, t: 0, max: 1.2 });
	sink.log(` DRONE ${d.id} (${d.name}) LOST — ${why.toUpperCase()} `, "alarm");
	sink.sound("boom");
}

function enterNode(m: Mission, d: Drone, sink: Sink): void {
	if (d.node === m.dock) return;
	const r = m.rooms[d.node]!;
	if (!r.seen) {
		r.seen = true;
		const value = r.items.filter((i) => i.kind !== "fuel").reduce((s, i) => s + i.v, 0);
		const cells = r.items.filter((i) => i.kind === "fuel").length;
		let msg = `Drone ${d.id} surveyed r${r.num}.`;
		if (value) msg += ` Salvage: ${value} unit${value > 1 ? "s" : ""}${r.items.some((i) => i.kind === "core") ? " (data core)" : ""}.`;
		if (cells) msg += ` Fuel cell${cells > 1 ? "s" : ""}: ${cells}.`;
		if (r.purge) msg += " Purge valve present.";
		if (r.terminal !== null) msg += " A terminal is still powered.";
		sink.log(msg, value || cells ? "loot" : "ok");
	}
	if (r.rad && !r.radWarn) {
		r.radWarn = true;
		sink.log(`RADIATION in r${r.num}! Hull degrading.`, "warn");
		sink.sound("alarm");
	}
}

type Step = "moving" | "blocked" | "arrived" | "idle";

function moveAlong(m: Mission, walker: Drone | Creature, dt: number, speed: number, onEnter?: () => void): Step {
	const wp = walker.path[0];
	if (wp === undefined) return "idle";
	if (wp.door !== undefined && !m.doors[wp.door]!.open) {
		walker.path = [];
		return "blocked";
	}
	const dx = wp.x - walker.x, dy = wp.y - walker.y, L = Math.hypot(dx, dy), step = speed * dt;
	if (L > 1e-4) walker.dir = Math.atan2(dy, dx);
	if (L <= step) {
		walker.x = wp.x;
		walker.y = wp.y;
		walker.path.shift();
		if (wp.door !== undefined && wp.to !== undefined) {
			walker.node = wp.to;
			onEnter?.();
		}
		return walker.path.length > 0 ? "moving" : "arrived";
	}
	walker.x += (dx / L) * step;
	walker.y += (dy / L) * step;
	return "moving";
}

function updateDrone(m: Mission, d: Drone, dt: number, sink: Sink): void {
	if (!d.alive) return;
	d.hit = Math.max(0, d.hit - dt);
	if (d.path.length > 0) {
		const step = moveAlong(m, d, dt, speedOf(d), () => enterNode(m, d, sink));
		if (step === "blocked") {
			d.state = "BLOCKED";
			sink.log(`Drone ${d.id}: route blocked by a closed door.`, "warn");
			sink.sound("err");
		} else if (step === "arrived") {
			d.state = d.node === m.dock ? "DOCKED" : "IDLE";
			sink.log(`Drone ${d.id} arrived ${nodeName(m, d.node)}.`, "drone");
		}
	}
	if (d.state === "READING") {
		d.gather -= dt;
		if (d.gather <= 0) {
			d.state = "IDLE";
			m.reads.push({ drone: d.id, room: d.node });
		}
	}
	if (d.state === "GATHERING") {
		d.gather -= dt;
		if (d.gather <= 0) {
			const r = m.rooms[d.node]!;
			const value = r.items.filter((i) => i.kind !== "fuel").reduce((s, i) => s + i.v, 0), cells = r.items.filter((i) => i.kind === "fuel").length;
			r.items = [];
			d.cargo += value;
			d.fuel += cells;
			d.state = "IDLE";
			sink.log(`Drone ${d.id} recovered ${value} scrap${cells ? ` and ${cells} fuel cell${cells > 1 ? "s" : ""}` : ""}. Carrying ${d.cargo}${d.fuel ? ` + ${d.fuel} fuel` : ""}.`, "loot");
			sink.sound("ok");
		}
	}
	const inRad = d.node !== m.dock && m.rooms[d.node]!.rad;
	if (inRad) {
		d.hull -= 6 * dt * damageTaken(d);
		d.hit = Math.max(d.hit, 0.15);
	}
	if (d.node === m.dock && (d.cargo > 0 || d.fuel > 0) && d.path.length === 0) {
		m.bank.scrap += d.cargo;
		m.bank.fuel += d.fuel;
		sink.log(`Dock: ${d.name} unloaded ${d.cargo} scrap${d.fuel ? ` and ${d.fuel} fuel` : ""}. This boarding: ${m.bank.scrap} scrap, ${m.bank.fuel} fuel.`, "loot");
		d.cargo = 0;
		d.fuel = 0;
		sink.sound("ping");
	}
	if (d.hull <= 0) killDrone(m, d, inRad ? "radiation burn" : "hull breach", sink);
}

function walkTo(m: Mission, c: Creature, node: number, rng: Rng): void {
	const route = findPath(m, c.node, node, { noDock: true });
	if (route === null || route.length === 0) return;
	c.path = toWaypoints(m, route);
	c.path.push(spotIn(rng, m.rooms[node]!));
}

function updateCreature(m: Mission, c: Creature, dt: number, sink: Sink, rng: Rng): void {
	if (!c.alive) return;
	c.ph += dt;
	c.think -= dt;
	const prey = m.drones.filter((d) => d.alive && d.node === c.node && c.node !== m.dock).sort((a, b) => dist(a, c) - dist(b, c))[0];
	if (prey !== undefined) {
		c.hunt = 7;
		c.path = [];
		const L = dist(prey, c);
		if (L > 0.45) {
			c.dir = Math.atan2(prey.y - c.y, prey.x - c.x);
			const step = Math.min(L - 0.4, m.o.chase * dt);
			c.x += Math.cos(c.dir) * step;
			c.y += Math.sin(c.dir) * step;
		}
		if (L < 0.6) {
			prey.hull -= m.o.dmg * dt * damageTaken(prey);
			prey.hit = 0.25;
			if (rng() < dt * 3) sink.sound("err");
			if (prey.hull <= 0) killDrone(m, prey, "torn apart by a lifeform", sink);
		}
		return;
	}
	if (c.path.length > 0 && moveAlong(m, c, dt, c.hunt > 0 ? m.o.chase * 1.05 : m.o.wander) === "blocked") {
		for (const d of m.doors) if (Math.hypot(d.x - c.x, d.y - c.y) < 1.6) d.bump = Math.max(d.bump, 0.6);
		c.think = Math.min(c.think, 1);
	}
	if (c.hunt > 0) c.hunt -= dt;
	if (c.think > 0) return;
	c.think = c.hunt > 0 ? 0.35 : 2.4 + rng() * 3.2;
	const open = m.adj[c.node]!.filter((link) => m.doors[link.door]!.open && link.to !== m.dock);
	const preyRoom = open.find((link) => m.drones.some((d) => d.alive && d.node === link.to));
	if (preyRoom !== undefined && (c.hunt > 0 || rng() < 0.5)) {
		walkTo(m, c, preyRoom.to, rng);
		return;
	}
	const lure = m.lure;
	if (lure !== null && lure.t > 0 && lure.node !== m.dock) {
		const route = findPath(m, c.node, lure.node, { noDock: true });
		if (route !== null && route.length <= lure.reach) {
			c.hunt = Math.max(c.hunt, 2);
			const near: Waypoint = { x: lure.x + (rng() - 0.5), y: lure.y + (rng() - 0.5) };
			c.path = route.length > 0 ? [...toWaypoints(m, route), near] : [{ x: lure.x, y: lure.y }];
			return;
		}
	}
	if (c.path.length > 0) return;
	if (open.length > 0 && rng() < 0.4) walkTo(m, c, open[Math.floor(rng() * open.length)]!.to, rng);
	else if (rng() < 0.5) c.path = [spotIn(rng, m.rooms[c.node]!)];
}

/** Advances the boarding by `dt` seconds. Returns whether a lifeform is in sight. */
/** How long a room stays suspected after a lifeform was last sensed there, unless a drone looks in first. */
export const SUSPECT_SECONDS = 25;

/** What the map knows about lifeforms in room `i`: one in sight now, or how fresh a suspicion is (1 just sensed, 0 none). */
export function roomThreat(m: Mission, i: number): { seen: boolean; suspected: number } {
	return { seen: m.creatures.some((c) => c.alive && c.vis && c.node === i), suspected: (m.suspect.get(i) ?? 0) / SUSPECT_SECONDS };
}

/**
 * The rooms a sounding decoy can be heard in, each with how many doors away it is: the same open-door routes, within the
 * same reach, that a lifeform would follow to it. Empty when no decoy is sounding.
 */
export function lureReach(m: Mission): Map<number, number> {
	const lure = m.lure, heard = new Map<number, number>();
	if (lure === null || lure.t <= 0 || lure.node === m.dock) return heard;
	heard.set(lure.node, 0);
	const queue = [lure.node];
	while (queue.length > 0) {
		const room = queue.shift()!, steps = heard.get(room)!;
		if (steps >= lure.reach) continue;
		for (const link of m.adj[room]!) {
			if (!m.doors[link.door]!.open || link.to === m.dock || heard.has(link.to)) continue;
			heard.set(link.to, steps + 1);
			queue.push(link.to);
		}
	}
	return heard;
}

export function tickMission(m: Mission, dt: number, sink: Sink, rng: Rng): boolean {
	if (m.end === null) m.t += dt;
	for (const f of m.fx) f.t += dt;
	m.fx = m.fx.filter((f) => f.t < f.max);
	for (const d of m.doors) d.bump = Math.max(0, d.bump - dt * 1.5);
	if (m.end !== null) return false;
	m.motionCd = Math.max(0, m.motionCd - dt);
	if (m.lure !== null) {
		m.lure.t -= dt;
		if (rng() < dt * 2.2) m.fx.push({ type: "ring", x: m.lure.x, y: m.lure.y, t: 0, max: 1.3 });
		if (m.lure.t <= 0) m.lure = null;
	}
	for (const d of m.drones) updateDrone(m, d, dt, sink);
	for (const c of m.creatures) updateCreature(m, c, dt, sink, rng);
	const watched = new Set(m.drones.filter((d) => d.alive).map((d) => d.node));
	let threat = false;
	for (const c of m.creatures) {
		const seen = c.alive && watched.has(c.node) && c.node !== m.dock;
		if (seen && !c.vis) {
			sink.log(` !! LIFEFORM DETECTED IN ${nodeName(m, c.node).toUpperCase()} `, "alarm");
			sink.sound("alarm");
		}
		if (!seen && c.vis && c.alive) m.suspect.set(c.node, SUSPECT_SECONDS);
		c.vis = seen;
		threat ||= seen;
	}
	for (const [room, left] of m.suspect) {
		const clear = watched.has(room) && !m.creatures.some((c) => c.alive && c.vis && c.node === room);
		if (left <= dt || clear) m.suspect.delete(room);
		else m.suspect.set(room, left - dt);
	}
	return threat;
}

/** Puts every drone back in the dock for a new boarding. */
export function dockDrones(m: Mission): void {
	for (const d of m.drones) Object.assign(d, slot(m, d.id, m.dock), { node: m.dock, path: [], state: d.alive ? "DOCKED" : "LOST", cargo: 0, fuel: 0, gather: 0, gatherFor: 0, dir: 0, hit: 0, dest: null, wreck: false });
}

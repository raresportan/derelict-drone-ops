import type { Rng } from "./rng.ts";
import { killDrone, SUSPECT_SECONDS } from "./sim.ts";
import type { Drone, DroneSpec, LogKind, Mission, Sink } from "./types.ts";
import { doorByName, findPath, nodeName, roomByNum, slot, toWaypoints } from "./world.ts";

export const MISSION_HELP: readonly [string, LogKind][] = [
	['MISSION COMMANDS — drones 1 2 3 (or "all"), rooms rN, doors dN, airlock a1', "head"],
	["  nav <drones> <room>     move along open doors          nav 1 2 r5  ·  nav all dock", "note"],
	["  open / close <doors>    work doors (a door cannot close on something in its frame)", "note"],
	["  gather <drones>         collect salvage and fuel cells in the drone's room", "note"],
	["  read <drone>            read a powered terminal in the drone's room (3 s); logs go to the archive", "note"],
	["  motion                  WREN (1) scans for lifeforms through walls", "note"],
	["  lure 3                  BUOY (3) sounds a decoy; lifeforms come to it", "note"],
	["  purge <room>            fire a surveyed purge valve — kills everything inside, once", "note"],
	["  stop <drones>   status   undock   labels   sound   clear   menu", "note"],
	["Cargo only counts once a drone brings it into the dock. Drones left aboard at UNDOCK are lost.", "loot"],
];

export const ALIAS: Record<string, string> = {
	n: "nav", navigate: "nav", go: "nav", move: "nav", o: "open", c: "close", g: "gather", m: "motion", scan: "motion", l: "lure", p: "purge", vent: "purge",
	s: "stop", st: "status", "?": "help", h: "help", cls: "clear", label: "labels", icons: "labels", leave: "undock", fix: "repair", build: "rebuild", up: "upgrade",
	quit: "menu", title: "menu", armor: "armour", rd: "read", hop: "jump", launch: "jump",
};

/** The drone ids named in `words` (numbers, names, or "all"), and the words left over. */
export function parseDrones(words: string[], drones: readonly DroneSpec[]): { ids: number[]; rest: string[] } {
	const ids = new Set<number>(), rest: string[] = [];
	for (const w of words) {
		if (w === "all" || w === "a") for (const d of drones) ids.add(d.id);
		else if (/^[123]$/.test(w)) ids.add(Number(w));
		else if (/^[123]{2,3}$/.test(w)) for (const ch of w) ids.add(Number(ch));
		else {
			const named = drones.find((d) => d.name.toLowerCase() === w);
			if (named !== undefined) ids.add(named.id);
			else rest.push(w);
		}
	}
	return { ids: [...ids].sort(), rest };
}

/** What a mission command needs from the game around it. */
export interface MissionHost {
	readonly m: Mission;
	readonly sink: Sink;
	readonly rng: Rng;
	finish(): void;
	leave(): void;
	toggleLabels(): boolean;
}

function live(h: MissionHost, id: number): Drone | null {
	const d = h.m.drones[id - 1];
	if (d === undefined) {
		h.sink.log(`No drone ${id}.`, "warn");
		return null;
	}
	if (!d.alive) {
		h.sink.log(`Drone ${id} (${d.name}): no signal.`, "warn");
		return null;
	}
	return d;
}

function nav(h: MissionHost, args: string[]): void {
	const { m, sink } = h;
	const { ids, rest } = parseDrones(args, m.drones);
	const target = rest[0];
	if (ids.length === 0 || target === undefined) {
		sink.log("Usage: nav <drones> <room>   e.g.  nav 1 2 r5", "warn");
		sink.sound("err");
		return;
	}
	let node: number;
	if (["dock", "a1", "airlock", "home"].includes(target)) node = m.dock;
	else if (/^r\d+$/.test(target)) {
		node = roomByNum(m, Number(target.slice(1)));
		if (node < 0) {
			sink.log(`No room ${target} on this deck.`, "warn");
			sink.sound("err");
			return;
		}
	} else {
		sink.log(`Unknown destination "${target}". Use rN or dock.`, "warn");
		sink.sound("err");
		return;
	}
	for (const id of ids) {
		const d = live(h, id);
		if (d === null) continue;
		if (d.node === node && d.path.length === 0) {
			sink.log(`Drone ${id} is already in ${nodeName(m, node)}.`, "note");
			continue;
		}
		const route = findPath(m, d.node, node);
		if (route === null) {
			const shortest = findPath(m, d.node, node, { open: false });
			const closed = shortest === null ? [] : shortest.map((s) => m.doors[s.door]!).filter((x) => !x.open).map((x) => x.name);
			sink.log(`Drone ${id}: no open route to ${nodeName(m, node)}${closed.length ? ` — closed on shortest route: ${closed.join(" ")}` : ""}.`, "warn");
			sink.sound("err");
			continue;
		}
		d.path = [...toWaypoints(m, route), slot(m, d.id, node)];
		d.state = "MOVING";
		d.dest = node;
		d.gather = 0;
		sink.log(`Drone ${id} (${d.name}) → ${nodeName(m, node)}  [${route.length} door${route.length === 1 ? "" : "s"}]`, "drone");
	}
	sink.sound("ok");
}

function doors(h: MissionHost, want: boolean, args: string[]): void {
	const { m, sink } = h;
	if (args.length === 0) {
		sink.log(`Usage: ${want ? "open" : "close"} <doors>   e.g.  ${want ? "open" : "close"} d3 d4`, "warn");
		sink.sound("err");
		return;
	}
	let moved = false;
	for (const a of args) {
		const i = doorByName(m, a);
		if (i < 0) {
			sink.log(`No door "${a}".`, "warn");
			continue;
		}
		const d = m.doors[i]!;
		if (d.open === want) {
			sink.log(`${d.name} already ${want ? "open" : "closed"}.`, "note");
			continue;
		}
		if (!want && [...m.drones.filter((x) => x.alive), ...m.creatures.filter((x) => x.alive)].some((e) => Math.hypot(e.x - d.x, e.y - d.y) < 0.85)) {
			sink.log(`${d.name}: obstructed — something is in the door frame.`, "warn");
			continue;
		}
		d.open = want;
		d.bump = 1;
		moved = true;
		sink.log(`${d.name} ${want ? "opened" : "closed"}.`, "ok");
	}
	sink.sound(moved ? "door" : "err");
}

function gather(h: MissionHost, args: string[]): void {
	const { m, sink } = h;
	const { ids } = parseDrones(args, m.drones);
	if (ids.length === 0) {
		sink.log("Usage: gather <drones>", "warn");
		return;
	}
	for (const id of ids) {
		const d = live(h, id);
		if (d === null) continue;
		if (d.node === m.dock) {
			sink.log(`Drone ${id}: nothing to gather in the dock.`, "note");
			continue;
		}
		const r = m.rooms[d.node]!;
		if (r.items.length === 0) {
			sink.log(`Drone ${id}: nothing to recover in r${r.num}.`, "warn");
			continue;
		}
		d.path = [];
		d.state = "GATHERING";
		d.gather = d.gatherFor = d.mod === "SHIELD" && d.mk2 ? 0.7 : 2;
		sink.log(`Drone ${id} gathering in r${r.num}…`, "drone");
	}
}

/** How long a drone takes to pull a log off a terminal. */
export const READ_SECONDS = 3;

function read(h: MissionHost, args: string[]): void {
	const { m, sink } = h;
	const { ids } = parseDrones(args, m.drones);
	const unread = (d: Drone) => d.alive && d.node !== m.dock && m.rooms[d.node]!.terminal?.read === false;
	const d = ids.length > 0 ? live(h, ids[0]!) : (m.drones.find(unread) ?? null);
	if (d === null) {
		if (ids.length === 0) sink.log("No drone is beside an unread terminal. Usage: read <drone>", "warn");
		return;
	}
	const terminal = d.node === m.dock ? null : m.rooms[d.node]!.terminal;
	if (terminal === null) {
		sink.log(`Drone ${d.id}: no terminal in ${nodeName(m, d.node)}.`, "warn");
		sink.sound("err");
		return;
	}
	if (terminal.read) {
		sink.log(`Drone ${d.id}: that terminal's log is already archived.`, "note");
		return;
	}
	d.path = [];
	d.state = "READING";
	d.gather = d.gatherFor = READ_SECONDS;
	sink.log(`Drone ${d.id} jacking into the terminal in ${nodeName(m, d.node)}…`, "drone");
}

function motion(h: MissionHost): void {
	const { m, sink } = h;
	const d = m.drones[0]!;
	if (!d.alive) {
		sink.log("Motion scanner was on WREN (1). No signal.", "warn");
		sink.sound("err");
		return;
	}
	if (m.motionCd > 0) {
		sink.log(`Motion scanner recharging: ${m.motionCd.toFixed(1)} s.`, "warn");
		return;
	}
	const range = d.mk2 ? 5 : 3;
	m.motionCd = d.mk2 ? 5 : 8;
	m.scanned = true;
	const reach = new Map([[d.node, 0]]), queue = [d.node];
	while (queue.length > 0) {
		const n = queue.shift()!;
		if (reach.get(n)! >= range) continue;
		for (const link of m.adj[n]!) {
			if (!reach.has(link.to)) {
				reach.set(link.to, reach.get(n)! + 1);
				queue.push(link.to);
			}
		}
	}
	m.fx.push({ type: "scan", x: d.x, y: d.y, t: 0, max: 1.4, r: range });
	const hits = m.creatures.filter((c) => c.alive && reach.has(c.node));
	for (const c of hits) {
		m.fx.push({ type: "blip", x: c.x, y: c.y, t: 0, max: 4 });
		m.suspect.set(c.node, SUSPECT_SECONDS);
	}
	if (hits.length > 0) {
		sink.log(`MOTION: ${hits.length} contact${hits.length > 1 ? "s" : ""} — ${[...new Set(hits.map((c) => nodeName(m, c.node)))].join(", ")}`, "warn");
		sink.sound("alarm");
	} else {
		sink.log(`MOTION: no movement within ${range} rooms.`, "ok");
		sink.sound("ping");
	}
}

function lure(h: MissionHost): void {
	const { m, sink, rng } = h;
	const d = m.drones[2]!;
	if (!d.alive) {
		sink.log("Decoy emitter was on BUOY (3). No signal.", "warn");
		sink.sound("err");
		return;
	}
	if (m.lure !== null && m.lure.t > 0) {
		sink.log("Decoy already sounding.", "warn");
		return;
	}
	const seconds = d.mk2 ? 14 : 8;
	m.lure = { node: d.node, x: d.x, y: d.y, t: seconds, reach: d.mk2 ? 8 : 5 };
	for (const c of m.creatures) c.think = Math.min(c.think, 0.3 + rng() * 0.6);
	sink.log(`BUOY emitting decoy noise in ${nodeName(m, d.node)} for ${seconds} s.`, "drone");
	sink.sound("ping");
}

function purge(h: MissionHost, args: string[]): void {
	const { m, sink } = h;
	const a = args[0];
	if (a === undefined || !/^r\d+$/.test(a)) {
		sink.log("Usage: purge <room>   e.g.  purge r7", "warn");
		sink.sound("err");
		return;
	}
	const i = roomByNum(m, Number(a.slice(1)));
	const r = m.rooms[i];
	if (r === undefined) {
		sink.log(`No room ${a}.`, "warn");
		return;
	}
	const refusal = !r.seen ? "not surveyed — valve status unknown" : !r.purge ? "has no purge valve" : r.purgeUsed ? "valve already spent" : null;
	if (refusal !== null) {
		sink.log(`r${r.num} ${refusal}.`, "warn");
		sink.sound("err");
		return;
	}
	r.purgeUsed = true;
	m.fx.push({ type: "flash", x: r.cx, y: r.cy, room: i, t: 0, max: 1.6 });
	sink.sound("boom");
	const killed = m.creatures.filter((c) => c.alive && c.node === i);
	for (const c of killed) c.alive = false;
	m.suspect.delete(i);
	sink.log(`PURGE r${r.num}: ${killed.length} biological signature${killed.length === 1 ? "" : "s"} neutralised.`, killed.length ? "ok" : "note");
	for (const d of m.drones.filter((x) => x.alive && x.node === i)) killDrone(m, d, "caught in the purge", sink);
}

function status(h: MissionHost): void {
	const { m, sink } = h;
	const surveyed = m.rooms.filter((r) => r.seen).length;
	sink.log(`${m.ship} · ${surveyed}/${m.rooms.length} rooms surveyed · recovered ${m.bank.scrap} scrap, ${m.bank.fuel} fuel`, "head");
	for (const d of m.drones) {
		sink.log(
			d.alive
				? `  ${d.id} ${d.name.padEnd(5)} ${d.mod.padEnd(7)} hull ${String(Math.ceil(d.hull)).padStart(3)}%  ${nodeName(m, d.node).padEnd(5)} ${d.state.padEnd(10)} cargo ${d.cargo}${d.fuel ? ` +${d.fuel} fuel` : ""}`
				: `  ${d.id} ${d.name.padEnd(5)} — NO SIGNAL`,
			d.alive ? "drone" : "warn",
		);
	}
	sink.log(`  open doors: ${m.doors.filter((d) => d.open).map((d) => d.name).join(" ") || "none"}`, "note");
	const known = m.rooms.filter((r) => r.seen && r.items.length > 0).map((r) => `r${r.num}(${r.items.map((i) => (i.kind === "fuel" ? "fuel" : i.v)).join("+")})`);
	if (known.length > 0) sink.log(`  known salvage: ${known.join(" ")}`, "loot");
}

/** Runs one mission command; `word` is what the player typed, for the error message. */
export function missionCommand(h: MissionHost, cmd: string, args: string[], word: string): void {
	const { m, sink } = h;
	if (cmd !== "undock") m.undockArm = false;
	if (cmd !== "menu") m.menuArm = false;
	if (m.end !== null) {
		sink.log("Casting off…", "note");
		return;
	}
	switch (cmd) {
		case "help":
			for (const [text, kind] of MISSION_HELP) sink.log(text, kind);
			return;
		case "labels":
			sink.log(`Labels ${h.toggleLabels() ? "on" : "off"}.`, "note");
			return;
		case "menu":
			if (!m.menuArm) {
				m.menuArm = true;
				sink.log(m.tutorial !== null ? "Leave orientation? Type MENU again." : "Abandon this boarding? Progress since the drydock is lost. Type MENU again.", "warn");
				return;
			}
			h.leave();
			return;
		case "nav":
			return nav(h, args);
		case "open":
		case "close":
			return doors(h, cmd === "open", args);
		case "gather":
			return gather(h, args);
		case "read":
			return read(h, args);
		case "motion":
			return motion(h);
		case "lure":
			return lure(h);
		case "purge":
			return purge(h, args);
		case "stop": {
			const { ids } = parseDrones(args.length > 0 ? args : ["all"], m.drones);
			for (const id of ids) {
				const d = m.drones[id - 1];
				if (d?.alive) Object.assign(d, { path: [], state: d.node === m.dock ? "DOCKED" : "IDLE", gather: 0 });
			}
			sink.log(`Stopped ${ids.join(" ")}.`, "note");
			return;
		}
		case "status":
			return status(h);
		case "undock": {
			const away = m.drones.filter((d) => d.alive && d.node !== m.dock);
			if (away.length > 0 && !m.undockArm) {
				m.undockArm = true;
				sink.log(`Drone${away.length > 1 ? "s" : ""} ${away.map((d) => d.id).join(" ")} not in the dock and will be abandoned. Type UNDOCK again to confirm.`, "warn");
				sink.sound("err");
				return;
			}
			h.finish();
			return;
		}
		default:
			sink.log(`Unknown command "${word}". Type HELP.`, "warn");
			sink.sound("err");
	}
}

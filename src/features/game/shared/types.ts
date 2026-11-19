/** How a terminal line is shown: its phosphor intensity, or an alarm in inverse video. */
export type LogKind = "echo" | "note" | "ok" | "warn" | "alarm" | "drone" | "head" | "loot";

/** A sound the console may play. */
export type Sound = "key" | "ok" | "err" | "door" | "alarm" | "ping" | "boom" | "jump";

/** Where the game sends what the player hears and reads. */
export interface Sink {
	log(text: string, kind: LogKind, typed?: boolean): void;
	sound(name: Sound): void;
	clear(): void;
	toggleSound(): boolean;
}

export interface Point {
	x: number;
	y: number;
}

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
	cx: number;
	cy: number;
}

/** Something a drone can carry home: scrap, a data core (worth 3), or a fuel cell. */
export interface Item extends Point {
	v: number;
	kind: "scrap" | "core" | "fuel";
}

/** A crew terminal holding log `log`; story terminals carry the main plot. */
export interface Terminal {
	log: string;
	story: boolean;
	read: boolean;
}

export interface Room extends Box {
	num: number;
	terminal: Terminal | null;
	seen: boolean;
	items: Item[];
	rad: boolean;
	purge: boolean;
	purgeUsed: boolean;
	radWarn: boolean;
}

/** A door between rooms `a` and `b`, on a vertical (`v`) or horizontal (`h`) wall. The airlock joins the dock. */
export interface Door extends Point {
	a: number;
	b: number;
	o: "v" | "h";
	num: number;
	name: string;
	open: boolean;
	air: boolean;
	bump: number;
}

export interface Link {
	door: number;
	to: number;
}

/** A point on a route; passing a door's point moves the walker into room `to`. */
export interface Waypoint extends Point {
	door?: number;
	to?: number;
}

export interface Creature extends Point {
	node: number;
	path: Waypoint[];
	alive: boolean;
	think: number;
	hunt: number;
	vis: boolean;
	ph: number;
	dir: number;
}

/** A generated derelict. Node `dock` is the tug's bay, past the airlock. */
export interface Ship {
	seed: number;
	rooms: Room[];
	doors: Door[];
	adj: Link[][];
	dockBox: Box;
	dock: number;
	start: number;
	depth: number[];
	creatures: Creature[];
}

export type Module = "MOTION" | "SHIELD" | "LURE";

/** What a drone keeps between ships. */
export interface DroneSpec {
	id: number;
	name: string;
	mod: Module;
	hull: number;
	alive: boolean;
	armour: number;
	thrust: number;
	mk2: boolean;
}

export type DroneState = "DOCKED" | "IDLE" | "MOVING" | "GATHERING" | "READING" | "BLOCKED" | "LOST";

export interface Drone extends DroneSpec, Point {
	node: number;
	path: Waypoint[];
	state: DroneState;
	cargo: number;
	fuel: number;
	gather: number;
	gatherFor: number;
	dir: number;
	hit: number;
	dest: number | null;
	wreck: boolean;
}

export interface Difficulty {
	W: number;
	H: number;
	creatures: number;
	rad: number;
	purge: number;
	scrap: number;
	fuel: number;
	openP: number;
	remove: number;
	chase: number;
	wander: number;
	dmg: number;
}

export interface Fx extends Point {
	type: "blip" | "scan" | "ring" | "flash" | "boom";
	t: number;
	max: number;
	r?: number;
	room?: number;
}

export interface Lure extends Point {
	node: number;
	t: number;
	reach: number;
}

export type Target = { room: number } | { door: number } | { dock: true };

export interface TutorialStep {
	text: string;
	done: (mission: Mission) => boolean;
	target: Target | null;
}

export interface Tutorial {
	i: number;
	steps: TutorialStep[];
}

/** One boarding: the ship, the drones on it, and what they've brought back so far. */
export interface Mission extends Ship {
	o: Difficulty;
	ship: string;
	site: number;
	reads: { drone: number; room: number }[];
	drones: Drone[];
	bank: { scrap: number; fuel: number };
	t: number;
	fx: Fx[];
	lure: Lure | null;
	motionCd: number;
	end: "undock" | "lost" | null;
	undockArm: boolean;
	menuArm: boolean;
	scanned: boolean;
	tutorial: Tutorial | null;
}

export interface Campaign {
	seed: number;
	jump: number;
	fuel: number;
	scrap: number;
	drones: DroneSpec[];
	stats: { scrap: number; rooms: number; kills: number };
	ended: boolean;
}

export interface Best {
	jump: number;
	scrap: number;
}

export interface Over {
	reason: string;
	jump: number;
	scrap: number;
	rooms: number;
	kills: number;
}

export type Mode = "menu" | "intro" | "mission" | "drydock" | "ending" | "over";

/** What the game remembers between runs. Reads are immediate; how writes are kept is the store's business. */
export interface SaveStore {
	campaign(): Campaign | null;
	best(): Best | null;
	tutorialDone(): boolean;
	keepCampaign(campaign: Campaign | null): void;
	keepBest(best: Best): void;
	finishTutorial(): void;
	archive(): readonly string[];
	keepLog(id: string): void;
	introSeen(): boolean;
	markIntroSeen(): void;
	endings(): readonly string[];
	keepEnding(ending: string): void;
}

import { baseDrones, type DroneSpec, type DroneState, FINAL_SITE, type Game, type Mission, nodeName, regionOf } from "../../game/shared/index.ts";
import { CAM_H, CAM_W, type CamScene, type CamView, drawCam } from "./cam.ts";
import { HOT_PIXEL, phosphor } from "./palette.ts";
import { bar, pips } from "./screens.ts";

interface Card {
	feed: HTMLCanvasElement;
	state: HTMLElement;
	camera: HTMLElement;
	alert: HTMLElement;
	hullBar: HTMLElement;
	hull: HTMLElement;
	left: HTMLElement;
	middle: HTMLElement;
	module: HTMLElement;
}

const SCENE: Record<DroneState, CamScene> = { DOCKED: "bay", IDLE: "idle", MOVING: "moving", GATHERING: "gathering", READING: "reading", BLOCKED: "blocked", LOST: "static" };

const el = (doc: Document, id: string): HTMLElement => doc.getElementById(id)!;

function span(doc: Document, className: string, text = ""): HTMLElement {
	const s = doc.createElement("span");
	s.className = className;
	s.textContent = text;
	return s;
}

/** The side panels, status lines and function keys, redrawn from the game every frame. */
export class Panels {
	readonly #doc: Document;
	readonly #run: (command: string) => void;
	#cards: Card[] = [];
	#builtFor = "";
	#textAt = 0;

	constructor(doc: Document, run: (command: string) => void) {
		this.#doc = doc;
		this.#run = run;
	}

	update(game: Game, now: number): void {
		const shape = `${game.mode}:${game.mission === null ? "" : game.mission.seed}`;
		if (shape !== this.#builtFor) {
			this.#builtFor = shape;
			this.#buildKeys(game);
			this.#buildCards(game);
			this.#mode(game);
		}
		this.#feeds(game, now);
		if (now - this.#textAt < 100) return;
		this.#textAt = now;
		this.#cardText(game);
		this.#status(game);
	}

	#mode(game: Game): void {
		const doc = this.#doc, m = game.mission;
		const titles = { drydock: "[ DRYDOCK ]", mission: "[ SCHEMATIC ]", intro: "[ TRANSMISSION ]", ending: "[ CYBERDIME PRIORITY ]", menu: "[ SALVAGE-OS ]", over: "[ SALVAGE-OS ]" } as const;
		el(doc, "mapTitle").textContent = titles[game.mode];
		el(doc, "mapSub").textContent = m !== null ? (m.tutorial !== null ? m.ship : `${m.ship} · ${regionOf(m.site).name}`) : game.mode === "drydock" ? `AFTER SITE ${game.campaign?.jump ?? 0}` : game.mode === "intro" ? "CONTRACT 7731-K" : "LACUNA";
		el(doc, "maphint").style.visibility = game.mode === "mission" ? "visible" : "hidden";
		(doc.querySelector(".legend") as HTMLElement).style.display = game.mode === "mission" ? "" : "none";
	}

	#buildKeys(game: Game): void {
		const row = el(this.#doc, "fkeys");
		row.replaceChildren();
		game.fkeys().forEach((key, i) => {
			const button = this.#doc.createElement("button");
			const number = this.#doc.createElement("b");
			number.className = "a-i";
			number.textContent = String(i + 1);
			button.append(number, span(this.#doc, "", key === null ? "" : key[0]));
			if (key === null) button.disabled = true;
			else {
				button.title = `F${i + 1}: ${key[1]}`;
				button.addEventListener("click", () => this.#run(key[1]));
			}
			row.appendChild(button);
		});
	}

	#drones(game: Game): readonly DroneSpec[] {
		return game.mode === "mission" && game.mission !== null ? game.mission.drones : game.mode === "drydock" && game.campaign !== null ? game.campaign.drones : baseDrones();
	}

	#buildCards(game: Game): void {
		const doc = this.#doc, wrap = el(doc, "cards");
		wrap.replaceChildren();
		this.#cards = this.#drones(game).map((d) => {
			const card = doc.createElement("div");
			card.className = "card";
			const head = doc.createElement("div");
			head.className = "ch";
			const state = doc.createElement("em");
			head.append(span(doc, "a-b", `DRONE ${d.id}`), span(doc, "a-n", d.name), state);
			const frame = doc.createElement("div");
			frame.className = "feedw";
			const feed = doc.createElement("canvas");
			feed.width = CAM_W;
			feed.height = CAM_H;
			const overlay = doc.createElement("div");
			overlay.className = "ov";
			const camera = span(doc, "a-b"), alert = span(doc, "al");
			overlay.append(camera, alert);
			frame.append(feed, overlay);
			const hullLine = doc.createElement("div");
			hullLine.className = "ln";
			const hullBar = span(doc, "a-n"), hull = span(doc, "a-b");
			const hullLabel = span(doc, "a-m", "HULL ");
			hullLabel.append(hullBar);
			hullLine.append(hullLabel, hull);
			const info = doc.createElement("div");
			info.className = "ln a-m";
			const left = span(doc, ""), middle = span(doc, ""), module = span(doc, "");
			info.append(left, middle, module);
			card.append(head, frame, hullLine, info);
			wrap.appendChild(card);
			return { feed, state, camera, alert, hullBar, hull, left, middle, module };
		});
	}

	#threatened(m: Mission | null, i: number): boolean {
		const d = m?.drones[i];
		return m !== null && d !== undefined && d.alive && m.creatures.some((c) => c.alive && c.vis && c.node === d.node);
	}

	#feeds(game: Game, now: number): void {
		const m = game.mode === "mission" ? game.mission : null;
		this.#drones(game).forEach((d, i) => {
			const card = this.#cards[i];
			if (card === undefined) return;
			drawCam(card.feed.getContext("2d", { willReadFrequently: true })!, this.#view(game, m, d, i), now / 1000, HOT_PIXEL, phosphor);
		});
	}

	#view(game: Game, m: Mission | null, d: DroneSpec, i: number): CamView {
		const live = m?.drones[i];
		const view: CamView = { scene: "standby", progress: 0, room: 0, heading: 0, scanning: false, luring: false, threat: false, rad: false, channel: d.id };
		if (!d.alive) return { ...view, scene: "static" };
		if (m === null || live === undefined) return { ...view, scene: game.mode === "drydock" ? "bay" : "standby" };
		const scene = SCENE[live.state];
		return {
			scene,
			progress: live.gatherFor > 0 ? 1 - live.gather / live.gatherFor : 0,
			room: live.node,
			heading: live.dir,
			scanning: live.mod === "MOTION" && m.motionCd > (live.mk2 ? 5 : 8) - 1.6,
			luring: live.mod === "LURE" && m.lure !== null && m.lure.t > 0,
			threat: this.#threatened(m, i),
			rad: live.node !== m.dock && m.rooms[live.node]!.rad,
			channel: d.id,
		};
	}

	#cardText(game: Game): void {
		const m = game.mode === "mission" ? game.mission : null;
		this.#drones(game).forEach((d, i) => {
			const card = this.#cards[i];
			if (card === undefined) return;
			const live = m === null ? null : m.drones[i]!;
			const state = !d.alive ? "NO SIGNAL" : live !== null ? live.state : game.mode === "drydock" ? "IN BAY" : "STANDBY";
			card.state.textContent = state;
			card.state.className = !d.alive ? "a-H" : state === "BLOCKED" ? "a-h" : state === "MOVING" || state === "GATHERING" || state === "READING" ? "a-i" : "a-m";
			card.camera.textContent = !d.alive
				? "— NO SIGNAL —"
				: live !== null && m !== null
					? `CAM ${d.id} · ${nodeName(m, live.node).toUpperCase()}${live.dest !== null && live.path.length > 0 ? ` → ${nodeName(m, live.dest).toUpperCase()}` : ""}`
					: `CAM ${d.id} · ${game.mode === "drydock" ? "BAY" : "OFFLINE"}`;
			const threat = this.#threatened(m, i), rad = live !== null && m !== null && live.alive && live.node !== m.dock && m.rooms[live.node]!.rad;
			card.alert.textContent = threat ? "!! LIFEFORM" : rad ? "RADIATION" : "";
			card.alert.className = `al ${threat ? "a-H" : rad ? "a-h" : ""}`;
			const hull = Math.max(0, Math.ceil(d.hull));
			card.hullBar.textContent = bar(hull / 100, 12);
			card.hullBar.className = hull < 35 ? "a-h" : "a-n";
			card.hull.textContent = `${String(hull).padStart(3)}%`;
			card.left.textContent = live !== null && m !== null ? (live.alive ? `LOC ${nodeName(m, live.node)}` : "LOC —") : `ARM ${pips(d.armour, 2)}`;
			card.middle.textContent = live !== null ? `CARGO ${live.cargo}${live.fuel ? `+${live.fuel}F` : ""}` : `THR ${pips(d.thrust, 2)}`;
			card.module.textContent = d.mod + (d.mk2 ? " MK2" : "");
		});
	}

	#status(game: Game): void {
		const doc = this.#doc, m = game.mode === "mission" ? game.mission : null, camp = game.campaign;
		const inCampaign = camp !== null && game.mode !== "menu" && (m === null || m.tutorial === null);
		const scrap = (inCampaign ? camp.scrap : 0) + (m?.bank.scrap ?? 0), fuel = (inCampaign ? camp.fuel : 0) + (m?.bank.fuel ?? 0);
		el(doc, "hScrap").textContent = String(scrap);
		el(doc, "hFuel").textContent = String(fuel);
		el(doc, "hBlocks").textContent = bar(Math.min(fuel, 6) / 6, 6);
		el(doc, "hJump").textContent = m?.tutorial ? "SIM" : inCampaign ? `${camp.jump}${camp.jump <= FINAL_SITE ? `/${FINAL_SITE}` : ""}` : "—";
		el(doc, "hDr").textContent = `${this.#drones(game).filter((d) => d.alive).length}/3`;
		el(doc, "hTime").textContent = m === null ? "--:--" : `${String(Math.floor(m.t / 60)).padStart(2, "0")}:${String(Math.floor(m.t % 60)).padStart(2, "0")}`;
		el(doc, "hShip").textContent = m !== null ? `SITE: ${m.ship}` : game.mode === "drydock" ? "DRYDOCK · IN TRANSIT" : game.mode === "intro" ? "INCOMING TRANSMISSION" : "LACUNA ORBIT";
		el(doc, "hSeed").textContent = m !== null ? String(m.seed) : camp !== null && game.mode === "drydock" ? String(camp.seed) : "—";
		el(doc, "mapStat").textContent = m === null ? "—" : `${m.rooms.filter((r) => r.seen).length}/${m.rooms.length}`;

		const big = el(doc, "mBig"), objective = el(doc, "mObj"), cargo = el(doc, "mCargo"), best = el(doc, "mBest");
		if (m?.tutorial) {
			big.textContent = "ORIENTATION";
			objective.textContent = "Follow the highlighted orientation step. Hazards are simulated; nothing here is lost.";
		} else if (m !== null && camp !== null) {
			big.textContent = `SITE ${camp.jump}`;
			objective.textContent = `${regionOf(m.site).name}. Bring scrap and fuel into the dock, READ terminals, then UNDOCK. Fuel: ${camp.fuel}.`;
		} else if (game.mode === "drydock" && camp !== null) {
			big.textContent = `SITE ${camp.jump} ✓`;
			objective.textContent = "Repair, rebuild and upgrade, then HOP. Each hop burns 1 fuel.";
		} else if (game.mode === "intro") {
			big.textContent = "CONTRACT";
			objective.textContent = "Press Enter to skip.";
		} else if (game.mode === "ending") {
			big.textContent = "THE BORE ✓";
			objective.textContent = "DELIVER the canisters to Cyberdime, or BROADCAST the crew's logs.";
		} else if (game.mode === "over") {
			big.textContent = "TERMINATED";
			objective.textContent = "Type CONTRACT to sign a new contract.";
		} else {
			big.textContent = "STANDBY";
			objective.textContent = "Choose 1 ORIENTATION, 2 NEW CONTRACT or 3 RESUME.";
		}
		cargo.textContent = m !== null ? `Boarding: +${m.bank.scrap} scrap, +${m.bank.fuel} fuel · aboard drones ${m.drones.reduce((s, d) => s + d.cargo, 0)}` : inCampaign ? `Totals: ${camp.stats.scrap} scrap salvaged · ${camp.stats.kills} lifeforms neutralised` : "";
		const record = game.saves.best();
		best.textContent = `${record === null ? "" : `Best: site ${record.jump} · ${record.scrap} scrap · `}Archive: ${game.saves.archive().length} logs`;

		const tutorial = el(doc, "tut"), steps = m?.tutorial;
		tutorial.hidden = steps === undefined || steps === null || m?.end !== null;
		if (steps) tutorial.textContent = `ORIENTATION ${steps.i + 1}/${steps.steps.length} ▸ ${steps.steps[steps.i]!.text}`;

		const alert = el(doc, "hAlert"), seen = m?.creatures.find((c) => c.alive && c.vis);
		const [text, cls] =
			m === null
				? [game.mode === "drydock" ? "IN TRANSIT · DRYDOCK" : game.mode === "over" ? " CONTRACT TERMINATED " : game.mode === "intro" ? " INCOMING · PRIORITY " : game.mode === "ending" ? " CYBERDIME ON THE LINE " : "AWAITING ORDERS", game.mode === "over" || game.mode === "intro" || game.mode === "ending" ? "a-H" : "a-m"]
				: m.end !== null
					? [" CASTING OFF ", "a-i"]
					: seen !== undefined
						? [` !! LIFEFORM IN ${nodeName(m, seen.node).toUpperCase()} `, Math.floor(m.t * 2.5) % 2 ? "a-H" : "a-h"]
						: m.drones.some((d) => d.alive && d.node !== m.dock && m.rooms[d.node]!.rad)
							? ["RADIATION EXPOSURE", "a-h"]
							: ["ALL CLEAR · TETHER STABLE", "a-m"];
		alert.textContent = text;
		alert.className = cls;
		doc.body.classList.toggle("alarm", game.threat);
	}
}

// What a player does with the game, driven on the built app.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkFeatureMap } from "@raresportan/marram/electron/feature-map";
import { hiddenControls } from "@raresportan/marram/electron/geometry";
import { askedCommand } from "../../src/features/game/shared/index.ts";
import { PROJECT, type Session, serveBuild } from "./harness.ts";

const mapSize = (session: Session) =>
	session.page.evaluate(() => {
		const map = document.getElementById("map") as HTMLCanvasElement;
		return { css: map.clientHeight, pixels: map.height, ratio: devicePixelRatio, width: map.clientWidth };
	});

export async function boots(session: Session): Promise<void> {
	await session.launch();
	await session.check("The title menu offers the tutorial and a new campaign", async () => /1\s+TUTORIAL/.test(await session.log()) && /2\s+NEW CAMPAIGN/.test(await session.log()));
	await session.check(
		"The map fills its window, measured after the warm-up",
		async () => {
			const size = await mapSize(session);
			return size.css > 200 && size.width > 300 && Math.abs(size.pixels - Math.round(size.css * Math.min(2, size.ratio))) <= 1;
		},
		async () => JSON.stringify(await mapSize(session)),
	);
	await session.check("Every control can be clicked where it's drawn", async () => (await hiddenControls(session.page, "#term")).length === 0, async () => (await hiddenControls(session.page, "#term")).join("; "));
	await session.shot("menu");
}

export async function tutorial(session: Session): Promise<void> {
	await session.launch();
	await session.type("1");
	await session.check("The tutorial starts at its first step", async () => (await session.text("#tut")).startsWith("TUTORIAL 1/7"));
	for (let step = 1; step < 7; step++) {
		const hint = await session.text("#tut");
		await session.type(askedCommand(hint));
		await session.check(`Doing step ${step} moves on to step ${step + 1}`, async () => (await session.text("#tut")).startsWith(`TUTORIAL ${step + 1}/7`), () => session.text("#tut"));
	}
	await session.shot("tutorial-last-step");
	await session.type("nav all dock");
	await session.check("All three drones come home", async () => (await session.page.locator("#cards em", { hasText: "DOCKED" }).count()) === 3);
	await session.type("undock");
	await session.check("Undocking ends the tutorial and returns to the menu, marked done", async () => /TUTORIAL\s+a guided first boarding \(completed\)/.test(await session.log()), () => session.log());
}

export async function campaign(session: Session): Promise<void> {
	await session.launch();
	await session.type("2");
	await session.check("A new campaign boards the first derelict", async () => (await session.text("#hJump")) === "1" && (await session.text("#mapTitle")) === "[ SCHEMATIC ]");
	await session.type("undock");
	await session.check("Undocking reaches the drydock", async () => (await session.text("#mapTitle")) === "[ DRYDOCK ]");
	await session.shot("drydock");
	await session.close();
	await session.launch();
	await session.check("After a restart the menu offers to continue from jump 1", async () => /3\s+CONTINUE\s+jump 1/.test(await session.log()), () => session.log());
	await session.type("3");
	await session.check("Continuing restores the drydock", async () => (await session.text("#mapTitle")) === "[ DRYDOCK ]" && /Campaign restored/.test(await session.log()));
	await session.type("jump");
	await session.check("Jumping boards the second derelict", async () => (await session.text("#hJump")) === "2" && (await session.text("#mapTitle")) === "[ SCHEMATIC ]");
}

export async function keys(session: Session): Promise<void> {
	await session.launch();
	await session.type("1");
	await session.check("The function keys follow the screen", async () => /MOTION/.test(await session.text("#fkeys")));
	await session.page.keyboard.press("F3");
	await session.check("F3 runs the motion scanner", async () => /MOTION: /.test(await session.log()));
	await session.page.locator("#fkeys button", { hasText: "LABELS" }).click();
	await session.check("The LABELS key answers a click", async () => /Labels off/.test(await session.log()));
}

const savedFile = (session: Session): unknown => {
	try {
		return JSON.parse(readFileSync(join(session.userData, "saves.json"), "utf8"));
	} catch {
		return undefined;
	}
};

export async function damagedSave(session: Session): Promise<void> {
	mkdirSync(session.userData, { recursive: true });
	writeFileSync(join(session.userData, "saves.json"), '{"campaign":{"seed":7,"jump":"three","drones":[{"id":1}]},"best":{"jump":4,"scrap":31},"tutorialDone":true}');
	await session.launch();
	await session.check("A damaged save still opens on the title menu, printed in full", async () => /Type a number \(or its name\) and press Enter\./.test(await session.log()));
	await session.check("The damaged campaign isn't offered to continue", async () => !/3\s+CONTINUE/.test(await session.log()), () => session.log());
	await session.check("What wasn't damaged is kept: the best run and the finished tutorial", async () => /Best run: 4 derelicts/.test(await session.log()) && /\(completed\)/.test(await session.log()), () => session.log());
	await session.type("2");
	await session.type("undock");
	await session.check("The next save replaces the damaged file with a whole one", () => {
		const saved = savedFile(session) as { campaign?: { jump?: unknown } } | undefined;
		return saved?.campaign?.jump === 1;
	}, () => JSON.stringify(savedFile(session)));
}

export async function browser(session: Session): Promise<void> {
	const site = await serveBuild();
	try {
		await session.launchWeb(site.url);
		await session.check("The build opens from a Pages-style subpath, its assets found", async () => /2\s+NEW CAMPAIGN/.test(await session.log()));
		await session.check("A browser has no app bridge, so saves go to local storage", async () => await session.page.evaluate(() => !("saves" in window)));
		await session.type("2");
		await session.type("undock");
		const stored = () => session.page.evaluate(() => localStorage.getItem("derelict-drone-ops:save"));
		await session.check("Reaching the drydock saves the campaign in local storage", async () => (JSON.parse((await stored()) ?? "{}") as { campaign?: { jump?: number } }).campaign?.jump === 1, async () => String(await stored()));
		await session.page.reload();
		await session.page.locator("#out div").first().waitFor();
		await session.check("After a reload the menu offers to continue", async () => /3\s+CONTINUE\s+jump 1/.test(await session.log()), () => session.log());
		await session.shot("browser-menu");
		await session.close();
	} finally {
		await site.close();
	}
}

export const JOURNEYS: Record<string, { readonly run: (session: Session) => Promise<void>; readonly app: boolean }> = {
	boots: { run: boots, app: true },
	tutorial: { run: tutorial, app: true },
	campaign: { run: campaign, app: true },
	keys: { run: keys, app: true },
	"damaged-save": { run: damagedSave, app: true },
	browser: { run: browser, app: true },
	"feature-map": {
		app: false,
		run: async (session) => checkFeatureMap(session, { map: join(PROJECT, "docs", "feature-map.md"), folder: join(PROJECT, "scripts", "verify"), journeys: JOURNEYS }),
	},
};

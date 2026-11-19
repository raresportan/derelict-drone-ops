// The game's journeys: the built app on Marram's session.
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createRequire } from "node:module";
import { extname, join, normalize } from "node:path";
import { type JourneyOptions, JourneySession } from "@raresportan/marram/electron/session";

const require = createRequire(import.meta.url);
export const PROJECT = join(import.meta.dirname, "..", "..");

export class Session extends JourneySession {
	constructor(name: string, options: JourneyOptions) {
		super(name, options, "ddo-verify");
	}

	/** Start the app windowed (again, with the same profile and saves after `close`), and wait for the title menu. */
	async launch(): Promise<void> {
		await this.start({ executablePath: require("electron") as unknown as string, main: join(PROJECT, "out", "main", "index.js"), unthrottled: true });
		await this.page.waitForSelector("#screen");
		await this.page.locator("#out div").first().waitFor();
	}

	/** Opens `url` in a bare browser window (no preload, no bridge), as a visitor on GitHub Pages would see it. */
	async launchWeb(url: string): Promise<void> {
		await this.start({ executablePath: require("electron") as unknown as string, main: join(PROJECT, "scripts", "verify", "web-shell.mjs"), env: { DDO_WEB_URL: url }, unthrottled: true });
		await this.page.waitForSelector("#screen");
		await this.page.locator("#out div").first().waitFor();
	}

	/** Types `line` at the prompt and presses Enter. */
	async type(line: string): Promise<void> {
		const prompt = this.page.locator("#cmd");
		await prompt.fill(line);
		await prompt.press("Enter");
	}

	text(selector: string): Promise<string> {
		return this.page.locator(selector).innerText();
	}

	async log(): Promise<string> {
		return this.text("#out");
	}
}

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

/** Serves the built renderer under `/derelict-drone-ops/`, the path GitHub Pages gives it. */
export async function serveBuild(): Promise<{ url: string; close: () => Promise<void> }> {
	const folder = join(PROJECT, "out", "renderer");
	const server = createServer((request, response) => {
		const path = new URL(request.url ?? "/", "http://localhost").pathname;
		if (!path.startsWith("/derelict-drone-ops/")) {
			response.writeHead(404).end();
			return;
		}
		const file = normalize(join(folder, path.slice("/derelict-drone-ops/".length) || "index.html"));
		if (!file.startsWith(folder)) {
			response.writeHead(403).end();
			return;
		}
		readFile(file).then(
			(body) => response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body),
			() => response.writeHead(404).end(),
		);
	});
	await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
	const { port } = server.address() as AddressInfo;
	const close = (): Promise<void> => {
		server.closeAllConnections();
		return new Promise((done) => server.close(() => done()));
	};
	return { url: `http://127.0.0.1:${port}/derelict-drone-ops/`, close };
}

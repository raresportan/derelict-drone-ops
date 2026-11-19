// The game's journeys: the built app on Marram's session.
import { createRequire } from "node:module";
import { join } from "node:path";
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

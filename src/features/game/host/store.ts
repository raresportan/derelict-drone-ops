import { readFile, rename, writeFile } from "node:fs/promises";
import { EMPTY_SAVE, parseSave, type SaveData } from "../shared/save.ts";

/** The save kept in `file`. A missing or damaged file reads as no save; writes land whole and in the order asked. */
export class SaveFile {
	readonly #file: string;
	#tail: Promise<unknown> = Promise.resolve();

	constructor(file: string) {
		this.#file = file;
	}

	async read(): Promise<SaveData> {
		await this.#tail.catch(() => {});
		return this.#load();
	}

	write(data: SaveData): Promise<void> {
		const clean = parseSave(data);
		const next = this.#tail.catch(() => {}).then(async () => {
			await writeFile(`${this.#file}.tmp`, JSON.stringify(clean));
			await rename(`${this.#file}.tmp`, this.#file);
		});
		this.#tail = next;
		return next;
	}

	async #load(): Promise<SaveData> {
		try {
			return parseSave(JSON.parse(await readFile(this.#file, "utf8")));
		} catch {
			return EMPTY_SAVE;
		}
	}
}

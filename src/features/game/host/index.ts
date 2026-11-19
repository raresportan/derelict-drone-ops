import { ipcMain } from "electron";
import { CHANNELS, type SaveData } from "../shared/save.ts";
import { SaveFile } from "./store.ts";

/** Answers the renderer's save requests from `file`. */
export function serveSaves(file: string): void {
	const store = new SaveFile(file);
	ipcMain.handle(CHANNELS.load, () => store.read());
	ipcMain.handle(CHANNELS.write, (_event, data: SaveData) => store.write(data));
}

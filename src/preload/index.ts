import { contextBridge, ipcRenderer } from "electron";
import { CHANNELS, type SaveData, type SavesApi } from "../features/game/shared/index.ts";

const saves: SavesApi = {
	load: () => ipcRenderer.invoke(CHANNELS.load) as Promise<SaveData>,
	write: (data) => ipcRenderer.invoke(CHANNELS.write, data) as Promise<void>,
};
contextBridge.exposeInMainWorld("saves", saves);

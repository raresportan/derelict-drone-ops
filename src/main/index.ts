import { join } from "node:path";
import { background } from "@raresportan/marram/node/background";
import { app, BrowserWindow, Menu, shell } from "electron";
import { serveSaves } from "../features/game/host/index.ts";

const isMac = process.platform === "darwin";
const ICON = join(import.meta.dirname, "..", "..", "resources", "icon.png");

function open(): Promise<void> {
	const window = new BrowserWindow({
		width: 1280,
		height: 800,
		minWidth: 960,
		minHeight: 620,
		backgroundColor: "#080503",
		title: "Derelict Drone Ops",
		icon: ICON,
		fullscreen: process.argv.includes("--fullscreen"),
		autoHideMenuBar: true,
		webPreferences: { preload: join(import.meta.dirname, "..", "preload", "index.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
	});
	window.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url).catch((error: unknown) => console.error("Opening a link failed:", error));
		return { action: "deny" };
	});
	window.webContents.on("will-navigate", (event) => event.preventDefault());
	return window.loadFile(join(import.meta.dirname, "..", "renderer", "index.html"));
}

Menu.setApplicationMenu(
	Menu.buildFromTemplate([
		...(isMac ? [{ role: "appMenu" as const }] : []),
		{ role: "editMenu" },
		{ label: "View", submenu: [{ role: "togglefullscreen" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "reload" }, { role: "toggleDevTools" }] },
		...(isMac ? [] : [{ label: "File", submenu: [{ role: "quit" as const }] }]),
	]),
);

app.on("window-all-closed", () => app.quit());
background("start", app.whenReady().then(() => {
	if (isMac) app.dock?.setIcon(ICON);
	serveSaves(join(app.getPath("userData"), "saves.json"));
	return open();
}));

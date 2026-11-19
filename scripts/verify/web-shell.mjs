// A bare browser window for the browser journey: no preload, so the page sees no Electron bridge, as on GitHub Pages.
// No top-level await: the journey's launcher waits for this module to finish importing before Electron is ready.
import { app, BrowserWindow } from "electron";

app.on("window-all-closed", () => app.quit());
app
	.whenReady()
	.then(() => new BrowserWindow({ width: 1280, height: 800, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } }).loadURL(process.env.DDO_WEB_URL))
	.catch((error) => {
		console.error("The browser shell failed to open the page:", error);
		app.exit(1);
	});

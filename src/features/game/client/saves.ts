import { EMPTY_SAVE, parseSave, type SaveData, type SaveStore } from "../shared/index.ts";

const BROWSER_KEY = "derelict-drone-ops:save";

function fromBrowser(): SaveData {
	try {
		const raw = localStorage.getItem(BROWSER_KEY);
		return raw === null ? EMPTY_SAVE : parseSave(JSON.parse(raw));
	} catch {
		return EMPTY_SAVE;
	}
}

function toBrowser(data: SaveData): void {
	try {
		localStorage.setItem(BROWSER_KEY, JSON.stringify(data));
	} catch {
		return;
	}
}

/**
 * The game's saves, read once at start. In the app they live in a file the main process writes; in a browser, in local
 * storage. A failed write is reported on the console: the game carries on, and the next write tries again.
 */
export async function openSaves(): Promise<SaveStore> {
	const api = window.saves;
	let data = api === undefined ? fromBrowser() : await api.load();
	const keep = (next: SaveData): void => {
		data = next;
		if (api === undefined) toBrowser(data);
		else api.write(data).catch((error: unknown) => console.error("Saving failed:", error));
	};
	return {
		campaign: () => (data.campaign === null ? null : structuredClone(data.campaign)),
		best: () => data.best,
		tutorialDone: () => data.tutorialDone,
		keepCampaign: (campaign) => keep({ ...data, campaign: campaign === null ? null : structuredClone(campaign) }),
		keepBest: (best) => keep({ ...data, best: { ...best } }),
		finishTutorial: () => keep({ ...data, tutorialDone: true }),
		archive: () => data.archive,
		keepLog: (id) => {
			if (!data.archive.includes(id)) keep({ ...data, archive: [...data.archive, id] });
		},
		introSeen: () => data.introSeen,
		markIntroSeen: () => {
			if (!data.introSeen) keep({ ...data, introSeen: true });
		},
		endings: () => data.endings,
		keepEnding: (ending) => {
			if (!data.endings.includes(ending)) keep({ ...data, endings: [...data.endings, ending] });
		},
	};
}

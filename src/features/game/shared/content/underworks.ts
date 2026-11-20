import type { RegionText } from "../story.ts";

export default {
	beat: [
		"THE UNDERWORKS. The surface is behind you. The crew came down here, where the reactor kept the lights on.",
		"The lights are off now. Your drones' lamps are the only warm things moving.",
	],
	story: [
		{ id: "S06", from: 8, title: "Ops memo", author: "T. Ferreira, operations chief", lines: ["Purge vents installed in every ring below. Cyberdime says the cost comes out of our bonus.", "Fine. Nobody here is planning to spend it."] },
		{ id: "S07", from: 9, title: "Field notes, 14", author: "Dr Sun Ji-ho, biologist", lines: ["It isn't hunting us. It's hunting heat and sound.", "We are very warm and very loud."] },
		{ id: "S08", from: 10, title: "Security log", author: "M. Kell, security chief", lines: ["It follows sound. Drones, engines, voices. Keep quiet.", "Pell's beacon pulled six of them into the pump hall. Then we vented it."] },
		{ id: "S09", from: 12, title: "Message to Cyberdime", author: "L. Vasch, Cyberdime liaison", lines: ["Crew requesting evacuation of Lacuna complex. Advise.", "REPLY: DENIED. MAINTAIN BORE OPERATIONS. SAMPLES ARE PRIORITY ONE."] },
		{ id: "S10", from: 14, title: "Unscheduled transmission", author: "Y. Brandt, communications", lines: ["Sending the SOS on my own key. Vasch can fire me.", "If anyone hears this: do not land. Do not —"] },
	],
	crew: [
		{ id: "C-U01", title: "Tunnel K", author: "Pell, maintenance", lines: ["Taped the vent grilles shut. They came through the drain instead.", "Taped the drain. We'll see."] },
		{ id: "C-U02", title: "Pump hall", author: "Automated", lines: ["PUMP 3 FLOW BLOCKED. OBSTRUCTION IS WARM.", "OBSTRUCTION IS MOVING."] },
		{ id: "C-U03", title: "Cold storage inventory", author: "Bix, cook", lines: ["Forty days of food if we stretch it. Twenty if Okafor keeps sleepwalking into the freezer.", "Why does he keep going to the cold room? It's the one place they don't like."] },
		{ id: "C-U04", title: "Barracks wall", author: "Scratched", lines: ["DAY 1 ||||| ||||| ||||| |||", "DAY 19. STILL HERE."] },
		{ id: "C-U05", title: "Shaft head", author: "D. Okafor, drill foreman", lines: ["Bore lift still running on Vasch's orders. Samples go down every shift.", "I asked why down, not up. He said that's where the buyer is."] },
		{ id: "C-U06", title: "Reactor annex", author: "Pell, maintenance", lines: ["Coolant leak in the annex. Radiation badge went orange, then black.", "Sealed it. Don't send anyone in without shielding."] },
		{ id: "C-U07", title: "Security hub", author: "M. Kell, security chief", lines: ["Door logs show every door in the barracks opened at 03:10.", "Nobody badged them. Nobody remembers getting up."] },
		{ id: "C-U08", title: "Letter home", author: "Y. Brandt, communications", lines: ["Mum, the dish is down again so this sits in the outbox.", "I'm fine. Tell Kenji I'll be home for his birthday. Don't tell him I'm lying."] },
		{ id: "C-U09", title: "Field notes, 15", author: "Dr Sun Ji-ho, biologist", lines: ["The rash is the same organism. Thin threads under the skin.", "It isn't eating them. It's using them. To find warmth, maybe. Or the way down."] },
		{ id: "C-U10", title: "Galley board", author: "Bix, cook", lines: ["Last tin of peaches. Saving it for whoever gets us out.", "Bring a spoon."] },
	],
} satisfies RegionText;

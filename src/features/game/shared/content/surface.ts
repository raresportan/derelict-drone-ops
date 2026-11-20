import type { RegionText } from "../story.ts";

export default {
	beat: [
		"THE SURFACE. The hopper settles on grey ice under Brannock's banded glow.",
		"Domes, landing pads and pipe runs stretch to the horizon. Every window is dark.",
	],
	story: [
		{ id: "S01", from: 1, title: "Drill log, day 212", author: "D. Okafor, drill foreman", lines: ["Warm water at 2.1 km.", "Ice shouldn't be warm. Logging it and drilling on."] },
		{ id: "S02", from: 2, title: "Shipping orders", author: "T. Ferreira, operations chief", lines: ["Cyberdime wants the bore samples shipped sealed. Unopened. Priority freight.", "Since when does an ore company care about water?"] },
		{ id: "S03", from: 3, title: "Medical note", author: "Dr R. Asante, medic", lines: ["Three of the bore crew have a rash that glows under UV light.", "Isolated them in medical. Okafor laughed at me. He has it too."] },
		{ id: "S04", from: 5, title: "Work order 1180", author: "Pell, maintenance", lines: ["Something in the ducts above the refinery. Not rats. We don't have rats.", "The temperature spikes follow it, room to room."] },
		{ id: "S05", from: 7, title: "Evacuation order", author: "M. Kell, security chief", lines: ["The domes won't hold heat. Everyone moves below to the barracks tonight.", "They don't open doors. They wait by them. Close every door behind you. Every one."] },
	],
	crew: [
		{ id: "C-S01", title: "Galley board", author: "Bix, cook", lines: ["Taco night moved to Thursday because SOMEONE used all the hot sauce.", "You know who you are, Pell."] },
		{ id: "C-S02", title: "Pad control", author: "Night shift", lines: ["Supply drop late again. Eleven days of protein bars.", "If Cyberdime reads this: we would also accept coffee."] },
		{ id: "C-S03", title: "Refinery alarm", author: "Automated", lines: ["TEMPERATURE ANOMALY, DUCT 7. TEMPERATURE ANOMALY, DUCT 9.", "TEMPERATURE ANOMALY, DUCT 12. ALARM SILENCED BY USER: PELL."] },
		{ id: "C-S04", title: "Hydroponics", author: "Dr Sun Ji-ho, biologist", lines: ["The tomatoes nearest the vents are growing toward them, not toward the lamps.", "Plants don't do that. I've started a notebook."] },
		{ id: "C-S05", title: "Relay maintenance", author: "Y. Brandt, communications", lines: ["Dish realigned. Earth link is clean again.", "Cyberdime's channel now needs a second key from Vasch. Nobody asked me."] },
		{ id: "C-S06", title: "Vehicle bay", author: "Pell, maintenance", lines: ["Crawler 2 battery froze solid. Crawler 4 battery fine. Crawler 4 parked by the warm duct.", "Note to self: the ducts are never warm."] },
		{ id: "C-S07", title: "Personal", author: "Dr R. Asante, medic", lines: ["Day 230. I can hear them in the walls when the generators stop.", "I tell the patients it's the ice settling. The ice doesn't knock."] },
		{ id: "C-S08", title: "Shift roster", author: "T. Ferreira, operations chief", lines: ["Bore crew doubled per Cyberdime memo 44-B.", "Overtime approved. Questions not approved."] },
		{ id: "C-S09", title: "Purge test", author: "M. Kell, security chief", lines: ["Fire vents in the medical ring work. Test cleared the room in four seconds.", "Remind me never to be standing in a ring when someone tests one."] },
		{ id: "C-S10", title: "Sticky note", author: "Unknown", lines: ["IF THE LIGHTS GO, STAY STILL.", "THEY FIND YOU WHEN YOU MOVE."] },
	],
} satisfies RegionText;

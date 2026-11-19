import type { RegionText } from "../story.ts";

export default {
	beat: [
		"THE BORE. A shaft two kilometres into the ice, and warm air rising out of it.",
		"Whatever happened to Lacuna started down there. The hopper drops into the dark.",
	],
	story: [
		{ id: "S11", from: 15, title: "Field notes, final", author: "Dr Sun Ji-ho, biologist", lines: ["The samples aren't samples. It's one organism, and every canister holds a piece of it.", "The pieces want to be together. So does the crew, now."] },
		{ id: "S12", from: 16, title: "Lift log", author: "D. Okafor, drill foreman", lines: ["Vasch went down the lift with the last canisters.", "Said Halvard is paying triple for whatever lives in that water."] },
		{ id: "S13", from: 18, title: "Medical, last entry", author: "Dr R. Asante, medic", lines: ["They walk to the Bore at night. They don't remember why in the morning.", "Tonight I'm locking myself in. I don't trust myself not to follow."] },
		{ id: "S14", from: 20, title: "Final security log", author: "M. Kell, security chief", lines: ["Sealing the cavern from the inside. Purge vents armed.", "If you're reading this, close the doors on your way out."] },
		{ id: "S15", from: 21, title: "SEALED — recovery contractor orders", author: "L. Vasch, Halvard Mineral Trust", lines: ["Contractor is not to be informed of the biological hazard.", "Priority: recovery of sealed sample canisters. Payment contingent on delivery.", "Do not broadcast."] },
	],
	crew: [
		{ id: "C-B01", title: "Lift controls", author: "Automated", lines: ["LIFT DESCENDING. LIFT DESCENDING. LIFT DESCENDING.", "NO OPERATOR."] },
		{ id: "C-B02", title: "Sample lab A", author: "Dr Sun Ji-ho, biologist", lines: ["Canister 31 is warm to the touch. Canister 32 is warmer.", "Canister 33 has moved two centimetres since this morning."] },
		{ id: "C-B03", title: "Sample lab B", author: "L. Vasch, Halvard liaison", lines: ["Inventory: 61 canisters sealed, 4 breached, 2 unaccounted for.", "Report shows 63 sealed. Halvard prefers round numbers."] },
		{ id: "C-B04", title: "The cage", author: "M. Kell, security chief", lines: ["Built the cage around the drill head. It won't stop them.", "It might slow them while the vents cycle."] },
		{ id: "C-B05", title: "Drill head", author: "D. Okafor, drill foreman", lines: ["Drill stopped at 2,140 m. It didn't break. Something held it.", "I put my hand on the casing. It was beating."] },
		{ id: "C-B06", title: "Cavern survey", author: "Pell, maintenance", lines: ["Water down here is 31 degrees. There's light in it, faint, like the rash.", "It's beautiful, honestly. I wish I hadn't seen it."] },
		{ id: "C-B07", title: "Last letter", author: "Y. Brandt, communications", lines: ["The SOS went out. I don't know if anyone heard.", "If you did: thank you for coming. Now leave."] },
		{ id: "C-B08", title: "Galley board", author: "Bix, cook", lines: ["Took the peaches down with me. Someone should have them.", "Spoon's in the drawer."] },
		{ id: "C-B09", title: "Halvard memo 51", author: "Halvard Mineral Trust", lines: ["Lacuna crew bonuses suspended pending inquiry.", "Contractor tender issued for asset recovery. Lowest bid accepted."] },
		{ id: "C-B10", title: "Unsigned", author: "Unknown", lines: ["it is warm here", "come down"] },
	],
} satisfies RegionText;

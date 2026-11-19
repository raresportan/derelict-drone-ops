import type { IntroText } from "../story.ts";

export default {
	length: 25,
	scenes: [
		{ at: 0, scene: "transmission" },
		{ at: 7, scene: "sos" },
		{ at: 13, scene: "moon" },
		{ at: 21, scene: "descent" },
	],
	lines: [
		{ at: 0.4, text: " INCOMING TRANSMISSION · HALVARD MINERAL TRUST · PRIORITY ", kind: "alarm" },
		{ at: 1.8, text: "CONTRACT 7731-K · SALVAGE AND ASSESSMENT · LACUNA COMPLEX", kind: "head" },
		{ at: 3.2, text: "Forty-one days ago our mining complex on the moon Lacuna stopped transmitting.", kind: "note" },
		{ at: 4.6, text: "Recover company assets. Assess the cause of the communications loss. Payment by tonnage.", kind: "note" },
		{ at: 6.0, text: "The last signal received from the complex follows.", kind: "note" },
		{ at: 7.6, text: "…S… …O… …S… LACUNA COMPLEX … DO NOT … L—ND … DO N—", kind: "warn" },
		{ at: 11.4, text: " ═══ SIGNAL LOST ═══ ", kind: "alarm" },
		{ at: 13.6, text: "LACUNA · ICE MOON OF BRANNOCK · 21 SITES IN THREE REGIONS", kind: "head" },
		{ at: 15.2, text: "  THE SURFACE      domes, refinery, hydroponics, relay array", kind: "ok" },
		{ at: 16.8, text: "  THE UNDERWORKS   tunnels, pump halls, crew barracks", kind: "ok" },
		{ at: 18.4, text: "  THE BORE         a shaft two kilometres into the ice", kind: "ok" },
		{ at: 21.4, text: "Hopper on approach. Three drones in the bay. No answer from the ground.", kind: "head" },
		{ at: 23.4, text: "Press Enter to begin.", kind: "note" },
	],
} satisfies IntroText;

import type { IntroText } from "../story.ts";

export default {
	length: 32,
	scenes: [
		{ at: 0, scene: "transmission" },
		{ at: 8.2, scene: "sos" },
		{ at: 14.2, scene: "cut" },
		{ at: 15, scene: "moon" },
		{ at: 19.8, scene: "section" },
		{ at: 24.4, scene: "descent" },
	],
	cards: [
		{ at: 1.0, until: 7.8, title: "HALVARD MINERAL TRUST", sub: "PRIORITY CONTRACT 7731-K" },
		{ at: 8.8, until: 14.2, title: "LAST SIGNAL", sub: "LACUNA COMPLEX · 41 DAYS AGO" },
		{ at: 15.8, until: 19.6, title: "LACUNA", sub: "ICE MOON OF BRANNOCK" },
		{ at: 20.4, until: 24.2, title: "21 SITES · 3 REGIONS", sub: "EACH ONE DEEPER INTO THE ICE" },
		{ at: 28.6, until: 32, title: "SITE 1", sub: "PERIMETER HAB 3 · THE SURFACE" },
	],
	cues: [
		{ at: 0.2, sound: "hum" },
		{ at: 0.6, sound: "incoming" },
		{ at: 1.3, sound: "incoming" },
		{ at: 8.2, sound: "sos" },
		{ at: 14.2, sound: "static" },
		{ at: 24.6, sound: "rumble" },
		{ at: 28.2, sound: "boom" },
	],
	lines: [
		{ at: 0.6, text: " INCOMING TRANSMISSION · HALVARD MINERAL TRUST · PRIORITY ", kind: "alarm", typed: false },
		{ at: 1.6, text: "CONTRACT 7731-K · SALVAGE AND ASSESSMENT · LACUNA COMPLEX", kind: "head", typed: "slow" },
		{ at: 3.2, text: "Forty-one days ago our mining complex on the moon Lacuna stopped transmitting.", kind: "note", typed: "slow" },
		{ at: 5.2, text: "Recover company assets. Assess the cause of the communications loss.", kind: "note", typed: "slow" },
		{ at: 6.8, text: "Payment by tonnage. The last signal received from the complex follows.", kind: "note", typed: "slow" },
		{ at: 8.8, text: "…S… …O… …S… LACUNA COMPLEX … DO NOT … L—ND … DO N—", kind: "warn", typed: "slow" },
		{ at: 14.2, text: " ═══ SIGNAL LOST ═══ ", kind: "alarm", typed: false },
		{ at: 15.8, text: "LACUNA · ICE MOON OF BRANNOCK · 21 SITES IN THREE REGIONS", kind: "head", typed: "slow" },
		{ at: 17.6, text: "  THE SURFACE      domes, refinery, hydroponics, relay array", kind: "ok", typed: "slow" },
		{ at: 19.4, text: "  THE UNDERWORKS   tunnels, pump halls, crew barracks", kind: "ok", typed: "slow" },
		{ at: 21.0, text: "  THE BORE         a shaft two kilometres into the ice", kind: "ok", typed: "slow" },
		{ at: 25.0, text: "Hopper on approach. Three drones in the bay. No answer from the ground.", kind: "head", typed: "slow" },
		{ at: 29.0, text: "Touchdown. Press Enter to begin.", kind: "note", typed: "slow" },
	],
} satisfies IntroText;

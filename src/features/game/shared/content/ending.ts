import type { EndingText } from "../story.ts";

export default {
	prompt: [
		"The hopper lifts out of the Bore. Brannock fills the sky.",
		"The comms light blinks: HALVARD MINERAL TRUST, PRIORITY.",
		"Type DELIVER to hand over the sample canisters, or BROADCAST to send the crew's logs to every receiver in range.",
	],
	deliver: [
		"Halvard confirms receipt. Payment wired, with a note: 'Discretion appreciated.'",
		"Somewhere under the ice, something warm is awake and waiting for the next shipment. It isn't your problem any more.",
	],
	broadcast: [
		"The crew's voices go out on every band: Okafor, Asante, Sun, Kell, Brandt, even Bix.",
		"Halvard cancels your payment within the hour. Three days later a quarantine notice goes up over Lacuna.",
		"Nobody else will land there by accident.",
	],
	broadcastBlind: [
		"You broadcast what you have. Without Halvard's sealed orders it sounds like a ghost story.",
		"Halvard cancels your payment anyway.",
	],
	after: ["The hopper still has fuel and the ice still has sites. HOP on into the deep sectors, or MENU."],
} satisfies EndingText;

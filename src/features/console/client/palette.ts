import type { LogKind } from "../../game/shared/index.ts";

/** The phosphor colours: the only place a colour is written in code. The page's CSS mirrors them. */
export const C = {
	n: "#FFB000",
	hi: "#FFD27A",
	mid: "#C88A08",
	dim: "#6A4500",
	hot: "#FF6A00",
	tube: "#0A0600",
} as const;

/** `C` with an alpha, for glows and fills. */
export function alpha(colour: string, a: number): string {
	const v = Number.parseInt(colour.slice(1), 16);
	return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

/** The CSS intensity class each kind of terminal line is shown in. */
export const LINE_CLASS: Record<LogKind, string> = {
	echo: "a-b",
	note: "a-m",
	ok: "a-n",
	warn: "a-h",
	alarm: "a-H",
	drone: "a-n",
	head: "a-b",
	loot: "a-b",
};

/** A feed pixel's colour for brightness `v`, as RGB. */
export const phosphor = (v: number): readonly [number, number, number] => [v, v * 0.66, v * 0.08];
export const HOT_PIXEL: readonly [number, number, number] = [255, 90, 0];

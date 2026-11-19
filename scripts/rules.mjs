#!/usr/bin/env node
// The game's fence: where code runs decides what it imports; only the save file's store touches files; colours come
// from the palette; the game's rules keep their own clock; no floating promises, lasting resources in passing, or
// comments in place of fixes; checks that can fail.
import { resolve } from "node:path";
import ts from "typescript";
import { importBoundaries } from "@raresportan/marram/core/boundaries";
import { lintChecks } from "@raresportan/marram/core/check-lint";
import { comments } from "@raresportan/marram/core/no-comments";
import { finish, lineOf, restrict } from "@raresportan/marram/core/ratchet";
import { lintJourneys } from "@raresportan/marram/electron/journey-lint";
import { FIX, lintPromises } from "@raresportan/marram/node/promise-lint";
import { acquisitions } from "@raresportan/marram/node/resource-lint";

const root = resolve(import.meta.dirname, "..");
const list = "scripts/rules.mjs";

/** Where a file imports what reads or writes files. */
function fileAccess(source) {
	return source.statements.flatMap((statement) =>
		ts.isImportDeclaration(statement) && /^(node:)?fs(\/promises)?$/.test(statement.moduleSpecifier.text) ? [{ line: lineOf(source, statement), what: `imports ${statement.moduleSpecifier.text}` }] : [],
	);
}

/** Where a file writes a colour of its own (`#FFB000`), rather than taking one from the palette. */
function colours(source) {
	const found = [];
	const visit = (node) => {
		if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && /#[0-9a-f]{3}(?:[0-9a-f]{3})?\b|rgba?\(/i.test(node.text)) {
			found.push({ line: lineOf(source, node), what: `writes the colour "${node.text.slice(0, 24)}"` });
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return found;
}

/** Where shared game code reads the wall clock or schedules work, instead of running on the game's own `tick`. */
function clocks(source) {
	const found = [];
	const visit = (node) => {
		if (ts.isCallExpression(node)) {
			const callee = node.expression.getText(source);
			if (/^(setTimeout|setInterval|requestAnimationFrame|queueMicrotask|Date\.now|performance\.now)$/.test(callee)) found.push({ line: lineOf(source, node), what: `calls ${callee}` });
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return found;
}

const problems = [
	...importBoundaries({
		root,
		folder: "src",
		layers: {
			"features/*/shared": { may: [] },
			"features/*/host": { may: ["features/*/shared"], builtins: true },
			"features/*/client": { may: ["features/*/shared"] },
			main: { may: ["features/*/host", "features/*/shared"], builtins: true },
			preload: { may: ["features/*/shared"], builtins: true },
			renderer: { may: ["features/*/client", "features/*/shared"] },
		},
		list,
	}),
	...restrict({ root, folder: "src", owners: ["features/game/host/store.ts"], find: fileAccess, allowed: {}, list, fix: "go through the save file's store", stale: "no longer touches files" }),
	...restrict({
		root,
		folder: "src",
		owners: ["features/console/client/palette.ts"],
		find: colours,
		allowed: { "main/index.ts": "the window's background before the page paints, which no renderer palette can reach" },
		list,
		fix: "take it from C (or alpha) in features/console/client/palette.ts",
		stale: "no longer writes a colour",
	}),
	...restrict({ root, folder: "src/features/game/shared", find: clocks, allowed: {}, list, fix: "count time in Game.tick (see #after) so tests and pauses control it", stale: "no longer reads the clock" }),
	...restrict({ root, folder: "src", find: acquisitions, allowed: {}, list, fix: "start it through the module that owns it", stale: "no longer starts lasting resources" }),
	...restrict({ root, folder: "src", find: comments, allowed: {}, list, fix: "say it in the code, or link the outside constraint", stale: "has no comments any more" }),
	...lintPromises({ root, projects: [{ config: "tsconfig.json", folder: "src" }] }).problems.map((problem) => `${problem}: ${FIX}`),
	...lintChecks({ root, folder: "scripts", match: /\.test\.ts$/ }).problems,
	...lintJourneys({ root, folder: "scripts/verify", tsconfig: "tsconfig.json" }).problems,
];
finish("rules", problems, "the imports, the save file, colours, clocks, resources, comments, promises and checks are all in order");

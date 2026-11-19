# Mistake classes

The kinds of mistake this project has made or is built to stop, and the rungs that guard each one. A commit that fixes
review findings names each finding's class and rung (`Class: layout. Rung: journey (boots fails without it)`).

| Class | What goes wrong | Rungs that guard it |
|---|---|---|
| **layout**: the screen measured wrong | The map canvas is sized while the tube's warm-up squashes it, and stays a few pixels tall (it happened twice) | architecture: `Screens.resize` reads layout size, not the transformed box; journey: `boots` ("The map fills its window") |
| **style**: the look drifts from the amber CRT | A new screen or panel brings its own colours | lint: `rules` (colours only in `console/client/palette.ts`); review against the 039 style |
| **side**: code on the wrong side | The renderer imports what only the main process can run, or game rules reach into the UI | lint: `rules` (`importBoundaries`) |
| **clock**: game rules on the wall clock | A transition scheduled with `setTimeout` runs out of order with what the player typed (the briefing printed after later lines) | architecture: `Game.tick` and `#after`; lint: `rules` (no timers in `game/shared`); unit: `game.test.ts` |
| **save**: a campaign lost or damaged | A write cut short, two at once, or a damaged file stopping the app | architecture: one store, `SaveFile`, writing whole files in order; unit: `save.test.ts`; journey: `campaign` |
| **promise**: a failure nobody hears | A save or link opened without handling its rejection | lint: `rules` (`lintPromises`) |
| **rule**: the game breaks its own rules | A drone walks through a closed door, a purchase costs the wrong amount, a ship with a room nobody can reach | unit: `game.test.ts`, `world.test.ts` |
| **comment**: an explanation instead of a fix | A comment explains a workaround, and agents copy it | lint: `rules` (`no-comments`) |

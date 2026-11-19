# Mistake classes

The kinds of mistake this project has made or is built to stop, and the rungs that guard each one. A commit that fixes
review findings names each finding's class and rung (`Class: layout. Rung: journey (boots fails without it)`).

| Class | What goes wrong | Rungs that guard it |
|---|---|---|
| **layout**: the screen measured wrong | The map canvas is sized while the tube's warm-up squashes it, and stays a few pixels tall (it happened twice) | architecture: `Screens.resize` reads layout size, not the transformed box; journey: `boots` ("The map fills its window"); journey: `keys` (key cells keep their shape, after the port turned each number cell as wide as its label) |
| **style**: the look drifts from the amber CRT | A new screen or panel brings its own colours | lint: `rules` (colours only in `console/client/palette.ts`); review against the 039 style |
| **side**: code on the wrong side | The renderer imports what only the main process can run, or game rules reach into the UI | lint: `rules` (`importBoundaries`) |
| **clock**: game rules on the wall clock | A transition scheduled with `setTimeout` runs out of order with what the player typed (the briefing printed after later lines) | architecture: `Game.tick` and `#after`; lint: `rules` (no timers in `game/shared`); unit: `game.test.ts` |
| **save**: a campaign lost or damaged | A write cut short, two at once, or a damaged file stopping the app | architecture: one store, `SaveFile`, writing whole files in order; unit: `save.test.ts`; journeys: `campaign`, `damaged-save` (bridge) and `browser` (local storage) |
| **promise**: a failure nobody hears | A save or link opened without handling its rejection | lint: `rules` (`lintPromises`) |
| **rule**: the game breaks its own rules | A drone walks through a closed door, a purchase costs the wrong amount, a ship with a room nobody can reach | unit: `game.test.ts`, `world.test.ts` |
| **wait**: a check that passes too early | A check that something is *absent* runs before the screen finishes printing, so it passes whatever happens (it happened: `damaged-save` first missed an unvalidated save) | journeys wait for the menu's last line before a negative check; review |
| **echo**: a check that believes the app's own report | A check reads the message the app prints about an effect instead of the effect itself, so it passes when the message lies (it happened: `fight` passed a purge that killed nothing, because the kill count is printed either way) | journeys confirm effects independently (`fight` sends WREN into the purged lair); review |
| **weight**: content loaded before it's needed | Story text imported statically lands in the main script and loads at start, for every player, every time | architecture: `story.ts` loads regions, the intro and the ending with `import()`, and `Game` keeps only the current and next region; journey: `browser` (nothing at the menu, nothing in the main script, nothing deeper than the Surface on site 1); unit: `game.test.ts` |
| **comment**: an explanation instead of a fix | A comment explains a workaround, and agents copy it | lint: `rules` (`no-comments`) |

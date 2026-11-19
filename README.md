# Derelict Drone Ops

A salvage game on an amber CRT terminal. Your tug tethers to one derelict ship after another, and you steer three drones through each one by typing commands.

**Play in your browser:** https://raresportan.github.io/derelict-drone-ops/

## Run

```bash
npm install
npm start
```

`npm start` builds the game and opens it in a normal 1280×800 window. `npm run play` opens it full screen. View → Toggle Full Screen switches between the two at any time.

## Play

- **Tutorial (1)**: a guided boarding on a small training hulk.
- **Campaign (2)**: board derelicts one after another. Every jump burns one fuel cell. Bring scrap and fuel cells back into the dock, then `undock`. Between jumps, the drydock lets you `repair`, `rebuild`, `upgrade <drone> armour|thrust|mk2`, `buy fuel`, and `jump`. Each ship is bigger and more dangerous than the last. The run ends when you have no fuel and no drones left, and no scrap to buy more.
- Progress saves automatically at the drydock. **Continue (3)** resumes from there. In the app, saves go to a file in your user data folder; in the browser, to local storage.

Mission commands: `nav 1 2 r5`, `open d3`, `close d3`, `gather 2`, `motion`, `lure 3`, `purge r7`, `stop all`, `status`, `undock`, `help`. F1–F9 run the commands shown in the key row. Tab completes words, `;` chains commands, and `'` toggles map labels.

## Develop

The project uses [Marram](https://github.com/raresportan/marram): one gate decides when work is done.

| Command | Runs | When |
|---|---|---|
| `npm run gate:fast` | typecheck, rules | after each edit |
| `npm run gate` | + unit tests, feature map | before calling a task done |
| `npm run gate:full` | + build, journeys on the Electron app | before a push (the pre-push hook requires it) |

- **Code layout:** each feature lives in `src/features/<name>/`, split into `shared/` (pure TypeScript), `host/` (Electron's main process) and `client/` (the renderer). `scripts/rules.mjs` enforces which may import which.
  - `game/shared` holds the rules: ship generation, the simulation, commands, campaign and tutorial. It has no DOM and no timers; it runs on `Game.tick`.
  - `game/host` holds the save file, the only code that touches files.
  - `console/client` draws the terminal, map and panels, and holds the only place colours are written (`palette.ts`).
- **Rules** (`npm run rules`): import boundaries, one save store, colours only from the palette, no wall clock in the game rules, no floating promises, and no comments in place of fixes.
- **Tests and journeys:** unit tests are `scripts/*.test.ts`. Journeys in `scripts/verify/` drive the built app windowed and in the background.
- **Docs:** `docs/feature-map.md` lists what each feature does and what verifies it; `docs/mistake-classes.md` lists the kinds of mistake the rungs guard. A commit that fixes review findings names each finding's class and rung.
- **Hooks:** `npm install` points git at `.githooks/`. Claude Code's hooks in `.claude/settings.json` send a turn back while the gate is red.
- **Deploy:** pushes to `main` build the renderer and publish it to GitHub Pages.

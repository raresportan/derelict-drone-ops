# Derelict Drone Ops

A salvage game on an amber CRT terminal. Forty-one days ago Cyberdime Mining Co.'s complex on Lacuna, an ice moon, went silent after a garbled SOS. You're the contractor sent to recover company assets and find out why: a hopper, three drones, and a command line.

**Play in your browser:** https://raresportan.github.io/derelict-drone-ops/

## Run

```bash
npm install
npm start
```

`npm start` builds the game and opens it in a normal 1280×800 window. `npm run play` opens it full screen. View → Toggle Full Screen switches between the two at any time.

## Play

- **Tutorial (1)**: a guided boarding on a small training hulk.
- **Campaign (2)**: 21 sites across three regions: the Surface, the Underworks and the Bore. A first campaign opens with Cyberdime's transmission (Enter skips it; **Intro (5)** replays it). Every hop between sites burns one fuel cell. Bring scrap and fuel cells back into the dock, then `undock`. Between hops, the drydock lets you `repair`, `rebuild`, `upgrade <drone> armour|thrust|mk2`, `buy fuel`, and `hop`. Each site is bigger and more dangerous than the last. The run ends when you have no fuel and no drones left, and no scrap to buy more.
- **The story**: powered terminals hold the crew's logs. `read` one with a drone beside it: 15 story logs turn up in order as you go deeper, and 30 crew logs are shuffled across the sites. Every log you read goes into the **Archive (4)**, which outlasts losing a run. Lifting off from site 21, the Bore floor, ends the story with a choice; after that the run goes on into the deep sectors.
- Progress saves automatically at the drydock. **Continue (3)** resumes from there. In the app, saves go to a file in your user data folder; in the browser, to local storage.

Mission commands: `nav 1 2 r5`, `open d3`, `close d3`, `gather 2`, `read 2`, `motion`, `lure 3`, `purge r7`, `stop all`, `status`, `undock`, `help`. F1–F9 run the commands shown in the key row. Tab completes words, `;` chains commands, and `'` toggles map labels.

## Develop

The project uses [Marram](https://github.com/raresportan/marram): one gate decides when work is done.

| Command | Runs | When |
|---|---|---|
| `npm run gate:fast` | typecheck, rules | after each edit |
| `npm run gate` | + unit tests, feature map | before calling a task done |
| `npm run gate:full` | + build, journeys on the Electron app | before a push (the pre-push hook requires it) |

- **Code layout:** each feature lives in `src/features/<name>/`, split into `shared/` (pure TypeScript), `host/` (Electron's main process) and `client/` (the renderer). `scripts/rules.mjs` enforces which may import which.
  - `game/shared` holds the rules: site generation, the simulation, commands, campaign, tutorial and story. It has no DOM and no timers; it runs on `Game.tick`. The story's words live in `game/shared/content/`, loaded with `import()` only when needed.
  - `game/host` holds the save file, the only code that touches files.
  - `console/client` draws the terminal, map and panels, and holds the only place colours are written (`palette.ts`).
- **Rules** (`npm run rules`): import boundaries, one save store, colours only from the palette, no wall clock in the game rules, no floating promises, and no comments in place of fixes.
- **Tests and journeys:** unit tests are `scripts/*.test.ts`. Journeys in `scripts/verify/` drive the built app windowed and in the background.
- **Docs:** `docs/feature-map.md` lists what each feature does and what verifies it; `docs/mistake-classes.md` lists the kinds of mistake the rungs guard. A commit that fixes review findings names each finding's class and rung.
- **Hooks:** `npm install` points git at `.githooks/`. Claude Code's hooks in `.claude/settings.json` send a turn back while the gate is red.
- **Deploy:** pushes to `main` build the renderer and publish it to GitHub Pages.

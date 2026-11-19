# Derelict Drone Ops

A salvage game on an amber CRT terminal. Your tug tethers to one derelict ship after another, and you steer three drones through each one by typing commands.

**Play in your browser:** https://raresportan.github.io/derelict-drone-ops/

## Run

```bash
npm install
npm start
```

`npm start` opens a normal 1280×800 window. `npm run play` opens it full screen. View → Toggle Full Screen switches between the two at any time. The game is a single file, `src/index.html`, which also runs in any browser.

## Play

- **Tutorial (1)**: a guided boarding on a small training hulk.
- **Campaign (2)**: board derelicts one after another. Every jump burns one fuel cell. Bring scrap and fuel cells back into the dock, then `undock`. Between jumps, the drydock lets you `repair`, `rebuild`, `upgrade <drone> armour|thrust|mk2`, `buy fuel`, and `jump`. Each ship is bigger and more dangerous than the last. The run ends when you have no fuel and no drones left, and no scrap to buy more.
- Progress saves automatically at the drydock. **Continue (3)** resumes from there.

Mission commands: `nav 1 2 r5`, `open d3`, `close d3`, `gather 2`, `motion`, `lure 3`, `purge r7`, `stop all`, `status`, `undock`, `help`. F1–F9 run the commands shown in the key row. Tab completes words, `;` chains commands, and `'` toggles map labels.

# Derelict Drone Ops feature map

Everything the game does, how a player reaches it, and what verifies it.

- **Title menu.** The app opens on the title screen, offering the tutorial and a new campaign, and a continue option once there's a save.
  - ✅ boots › "The title menu offers the tutorial and a new campaign"
  - ✅ campaign › "After a restart the menu offers to continue from jump 1"
- **A screen that fits.** The schematic fills its window once the tube has warmed up, and every control can be clicked where it's drawn.
  - ✅ boots › "The map fills its window, measured after the warm-up"
  - ✅ boots › "Every control can be clicked where it's drawn"
- **Tutorial.** Type 1; a highlighted line gives one order at a time, and each step moves on once it's done. Undocking ends it and marks it done on the menu.
  - ✅ tutorial › "The tutorial starts at its first step"
  - ✅ tutorial › "Doing step ${step} moves on to step ${step + 1}"
  - ✅ tutorial › "All three drones come home"
  - ✅ tutorial › "Undocking ends the tutorial and returns to the menu, marked done"
- **Boarding a derelict.** Type 2; the tug tethers to a generated ship. Drones move with `nav` through open doors, survey rooms, gather salvage and fuel, and bank it in the dock.
  - ✅ campaign › "A new campaign boards the first derelict"
  - ❌ moving, gathering and banking are covered by unit tests (game.test.ts) and the tutorial journey, not by a campaign journey on a generated ship.
- **Lifeforms and hazards.** Lifeforms hunt drones through open doors, closed doors stop them, purge valves kill them, radiation wears hulls down.
  - ❌ unit tests only (game.test.ts: doors, purge, a lost fleet); no journey plays a fight.
- **Drydock and jumps.** Undocking reaches the drydock, where scrap buys repairs, rebuilds, upgrades and fuel; JUMP boards the next, harder derelict.
  - ✅ campaign › "Undocking reaches the drydock"
  - ✅ campaign › "Jumping boards the second derelict"
  - ❌ prices and refusals are covered by unit tests (game.test.ts), not by a journey.
- **Saves.** The campaign saves at the drydock and survives a restart; a damaged save file is ignored rather than stopping the app.
  - ✅ campaign › "Continuing restores the drydock"
  - ❌ a damaged file is covered by save.test.ts only; no journey starts the app on one.
- **Function keys.** F1–F9 and the key row run the commands shown for the current screen.
  - ✅ keys › "The function keys follow the screen"
  - ✅ keys › "F3 runs the motion scanner"
  - ✅ keys › "The LABELS key answers a click"
- **Playable in a browser.** The same page runs on GitHub Pages, keeping saves in local storage.
  - ❌ not verified by a journey; the deploy is checked by hand.

import { mountConsole } from "../features/console/client/index.ts";
import { openSaves } from "../features/game/client/index.ts";

mountConsole(document, await openSaves());

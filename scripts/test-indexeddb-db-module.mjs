import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const dbJs = readFileSync(join(rootDir, "db.js"), "utf8");

const result = JSON.parse(await runInNewContext(`
  (async () => {
    const window = { console };
    ${dbJs}
    await window.ScorebookDB.saveGame({
      id: "game-1",
      opponent: "Indexed Test",
      events: [
        { id: "event-1", gameId: "game-1", result: "1B" }
      ]
    });
    await window.ScorebookDB.addGameEvent("game-1", { id: "event-2", result: "SB" });
    const events = await window.ScorebookDB.getGameEvents("game-1");
    const game = await window.ScorebookDB.getGame("game-1");
    await window.ScorebookDB.saveLibrary({
      activeGameId: "game-1",
      gameOrder: ["game-1"],
      gamesById: { "game-1": game }
    });
    const library = await window.ScorebookDB.loadLibrary();
    return JSON.stringify({
      driver: window.ScorebookDB.driver,
      eventResults: events.map((event) => event.result),
      gameEventCount: game.events.length,
      activeGameId: library.activeGameId,
      libraryGameCount: library.gameOrder.length
    });
  })()
`, { console, Promise }));

assert.equal(result.driver, "memory", "db.js should fall back safely when IndexedDB is unavailable");
assert.deepEqual(result.eventResults, ["1B", "SB"], "db.js should append and read scoring events");
assert.equal(result.gameEventCount, 2, "getGame should compose events with the saved game");
assert.equal(result.activeGameId, "game-1", "saveLibrary/loadLibrary should preserve activeGameId");
assert.equal(result.libraryGameCount, 1, "saveLibrary/loadLibrary should preserve games");

console.log("IndexedDB db.js helper checks passed.");

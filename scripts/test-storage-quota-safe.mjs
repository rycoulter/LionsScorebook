import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const storageJs = readFileSync(join(rootDir, "storage.js"), "utf8");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

const result = JSON.parse(runInNewContext(`
  const backing = new Map();
  const window = {
    console,
    localStorage: {
      getItem(key) {
        return backing.has(key) ? backing.get(key) : null;
      },
      setItem(key, value) {
        const next = new Map(backing);
        next.set(key, String(value));
        const total = [...next.values()].reduce((sum, item) => sum + item.length, 0);
        if (total > 180000) {
          const error = new Error("quota exceeded");
          error.name = "QuotaExceededError";
          throw error;
        }
        backing.set(key, String(value));
      },
      removeItem(key) {
        backing.delete(key);
      }
    }
  };

  ${storageJs}

  const largeText = "x".repeat(12000);
  const game = {
    id: "game-1",
    opponent: "Storage Test",
    status: "active",
    events: Array.from({ length: 12 }, (_, index) => ({ id: "event-" + index, result: "1B", note: largeText })),
    playHistory: Array.from({ length: 20 }, (_, index) => ({
      id: "hist-" + index,
      game: { id: "game-1", events: [{ id: "snap-" + index, note: largeText }], playHistory: [{ id: "nested" }] },
      pending: { scoringStep: "pitch" }
    }))
  };
  const state = {
    roster: [{ id: "p1", name: "Player" }],
    lineup: ["p1"],
    activeGameId: "game-1",
    games: [game]
  };

  window.ScorebookStorage.saveAppState(state);
  const appState = JSON.parse(window.localStorage.getItem("oakmont-lions-scorebook-v1"));
  window.ScorebookStorage.saveLibrary(window.ScorebookStorage.buildLibraryFromGames(state.games, state.activeGameId));
  const library = JSON.parse(window.localStorage.getItem("oakmont-lions-game-library-v1"));
  const savedGame = library.gamesById["game-1"];

  JSON.stringify({
    appGamesLength: appState.games.length,
    savedHistoryLength: savedGame.playHistory.length,
    nestedHistoryLength: savedGame.playHistory[0].game.playHistory.length,
    totalBytes: [...backing.values()].reduce((sum, item) => sum + item.length, 0)
  });
`, { console }));

assert.equal(result.appGamesLength, 0, "app state storage should not duplicate full games");
assert.ok(result.savedHistoryLength <= 8, "stored play history should be capped");
assert.equal(result.nestedHistoryLength, 0, "stored play history snapshots should not nest old play history");
assert.ok(result.totalBytes < 180000, "compacted storage should fit inside the simulated quota");

assert.match(functionBody(appJs, "saveState"), /storage\.saveAppState\(state\)[\s\S]*storage\.saveLibrary\(library\)/, "saveState should free the compact app-state key before writing the game library");
assert.match(functionBody(appJs, "saveState"), /catch \(error\) \{[\s\S]*handleLocalStorageSaveError\(error\)/, "saveState should not let localStorage quota errors abort rendering");
assert.match(functionBody(appJs, "handleLocalStorageSaveError"), /continuing with in-memory scoring state/, "storage failures should be logged as non-fatal scoring issues");
assert.match(appJs, /const PLAY_HISTORY_LIMIT = 8;/, "Undo Play history should be capped to a storage-safe number of snapshots");

console.log("Storage quota safety checks passed.");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const storageJs = readFileSync(join(rootDir, "storage.js"), "utf8");
const dbJs = readFileSync(join(rootDir, "db.js"), "utf8");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const serviceWorkerJs = readFileSync(join(rootDir, "service-worker.js"), "utf8");

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

const result = JSON.parse(await runInNewContext(`
  (async () => {
    const backing = new Map();
    const persisted = {
      appState: null,
      library: null,
      games: new Map()
    };
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
      },
      ScorebookDB: {
        ready: Promise.resolve(),
        loadAppState: async () => null,
        loadLibrary: async () => ({ activeGameId: "", gameOrder: [], gamesById: {} }),
        saveAppState: async (state) => {
          persisted.appState = JSON.parse(JSON.stringify(state));
        },
        saveLibrary: async (library) => {
          persisted.library = JSON.parse(JSON.stringify(library));
        },
        saveGame: async (game) => {
          persisted.games.set(game.id, JSON.parse(JSON.stringify(game)));
        },
        deleteGame: async (gameId) => {
          persisted.games.delete(gameId);
        },
        addGameEvent: async () => {},
        getGameEvents: async () => []
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
    window.ScorebookStorage.saveLibrary(window.ScorebookStorage.buildLibraryFromGames(state.games, state.activeGameId));
    await window.ScorebookStorage.flush();

    const metadata = JSON.parse(window.localStorage.getItem("oakmont-lions-scorebook-meta-v1"));

    return JSON.stringify({
      legacyAppStateExists: window.localStorage.getItem("oakmont-lions-scorebook-v1") !== null,
      legacyLibraryExists: window.localStorage.getItem("oakmont-lions-game-library-v1") !== null,
      metadata,
      persistedAppGamesLength: persisted.appState.games.length,
      persistedGameCount: persisted.library.gameOrder.length,
      persistedEventCount: persisted.library.gamesById["game-1"].events.length,
      persistedHistoryLength: persisted.library.gamesById["game-1"].playHistory.length,
      totalLocalStorageBytes: [...backing.values()].reduce((sum, item) => sum + item.length, 0)
    });
  })()
`, { console, Promise }));

assert.equal(result.legacyAppStateExists, false, "full app state should not be written to legacy localStorage");
assert.equal(result.legacyLibraryExists, false, "full game library should not be written to legacy localStorage");
assert.equal(result.metadata.currentGameId, "game-1", "localStorage should keep only tiny current-game metadata");
assert.equal(result.persistedAppGamesLength, 0, "IndexedDB app-state metadata should not duplicate full games");
assert.equal(result.persistedGameCount, 1, "game library should persist through the IndexedDB helper");
assert.equal(result.persistedEventCount, 12, "scoring events should be preserved for IndexedDB storage");
assert.equal(result.persistedHistoryLength, 20, "IndexedDB storage should not need localStorage play-history truncation");
assert.ok(result.totalLocalStorageBytes < 1000, "localStorage should stay tiny after saving a large game");

assert.match(dbJs, /addGameEvent:\s*\(gameId, event\)/, "db.js should expose addGameEvent(gameId, event)");
assert.match(dbJs, /getGameEvents:\s*\(gameId\)/, "db.js should expose getGameEvents(gameId)");
assert.match(dbJs, /saveGame:\s*\(game\)/, "db.js should expose saveGame(game)");
assert.match(dbJs, /getGame:\s*\(gameId\)/, "db.js should expose getGame(gameId)");
assert.match(indexHtml, /dexie\.min\.js\?v=\d{4}\.\d{2}\.\d{2}-build-\d+[\s\S]*db\.js\?v=\d{4}\.\d{2}\.\d{2}-build-\d+[\s\S]*storage\.js\?v=\d{4}\.\d{2}\.\d{2}-build-\d+/, "Dexie, db.js, and storage.js should load in order");
assert.match(serviceWorkerJs, /"\.\/dexie\.min\.js"[\s\S]*"\.\/db\.js"[\s\S]*"\.\/storage\.js"/, "Dexie and db.js should be cached by the service worker");
assert.match(appJs, /let state = seedState\(\);/, "app should start with seed state until storage is ready");
assert.match(appJs, /if \(storage\.ready\) await storage\.ready;/, "app boot should wait for IndexedDB hydration before loading state");
assert.match(functionBody(appJs, "saveState"), /storage\.saveAppState\(state\)[\s\S]*storage\.saveLibrary\(library\)/, "saveState should keep using the storage wrapper compatibility API");
assert.match(functionBody(appJs, "handleLocalStorageSaveError"), /continuing with in-memory scoring state/, "storage failures should be logged as non-fatal scoring issues");
assert.match(appJs, /const PLAY_HISTORY_LIMIT = 8;/, "Undo Play history should remain capped in live game memory");

console.log("IndexedDB storage safety checks passed.");

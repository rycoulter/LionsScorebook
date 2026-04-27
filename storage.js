(function initScorebookStorage(global) {
  const LEGACY_STORAGE_KEY = "oakmont-lions-scorebook-v1";
  const LEGACY_GAME_LIBRARY_KEY = "oakmont-lions-game-library-v1";
  const METADATA_KEY = "oakmont-lions-scorebook-meta-v1";
  const db = global.ScorebookDB || null;

  let appStateCache = null;
  let libraryCache = emptyLibrary();
  let persistenceQueue = Promise.resolve();
  let indexedDbWarningShown = false;

  function deepClone(value) {
    if (value === undefined || value === null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function emptyLibrary() {
    return {
      activeGameId: "",
      gameOrder: [],
      gamesById: {}
    };
  }

  function normalizeLibrary(library) {
    const normalized = emptyLibrary();
    if (!library || typeof library !== "object") return normalized;
    const gamesById = library.gamesById && typeof library.gamesById === "object" ? library.gamesById : {};
    const explicitOrder = Array.isArray(library.gameOrder) ? library.gameOrder : [];

    explicitOrder.forEach((gameId) => {
      const game = gamesById[gameId];
      if (!game?.id) return;
      normalized.gamesById[game.id] = deepClone(game);
      if (!normalized.gameOrder.includes(game.id)) normalized.gameOrder.push(game.id);
    });

    Object.values(gamesById).forEach((game) => {
      if (!game?.id) return;
      normalized.gamesById[game.id] = deepClone(game);
      if (!normalized.gameOrder.includes(game.id)) normalized.gameOrder.push(game.id);
    });

    normalized.activeGameId = library.activeGameId && normalized.gamesById[library.activeGameId]
      ? library.activeGameId
      : "";
    return normalized;
  }

  function buildLibraryFromGames(games = [], activeGameId = "") {
    const library = emptyLibrary();
    games.forEach((game) => {
      if (!game?.id) return;
      library.gamesById[game.id] = deepClone(game);
      if (!library.gameOrder.includes(game.id)) library.gameOrder.push(game.id);
    });
    library.activeGameId = activeGameId && library.gamesById[activeGameId] ? activeGameId : "";
    return library;
  }

  function appStateForStorage(state) {
    const next = deepClone(state || {});
    next.games = [];
    return next;
  }

  function readJsonItem(key) {
    try {
      const raw = global.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn(`Unable to read ${key} from localStorage.`, error);
      return null;
    }
  }

  function writeMetadata(metadata) {
    try {
      const next = {
        currentGameId: metadata?.currentGameId || "",
        activeGameId: metadata?.activeGameId || metadata?.currentGameId || "",
        updatedAt: new Date().toISOString()
      };
      global.localStorage?.setItem(METADATA_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn("Unable to save scorebook metadata to localStorage.", error);
    }
  }

  function readMetadata() {
    return readJsonItem(METADATA_KEY) || {};
  }

  function removeLegacyLocalStorageCopies() {
    try {
      global.localStorage?.removeItem(LEGACY_STORAGE_KEY);
      global.localStorage?.removeItem(LEGACY_GAME_LIBRARY_KEY);
    } catch (error) {
      console.warn("Unable to remove legacy localStorage scorebook copies.", error);
    }
  }

  function warnIndexedDbFailure(action, error) {
    console.warn(`Unable to ${action} in IndexedDB; continuing with in-memory scorebook state.`, error);
    indexedDbWarningShown = true;
  }

  function queueIndexedDbWrite(action, writer) {
    if (!db) return persistenceQueue;
    persistenceQueue = persistenceQueue
      .catch(() => undefined)
      .then(() => writer())
      .catch((error) => {
        warnIndexedDbFailure(action, error);
      });
    return persistenceQueue;
  }

  function loadLegacyState() {
    const legacyAppState = readJsonItem(LEGACY_STORAGE_KEY);
    const legacyLibrary = readJsonItem(LEGACY_GAME_LIBRARY_KEY);

    if (legacyAppState) {
      appStateCache = appStateForStorage(legacyAppState);
    }

    if (legacyLibrary) {
      libraryCache = normalizeLibrary(legacyLibrary);
    } else if (Array.isArray(legacyAppState?.games)) {
      libraryCache = buildLibraryFromGames(legacyAppState.games, legacyAppState.activeGameId);
    }

    const metadata = readMetadata();
    if (!libraryCache.activeGameId && metadata.currentGameId && libraryCache.gamesById[metadata.currentGameId]) {
      libraryCache.activeGameId = metadata.currentGameId;
    }
  }

  async function hydrateFromIndexedDb() {
    if (!db) return;
    try {
      await db.ready;
      const [dbAppState, dbLibrary] = await Promise.all([
        db.loadAppState(),
        db.loadLibrary()
      ]);
      if (dbAppState) appStateCache = appStateForStorage(dbAppState);
      const normalizedDbLibrary = normalizeLibrary(dbLibrary);
      if (normalizedDbLibrary.gameOrder.length) {
        libraryCache = normalizedDbLibrary;
      } else if (libraryCache.gameOrder.length) {
        await db.saveLibrary(libraryCache);
      }
      if (appStateCache) await db.saveAppState(appStateCache);
      if (libraryCache.activeGameId) {
        writeMetadata({ currentGameId: libraryCache.activeGameId });
      }
      if (appStateCache || libraryCache.gameOrder.length) {
        removeLegacyLocalStorageCopies();
      }
    } catch (error) {
      warnIndexedDbFailure("load scorebook data", error);
    }
  }

  loadLegacyState();
  const ready = hydrateFromIndexedDb();

  function loadAppState() {
    return appStateCache ? deepClone(appStateCache) : null;
  }

  function saveAppState(state) {
    appStateCache = appStateForStorage(state);
    const activeGameId = state?.activeGameId || libraryCache.activeGameId || "";
    writeMetadata({ currentGameId: activeGameId });
    queueIndexedDbWrite("save app state", () => db.saveAppState(appStateCache));
    return deepClone(state);
  }

  function loadLibrary() {
    return normalizeLibrary(libraryCache);
  }

  function saveLibrary(library) {
    libraryCache = normalizeLibrary(library);
    writeMetadata({ currentGameId: libraryCache.activeGameId });
    queueIndexedDbWrite("save game library", () => db.saveLibrary(libraryCache));
    return normalizeLibrary(libraryCache);
  }

  function saveGame(game, setActive = true) {
    if (!game?.id) return loadLibrary();
    libraryCache.gamesById[game.id] = deepClone(game);
    if (!libraryCache.gameOrder.includes(game.id)) libraryCache.gameOrder.push(game.id);
    if (setActive) libraryCache.activeGameId = game.id;
    writeMetadata({ currentGameId: libraryCache.activeGameId });
    queueIndexedDbWrite("save game", async () => {
      await db.saveGame(game);
      await db.saveLibrary(libraryCache);
    });
    return loadLibrary();
  }

  function loadGameById(gameId) {
    return libraryCache.gamesById[gameId] ? deepClone(libraryCache.gamesById[gameId]) : null;
  }

  function getActiveGame() {
    return libraryCache.activeGameId ? loadGameById(libraryCache.activeGameId) : null;
  }

  function setActiveGame(gameId) {
    if (!libraryCache.gamesById[gameId]) return null;
    libraryCache.activeGameId = gameId;
    writeMetadata({ currentGameId: gameId });
    queueIndexedDbWrite("set active game", () => db.saveLibrary(libraryCache));
    return deepClone(libraryCache.gamesById[gameId]);
  }

  function listGames() {
    return libraryCache.gameOrder.map((gameId) => deepClone(libraryCache.gamesById[gameId])).filter(Boolean);
  }

  function deleteGame(gameId) {
    if (!libraryCache.gamesById[gameId]) return loadLibrary();
    delete libraryCache.gamesById[gameId];
    libraryCache.gameOrder = libraryCache.gameOrder.filter((id) => id !== gameId);
    if (libraryCache.activeGameId === gameId) libraryCache.activeGameId = "";
    writeMetadata({ currentGameId: libraryCache.activeGameId });
    queueIndexedDbWrite("delete game", async () => {
      await db.deleteGame(gameId);
      await db.saveLibrary(libraryCache);
    });
    return loadLibrary();
  }

  function exportGame(gameId) {
    const game = loadGameById(gameId);
    if (!game) throw new Error("Game not found.");
    return JSON.stringify(game, null, 2);
  }

  function importGameFromText(jsonText, setActive = false) {
    const payload = JSON.parse(String(jsonText || ""));
    if (payload.gamesById && payload.gameOrder) {
      const incomingLibrary = normalizeLibrary(payload);
      incomingLibrary.gameOrder.forEach((gameId) => {
        libraryCache.gamesById[gameId] = deepClone(incomingLibrary.gamesById[gameId]);
        if (!libraryCache.gameOrder.includes(gameId)) libraryCache.gameOrder.push(gameId);
      });
      if (setActive && incomingLibrary.activeGameId) {
        libraryCache.activeGameId = incomingLibrary.activeGameId;
      }
      return saveLibrary(libraryCache);
    }

    if (!payload.id) throw new Error("Imported JSON does not contain a game id.");
    saveGame(payload, setActive);
    return deepClone(payload);
  }

  function addGameEvent(gameId, event) {
    const game = libraryCache.gamesById[gameId];
    if (!game) return null;
    const nextEvent = deepClone({
      ...event,
      gameId: event?.gameId || gameId
    });
    game.events = Array.isArray(game.events) ? game.events : [];
    game.events.push(nextEvent);
    queueIndexedDbWrite("add game event", () => db.addGameEvent(gameId, nextEvent));
    return deepClone(nextEvent);
  }

  function getGameEvents(gameId) {
    return deepClone(libraryCache.gamesById[gameId]?.events || []);
  }

  global.ScorebookStorage = {
    ready,
    flush: () => persistenceQueue,
    hasIndexedDbWarning: () => indexedDbWarningShown,
    loadLibrary,
    saveLibrary,
    saveGame,
    loadGameById,
    getActiveGame,
    setActiveGame,
    listGames,
    deleteGame,
    exportGame,
    importGameFromText,
    addGameEvent,
    getGameEvents,
    loadAppState,
    saveAppState,
    normalizeLibrary,
    emptyLibrary,
    buildLibraryFromGames
  };
})(window);

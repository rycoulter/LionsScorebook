(function initScorebookStorage(global) {
  const STORAGE_KEY = "oakmont-lions-scorebook-v1";
  const GAME_LIBRARY_KEY = "oakmont-lions-game-library-v1";
  const PLAY_HISTORY_STORAGE_LIMIT = 8;

  function deepClone(value) {
    if (value === undefined || value === null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function isQuotaExceeded(error) {
    return error?.name === "QuotaExceededError"
      || error?.code === 22
      || error?.code === 1014
      || String(error?.message || "").toLowerCase().includes("quota");
  }

  function setJsonItem(key, value) {
    const json = JSON.stringify(value);
    try {
      global.localStorage.setItem(key, json);
    } catch (error) {
      if (!isQuotaExceeded(error)) throw error;
      global.localStorage.removeItem(key);
      global.localStorage.setItem(key, json);
    }
  }

  function compactPlayHistory(history = [], limit = PLAY_HISTORY_STORAGE_LIMIT) {
    if (!Array.isArray(history)) return [];
    return history.slice(-limit).map((entry) => {
      const next = deepClone(entry);
      if (next?.game) next.game.playHistory = [];
      return next;
    });
  }

  function compactGameForStorage(game, playHistoryLimit = PLAY_HISTORY_STORAGE_LIMIT) {
    const next = deepClone(game);
    if (next?.playHistory) next.playHistory = compactPlayHistory(next.playHistory, playHistoryLimit);
    return next;
  }

  function compactLibraryForStorage(library, playHistoryLimit = PLAY_HISTORY_STORAGE_LIMIT) {
    const normalized = normalizeLibrary(library);
    const compacted = emptyLibrary();
    normalized.gameOrder.forEach((gameId) => {
      const game = normalized.gamesById[gameId];
      if (!game?.id) return;
      compacted.gamesById[game.id] = compactGameForStorage(game, playHistoryLimit);
      compacted.gameOrder.push(game.id);
    });
    compacted.activeGameId = normalized.activeGameId;
    return compacted;
  }

  function appStateForStorage(state) {
    const next = deepClone(state || {});
    next.games = [];
    return next;
  }

  function releaseLegacyAppStateGames() {
    const appState = loadAppState();
    if (Array.isArray(appState?.games) && appState.games.length) {
      saveAppState(appState);
    }
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

  function loadAppState() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("Unable to load saved app state.", error);
      return null;
    }
  }

  function saveAppState(state) {
    setJsonItem(STORAGE_KEY, appStateForStorage(state));
    return deepClone(state);
  }

  function loadLibrary() {
    try {
      const raw = global.localStorage.getItem(GAME_LIBRARY_KEY);
      if (raw) return normalizeLibrary(JSON.parse(raw));

      const legacy = loadAppState();
      if (!Array.isArray(legacy?.games)) return emptyLibrary();

      const library = buildLibraryFromGames(legacy.games, legacy.activeGameId);
      saveLibrary(library);
      return library;
    } catch (error) {
      console.warn("Unable to load saved game library.", error);
      return emptyLibrary();
    }
  }

  function saveLibrary(library) {
    const compacted = compactLibraryForStorage(library);
    releaseLegacyAppStateGames();
    try {
      setJsonItem(GAME_LIBRARY_KEY, compacted);
      return compacted;
    } catch (error) {
      if (!isQuotaExceeded(error)) throw error;
      const emergency = compactLibraryForStorage(library, 2);
      setJsonItem(GAME_LIBRARY_KEY, emergency);
      return emergency;
    }
  }

  function saveGame(game, setActive = true) {
    if (!game?.id) return loadLibrary();
    const library = loadLibrary();
    library.gamesById[game.id] = deepClone(game);
    if (!library.gameOrder.includes(game.id)) library.gameOrder.push(game.id);
    if (setActive) library.activeGameId = game.id;
    return saveLibrary(library);
  }

  function loadGameById(gameId) {
    const library = loadLibrary();
    return library.gamesById[gameId] ? deepClone(library.gamesById[gameId]) : null;
  }

  function getActiveGame() {
    const library = loadLibrary();
    return library.activeGameId ? loadGameById(library.activeGameId) : null;
  }

  function setActiveGame(gameId) {
    const library = loadLibrary();
    if (!library.gamesById[gameId]) return null;
    library.activeGameId = gameId;
    saveLibrary(library);
    return deepClone(library.gamesById[gameId]);
  }

  function listGames() {
    const library = loadLibrary();
    return library.gameOrder.map((gameId) => deepClone(library.gamesById[gameId])).filter(Boolean);
  }

  function deleteGame(gameId) {
    const library = loadLibrary();
    if (!library.gamesById[gameId]) return library;
    delete library.gamesById[gameId];
    library.gameOrder = library.gameOrder.filter((id) => id !== gameId);
    if (library.activeGameId === gameId) library.activeGameId = "";
    return saveLibrary(library);
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
      const currentLibrary = loadLibrary();
      incomingLibrary.gameOrder.forEach((gameId) => {
        currentLibrary.gamesById[gameId] = deepClone(incomingLibrary.gamesById[gameId]);
        if (!currentLibrary.gameOrder.includes(gameId)) currentLibrary.gameOrder.push(gameId);
      });
      if (setActive && incomingLibrary.activeGameId) {
        currentLibrary.activeGameId = incomingLibrary.activeGameId;
      }
      return saveLibrary(currentLibrary);
    }

    if (!payload.id) throw new Error("Imported JSON does not contain a game id.");
    saveGame(payload, setActive);
    return deepClone(payload);
  }

  global.ScorebookStorage = {
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
    loadAppState,
    saveAppState,
    normalizeLibrary,
    emptyLibrary,
    buildLibraryFromGames
  };
})(window);

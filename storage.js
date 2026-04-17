(function initScorebookStorage(global) {
  const STORAGE_KEY = "oakmont-lions-scorebook-v1";
  const GAME_LIBRARY_KEY = "oakmont-lions-game-library-v1";

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
      : normalized.gameOrder[0] || "";
    return normalized;
  }

  function buildLibraryFromGames(games = [], activeGameId = "") {
    const library = emptyLibrary();
    games.forEach((game) => {
      if (!game?.id) return;
      library.gamesById[game.id] = deepClone(game);
      if (!library.gameOrder.includes(game.id)) library.gameOrder.push(game.id);
    });
    library.activeGameId = activeGameId && library.gamesById[activeGameId] ? activeGameId : library.gameOrder[0] || "";
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
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    const normalized = normalizeLibrary(library);
    global.localStorage.setItem(GAME_LIBRARY_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function saveGame(game, setActive = true) {
    if (!game?.id) return loadLibrary();
    const library = loadLibrary();
    library.gamesById[game.id] = deepClone(game);
    if (!library.gameOrder.includes(game.id)) library.gameOrder.push(game.id);
    if (setActive || !library.activeGameId) library.activeGameId = game.id;
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
    if (library.activeGameId === gameId) library.activeGameId = library.gameOrder[0] || "";
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
      } else if (!currentLibrary.activeGameId) {
        currentLibrary.activeGameId = currentLibrary.gameOrder[0] || "";
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

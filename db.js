(function initScorebookDb(global) {
  const DB_NAME = "OakmontLionsScorebookDB";
  const DB_VERSION = 1;
  const APP_STATE_META_KEY = "appState";
  const LIBRARY_META_KEY = "gameLibrary";

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

  function eventRecordId(gameId, event, order) {
    return String(event?.id || `${gameId}-event-${order}`);
  }

  function splitGame(game) {
    if (!game?.id) throw new Error("Cannot save a game without an id.");
    const gameRecord = deepClone(game);
    const events = Array.isArray(gameRecord.events) ? gameRecord.events : [];
    const eventRecords = events.map((event, order) => ({
      id: eventRecordId(gameRecord.id, event, order),
      gameId: gameRecord.id,
      order,
      createdAt: event?.createdAt || "",
      payload: deepClone({
        ...event,
        id: eventRecordId(gameRecord.id, event, order),
        gameId: event?.gameId || gameRecord.id
      })
    }));
    gameRecord.events = [];
    gameRecord.eventIds = eventRecords.map((event) => event.id);
    return { gameRecord, eventRecords };
  }

  function sortEventRecords(a, b) {
    const orderA = Number.isFinite(Number(a?.order)) ? Number(a.order) : 0;
    const orderB = Number.isFinite(Number(b?.order)) ? Number(b.order) : 0;
    if (orderA !== orderB) return orderA - orderB;
    return String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
  }

  function composeGame(gameRecord, eventRecords = []) {
    if (!gameRecord) return null;
    const game = deepClone(gameRecord);
    delete game.eventIds;
    game.events = eventRecords
      .slice()
      .sort(sortEventRecords)
      .map((record) => deepClone(record.payload || record));
    return game;
  }

  function libraryMeta(library) {
    const normalized = normalizeLibrary(library);
    return {
      activeGameId: normalized.activeGameId,
      gameOrder: normalized.gameOrder.slice()
    };
  }

  function warnIndexedDbFailure(action, error) {
    console.warn(`IndexedDB ${action} failed. The app will continue with in-memory state.`, error);
  }

  function createDexieDriver() {
    if (typeof global.Dexie !== "function") return null;
    const db = new global.Dexie(DB_NAME);
    db.version(DB_VERSION).stores({
      games: "id,status,date,opponent",
      events: "id,gameId,order,createdAt",
      meta: "key"
    });

    async function getGameEvents(gameId) {
      if (!gameId) return [];
      const records = await db.events.where("gameId").equals(gameId).toArray();
      return records.sort(sortEventRecords).map((record) => deepClone(record.payload || record));
    }

    async function getGame(gameId) {
      if (!gameId) return null;
      const [gameRecord, eventRecords] = await Promise.all([
        db.games.get(gameId),
        db.events.where("gameId").equals(gameId).toArray()
      ]);
      return composeGame(gameRecord, eventRecords);
    }

    async function saveGame(game) {
      const { gameRecord, eventRecords } = splitGame(game);
      await db.transaction("rw", db.games, db.events, async () => {
        await db.games.put(gameRecord);
        await db.events.where("gameId").equals(gameRecord.id).delete();
        if (eventRecords.length) await db.events.bulkPut(eventRecords);
      });
      return deepClone(game);
    }

    async function addGameEvent(gameId, event) {
      if (!gameId) throw new Error("Cannot add an event without a game id.");
      const existingEvents = await db.events.where("gameId").equals(gameId).toArray();
      const order = Number.isFinite(Number(event?.order)) ? Number(event.order) : existingEvents.length;
      const record = {
        id: eventRecordId(gameId, event, order),
        gameId,
        order,
        createdAt: event?.createdAt || new Date().toISOString(),
        payload: deepClone({
          ...event,
          id: eventRecordId(gameId, event, order),
          gameId: event?.gameId || gameId
        })
      };
      await db.events.put(record);
      return deepClone(record.payload);
    }

    async function saveLibrary(library) {
      const normalized = normalizeLibrary(library);
      await db.transaction("rw", db.games, db.events, db.meta, async () => {
        const incomingIds = new Set(normalized.gameOrder);
        const existingIds = await db.games.toCollection().primaryKeys();
        const staleIds = existingIds.filter((gameId) => !incomingIds.has(gameId));
        await Promise.all(staleIds.map((gameId) => db.events.where("gameId").equals(gameId).delete()));
        if (staleIds.length) await db.games.bulkDelete(staleIds);
        for (const gameId of normalized.gameOrder) {
          const { gameRecord, eventRecords } = splitGame(normalized.gamesById[gameId]);
          await db.games.put(gameRecord);
          await db.events.where("gameId").equals(gameRecord.id).delete();
          if (eventRecords.length) await db.events.bulkPut(eventRecords);
        }
        await db.meta.put({ key: LIBRARY_META_KEY, value: libraryMeta(normalized) });
      });
      return normalized;
    }

    async function loadLibrary() {
      const meta = await db.meta.get(LIBRARY_META_KEY);
      const gameRecords = await db.games.toArray();
      const orderedIds = Array.isArray(meta?.value?.gameOrder) && meta.value.gameOrder.length
        ? meta.value.gameOrder
        : gameRecords.map((game) => game.id);
      const gameEntries = await Promise.all(orderedIds.map((gameId) => getGame(gameId)));
      const library = emptyLibrary();
      gameEntries.filter(Boolean).forEach((game) => {
        library.gamesById[game.id] = game;
        library.gameOrder.push(game.id);
      });
      library.activeGameId = meta?.value?.activeGameId && library.gamesById[meta.value.activeGameId]
        ? meta.value.activeGameId
        : "";
      return library;
    }

    async function deleteGame(gameId) {
      await db.transaction("rw", db.games, db.events, async () => {
        await db.games.delete(gameId);
        await db.events.where("gameId").equals(gameId).delete();
      });
    }

    async function saveAppState(state) {
      await db.meta.put({ key: APP_STATE_META_KEY, value: deepClone(state || null) });
      return deepClone(state);
    }

    async function loadAppState() {
      const record = await db.meta.get(APP_STATE_META_KEY);
      return record ? deepClone(record.value) : null;
    }

    return {
      ready: db.open(),
      addGameEvent,
      getGameEvents,
      saveGame,
      getGame,
      saveLibrary,
      loadLibrary,
      deleteGame,
      saveAppState,
      loadAppState,
      driver: "dexie"
    };
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
    });
  }

  function createNativeDriver() {
    if (!global.indexedDB) return null;
    const ready = new Promise((resolve, reject) => {
      const request = global.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("games")) {
          db.createObjectStore("games", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("events")) {
          const events = db.createObjectStore("events", { keyPath: "id" });
          events.createIndex("gameId", "gameId", { unique: false });
          events.createIndex("order", "order", { unique: false });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Unable to open IndexedDB."));
    });

    async function runRequest(storeName, mode, requestFactory) {
      const db = await ready;
      const objectStore = db.transaction(storeName, mode).objectStore(storeName);
      return requestToPromise(requestFactory(objectStore));
    }

    function getAll(storeName) {
      return runRequest(storeName, "readonly", (objectStore) => objectStore.getAll());
    }

    function get(storeName, key) {
      return runRequest(storeName, "readonly", (objectStore) => objectStore.get(key));
    }

    function put(storeName, value) {
      return runRequest(storeName, "readwrite", (objectStore) => objectStore.put(value));
    }

    function deleteKey(storeName, key) {
      return runRequest(storeName, "readwrite", (objectStore) => objectStore.delete(key));
    }

    async function getAllByGameId(gameId) {
      return runRequest("events", "readonly", (objectStore) => objectStore.index("gameId").getAll(gameId));
    }

    async function getGameEvents(gameId) {
      if (!gameId) return [];
      const records = await getAllByGameId(gameId);
      return records.sort(sortEventRecords).map((record) => deepClone(record.payload || record));
    }

    async function getGame(gameId) {
      if (!gameId) return null;
      const [gameRecord, eventRecords] = await Promise.all([
        get("games", gameId),
        getAllByGameId(gameId)
      ]);
      return composeGame(gameRecord, eventRecords);
    }

    async function saveGame(game) {
      const { gameRecord, eventRecords } = splitGame(game);
      await put("games", gameRecord);
      const oldEvents = await getAllByGameId(gameRecord.id);
      for (const event of oldEvents) {
        await deleteKey("events", event.id);
      }
      for (const eventRecord of eventRecords) {
        await put("events", eventRecord);
      }
      return deepClone(game);
    }

    async function addGameEvent(gameId, event) {
      if (!gameId) throw new Error("Cannot add an event without a game id.");
      const existingEvents = await getAllByGameId(gameId);
      const order = Number.isFinite(Number(event?.order)) ? Number(event.order) : existingEvents.length;
      const record = {
        id: eventRecordId(gameId, event, order),
        gameId,
        order,
        createdAt: event?.createdAt || new Date().toISOString(),
        payload: deepClone({
          ...event,
          id: eventRecordId(gameId, event, order),
          gameId: event?.gameId || gameId
        })
      };
      await put("events", record);
      return deepClone(record.payload);
    }

    async function saveLibrary(library) {
      const normalized = normalizeLibrary(library);
      const existingGames = await getAll("games");
      const incomingIds = new Set(normalized.gameOrder);
      for (const game of existingGames) {
        if (!incomingIds.has(game.id)) await deleteGame(game.id);
      }
      for (const gameId of normalized.gameOrder) {
        await saveGame(normalized.gamesById[gameId]);
      }
      await put("meta", { key: LIBRARY_META_KEY, value: libraryMeta(normalized) });
      return normalized;
    }

    async function loadLibrary() {
      const [meta, gameRecords] = await Promise.all([
        get("meta", LIBRARY_META_KEY),
        getAll("games")
      ]);
      const orderedIds = Array.isArray(meta?.value?.gameOrder) && meta.value.gameOrder.length
        ? meta.value.gameOrder
        : gameRecords.map((game) => game.id);
      const games = await Promise.all(orderedIds.map((gameId) => getGame(gameId)));
      const library = emptyLibrary();
      games.filter(Boolean).forEach((game) => {
        library.gamesById[game.id] = game;
        library.gameOrder.push(game.id);
      });
      library.activeGameId = meta?.value?.activeGameId && library.gamesById[meta.value.activeGameId]
        ? meta.value.activeGameId
        : "";
      return library;
    }

    async function deleteGame(gameId) {
      await deleteKey("games", gameId);
      const oldEvents = await getAllByGameId(gameId);
      for (const event of oldEvents) {
        await deleteKey("events", event.id);
      }
    }

    async function saveAppState(state) {
      await put("meta", { key: APP_STATE_META_KEY, value: deepClone(state || null) });
      return deepClone(state);
    }

    async function loadAppState() {
      const record = await get("meta", APP_STATE_META_KEY);
      return record ? deepClone(record.value) : null;
    }

    return {
      ready,
      addGameEvent,
      getGameEvents,
      saveGame,
      getGame,
      saveLibrary,
      loadLibrary,
      deleteGame,
      saveAppState,
      loadAppState,
      driver: "indexeddb"
    };
  }

  function createMemoryDriver() {
    let appState = null;
    let library = emptyLibrary();

    async function addGameEvent(gameId, event) {
      if (!gameId) throw new Error("Cannot add an event without a game id.");
      const game = library.gamesById[gameId];
      if (!game) throw new Error("Game not found.");
      const nextEvent = deepClone({
        ...event,
        id: eventRecordId(gameId, event, game.events?.length || 0),
        gameId: event?.gameId || gameId
      });
      game.events = Array.isArray(game.events) ? game.events : [];
      game.events.push(nextEvent);
      return deepClone(nextEvent);
    }

    return {
      ready: Promise.resolve(),
      addGameEvent,
      getGameEvents: async (gameId) => deepClone(library.gamesById[gameId]?.events || []),
      saveGame: async (game) => {
        if (!game?.id) throw new Error("Cannot save a game without an id.");
        library.gamesById[game.id] = deepClone(game);
        if (!library.gameOrder.includes(game.id)) library.gameOrder.push(game.id);
        return deepClone(game);
      },
      getGame: async (gameId) => deepClone(library.gamesById[gameId] || null),
      saveLibrary: async (nextLibrary) => {
        library = normalizeLibrary(nextLibrary);
        return deepClone(library);
      },
      loadLibrary: async () => deepClone(library),
      deleteGame: async (gameId) => {
        delete library.gamesById[gameId];
        library.gameOrder = library.gameOrder.filter((id) => id !== gameId);
        if (library.activeGameId === gameId) library.activeGameId = "";
      },
      saveAppState: async (state) => {
        appState = deepClone(state || null);
        return deepClone(appState);
      },
      loadAppState: async () => deepClone(appState),
      driver: "memory"
    };
  }

  const driver = createDexieDriver() || createNativeDriver() || createMemoryDriver();

  async function guarded(action, callback) {
    try {
      await driver.ready;
      return await callback();
    } catch (error) {
      warnIndexedDbFailure(action, error);
      throw error;
    }
  }

  global.ScorebookDB = {
    ready: driver.ready.catch((error) => {
      warnIndexedDbFailure("open", error);
      throw error;
    }),
    driver: driver.driver,
    addGameEvent: (gameId, event) => guarded("add event", () => driver.addGameEvent(gameId, event)),
    getGameEvents: (gameId) => guarded("load events", () => driver.getGameEvents(gameId)),
    saveGame: (game) => guarded("save game", () => driver.saveGame(game)),
    getGame: (gameId) => guarded("load game", () => driver.getGame(gameId)),
    saveLibrary: (library) => guarded("save game library", () => driver.saveLibrary(library)),
    loadLibrary: () => guarded("load game library", () => driver.loadLibrary()),
    deleteGame: (gameId) => guarded("delete game", () => driver.deleteGame(gameId)),
    saveAppState: (state) => guarded("save app state", () => driver.saveAppState(state)),
    loadAppState: () => guarded("load app state", () => driver.loadAppState())
  };
})(window);

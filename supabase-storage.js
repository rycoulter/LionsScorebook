(function initScorebookSupabaseStorage(global) {
  function deepClone(value) {
    if (value === undefined || value === null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function getClient() {
    return global.ScorebookSupabase?.getClient?.() || null;
  }

  function isReady() {
    return Boolean(getClient());
  }

  function currentSeasonValue() {
    return new Date().getFullYear();
  }

  function buildAppStateRow(state) {
    const deletedGameTombstones = deepClone(state?.deletedGameTombstones || {});
    const currentGameIds = Array.isArray(state?.games)
      ? state.games.map((game) => game?.id).filter(Boolean).filter((gameId) => !deletedGameTombstones[gameId])
      : [];
    return {
      id: "primary",
      roster: deepClone(state?.roster || []),
      lineup: deepClone(state?.lineup || []),
      roster_version: state?.rosterVersion ?? null,
      active_game_id: state?.activeGameId || "",
      metadata: {
        updated_from: "scorebook-app",
        games_count: currentGameIds.length,
        current_game_ids: currentGameIds,
        deleted_game_tombstones: deletedGameTombstones
      }
    };
  }

  function buildGameRow(game) {
    return {
      id: game.id,
      opponent: game.opponent || "Opponent",
      game_date: game.date || null,
      game_time: game.time || "",
      status: game.status || "scheduled",
      lions_side: game.lionsSide || "away",
      is_final: game.status === "final",
      game_data: deepClone(game)
    };
  }

  function hasCloudSyncedGameRecord(game) {
    const sync = game?.sync || {};
    return Boolean(sync.lastSyncedAt) || sync.status === "synced";
  }

  function mergeRemoteSnapshot(baseState, appStateRow, gamesRows) {
    const nextState = deepClone(baseState || {});
    const remoteMetadata = appStateRow?.metadata && typeof appStateRow.metadata === "object" ? appStateRow.metadata : {};
    const remoteDeletedGameTombstones = remoteMetadata.deleted_game_tombstones && typeof remoteMetadata.deleted_game_tombstones === "object"
      ? deepClone(remoteMetadata.deleted_game_tombstones)
      : {};
    const currentGames = Array.isArray(nextState.games) ? nextState.games : [];
    nextState.deletedGameTombstones = deepClone({
      ...(nextState.deletedGameTombstones || {}),
      ...remoteDeletedGameTombstones
    });
    currentGames.forEach((game) => {
      if (game?.id && nextState.deletedGameTombstones[game.id]) delete nextState.deletedGameTombstones[game.id];
    });
    if (appStateRow) {
      if (Array.isArray(appStateRow.roster) && appStateRow.roster.length) {
        nextState.roster = deepClone(appStateRow.roster);
      }
      if (Array.isArray(appStateRow.lineup) && appStateRow.lineup.length) {
        nextState.lineup = deepClone(appStateRow.lineup);
      }
      if (appStateRow.roster_version !== undefined && appStateRow.roster_version !== null) {
        nextState.rosterVersion = appStateRow.roster_version;
      }
      if (typeof appStateRow.active_game_id === "string") {
        nextState.activeGameId = appStateRow.active_game_id;
      }
    }
    if (Array.isArray(gamesRows)) {
      const localGames = Array.isArray(nextState.games) ? nextState.games.map((game) => deepClone(game)).filter(Boolean) : [];
      const remoteGamesById = new Map(
        gamesRows
          .map((row) => {
            const game = deepClone(row.game_data || null);
            const id = row.id || game?.id || "";
            return id && game ? [id, game] : null;
          })
          .filter(Boolean)
      );
      const mergedGames = [];
      const seenIds = new Set();
      localGames.forEach((game) => {
        const gameId = game?.id || "";
        if (!gameId || seenIds.has(gameId)) return;
        const remoteGame = remoteGamesById.get(gameId);
        if (!remoteGame && nextState.deletedGameTombstones?.[gameId]) {
          seenIds.add(gameId);
          return;
        }
        if (remoteGame && game.status !== "active") {
          mergedGames.push(remoteGame);
          seenIds.add(gameId);
          remoteGamesById.delete(gameId);
          return;
        }
        if (!remoteGame && game.status !== "active" && hasCloudSyncedGameRecord(game)) {
          seenIds.add(gameId);
          return;
        }
        mergedGames.push(game);
        seenIds.add(gameId);
        remoteGamesById.delete(gameId);
      });
      remoteGamesById.forEach((game, gameId) => {
        if (!gameId || seenIds.has(gameId)) return;
        mergedGames.push(game);
        seenIds.add(gameId);
      });
      nextState.games = mergedGames;
      mergedGames.forEach((game) => {
        if (game?.id && nextState.deletedGameTombstones?.[game.id]) delete nextState.deletedGameTombstones[game.id];
      });
    }
    return nextState;
  }

  async function fetchAppState() {
    const client = getClient();
    if (!client) return { data: null, error: new Error("Supabase client not ready.") };
    const response = await client
      .from("app_state")
      .select("*")
      .eq("id", "primary")
      .maybeSingle();
    return response;
  }

  async function fetchGames() {
    const client = getClient();
    if (!client) return { data: [], error: new Error("Supabase client not ready.") };
    const response = await client
      .from("games")
      .select("*")
      .order("game_date", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false });
    return response;
  }

  async function fetchBootstrap() {
    const [appStateResponse, gamesResponse] = await Promise.all([fetchAppState(), fetchGames()]);
    const error = appStateResponse.error || gamesResponse.error || null;
    return {
      data: {
        appState: appStateResponse.data || null,
        games: gamesResponse.data || []
      },
      error
    };
  }

  async function fetchLeagueStandings(division = "AA", season = currentSeasonValue()) {
    const client = getClient();
    if (!client) return { data: [], error: new Error("Supabase client not ready.") };
    const response = await client
      .from("league_standings")
      .select("*")
      .eq("division", String(division || "AA").toUpperCase())
      .eq("season", Number(season) || currentSeasonValue())
      .order("rank", { ascending: true, nullsFirst: false })
      .order("points", { ascending: false });
    return response;
  }

  async function upsertAppState(state) {
    const client = getClient();
    if (!client) return { data: null, error: new Error("Supabase client not ready.") };
    const row = buildAppStateRow(state);
    return client
      .from("app_state")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
  }

  async function upsertGames(games = []) {
    const client = getClient();
    if (!client) return { data: [], error: new Error("Supabase client not ready.") };
    const rows = games.filter((game) => game?.id).map(buildGameRow);
    if (!rows.length) return { data: [], error: null };
    return client
      .from("games")
      .upsert(rows, { onConflict: "id" })
      .select("id, updated_at");
  }

  async function pushSnapshot(state) {
    const [appStateResponse, gamesResponse] = await Promise.all([
      upsertAppState(state),
      upsertGames(state?.games || [])
    ]);
    return {
      data: {
        appState: appStateResponse.data || null,
        games: gamesResponse.data || []
      },
      error: appStateResponse.error || gamesResponse.error || null
    };
  }

  async function replaceGamesSnapshot(games = []) {
    return upsertGames(games);
  }

  async function deleteGames(gameIds = []) {
    const client = getClient();
    if (!client) return { data: [], error: new Error("Supabase client not ready.") };
    const ids = [...new Set(gameIds.filter(Boolean))];
    if (!ids.length) return { data: [], error: null };
    return client
      .from("games")
      .delete()
      .in("id", ids)
      .select("id");
  }

  async function isAdminEmail(email) {
    const client = getClient();
    if (!client) return { data: false, error: new Error("Supabase client not ready.") };
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return { data: false, error: null };
    const response = await client
      .from("app_admins")
      .select("email")
      .eq("email", normalized)
      .maybeSingle();
    return {
      data: Boolean(response.data?.email),
      error: response.error || null
    };
  }

  global.ScorebookSupabaseStorage = {
    getClient,
    isReady,
    buildAppStateRow,
    buildGameRow,
    mergeRemoteSnapshot,
    fetchAppState,
    fetchGames,
    fetchBootstrap,
    fetchLeagueStandings,
    upsertAppState,
    upsertGames,
    pushSnapshot,
    replaceGamesSnapshot,
    deleteGames,
    isAdminEmail
  };
})(window);

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

  function normalizePositions(positions) {
    if (Array.isArray(positions)) {
      return positions
        .map((position) => String(position).trim().toUpperCase())
        .map((position) => (position === "UTIL" ? "UTL" : position))
        .filter(Boolean);
    }
    return String(positions || "UTL")
      .split(/[|,]/)
      .map((position) => position.trim().toUpperCase())
      .map((position) => (position === "UTIL" ? "UTL" : position))
      .filter(Boolean);
  }

  function rosterPlayerFromRow(row) {
    if (!row?.id) return null;
    const positions = normalizePositions(row.positions);
    const bats = String(row.bats || "R").trim().toUpperCase();
    return {
      id: row.id,
      name: String(row.name || "").trim(),
      number: String(row.jersey_number || "").trim(),
      positions,
      primaryPosition: String(row.primary_position || positions[0] || "UTL").trim().toUpperCase(),
      bats,
      throws: String(row.throws || bats || "R").trim().toUpperCase(),
      height: String(row.height || "").trim(),
      weight: String(row.weight || "").trim(),
      active: row.active !== false,
      grades: row.grades && typeof row.grades === "object" ? deepClone(row.grades) : {}
    };
  }

  function buildRosterPlayerRow(player, index = 0, rosterVersion = "") {
    const positions = normalizePositions(player?.positions);
    const bats = String(player?.bats || "R").trim().toUpperCase();
    return {
      id: player.id,
      team_id: "lions",
      roster_version: String(rosterVersion || ""),
      name: String(player?.name || "").trim(),
      jersey_number: String(player?.number || "").trim(),
      positions,
      primary_position: String(player?.primaryPosition || positions[0] || "UTL").trim().toUpperCase(),
      bats,
      throws: String(player?.throws || bats || "R").trim().toUpperCase(),
      height: String(player?.height || "").trim(),
      weight: String(player?.weight || "").trim(),
      active: player?.active !== false,
      grades: deepClone(player?.grades || {}),
      sort_order: index,
      metadata: {
        updated_from: "scorebook-app"
      }
    };
  }

  function isMissingTableError(error, tableName) {
    if (!error) return false;
    const text = `${error.code || ""} ${error.message || ""} ${error.details || ""}`.toLowerCase();
    const table = String(tableName || "").toLowerCase();
    return text.includes("42p01")
      || text.includes("pgrst205")
      || (table && text.includes(table) && (text.includes("could not find") || text.includes("does not exist")));
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

  function mergeRemoteSnapshot(baseState, appStateRow, gamesRows, rosterRows = []) {
    const nextState = deepClone(baseState || {});
    const remoteMetadata = appStateRow?.metadata && typeof appStateRow.metadata === "object" ? appStateRow.metadata : {};
    const remoteDeletedGameTombstones = remoteMetadata.deleted_game_tombstones && typeof remoteMetadata.deleted_game_tombstones === "object"
      ? deepClone(remoteMetadata.deleted_game_tombstones)
      : {};
    nextState.deletedGameTombstones = deepClone(remoteDeletedGameTombstones);
    const rosterFromRows = Array.isArray(rosterRows)
      ? rosterRows.map(rosterPlayerFromRow).filter((player) => player?.id)
      : [];
    if (rosterFromRows.length) {
      nextState.roster = rosterFromRows;
    }
    if (appStateRow) {
      if (!rosterFromRows.length && Array.isArray(appStateRow.roster) && appStateRow.roster.length) {
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
        if (game.status === "active") {
          mergedGames.push(game);
          seenIds.add(gameId);
          remoteGamesById.delete(gameId);
          return;
        }
        if (remoteGame) {
          mergedGames.push(remoteGame);
          seenIds.add(gameId);
          remoteGamesById.delete(gameId);
          return;
        }
        seenIds.add(gameId);
      });
      remoteGamesById.forEach((game, gameId) => {
        if (!gameId || seenIds.has(gameId)) return;
        mergedGames.push(game);
        seenIds.add(gameId);
      });
      nextState.games = mergedGames;
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

  async function fetchRosterPlayers() {
    const client = getClient();
    if (!client) return { data: [], error: new Error("Supabase client not ready.") };
    const response = await client
      .from("roster_players")
      .select("*")
      .eq("team_id", "lions")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (isMissingTableError(response.error, "roster_players")) {
      return { data: [], error: null, missingTable: true };
    }
    return response;
  }

  async function fetchBootstrap() {
    const [appStateResponse, rosterPlayersResponse, gamesResponse] = await Promise.all([
      fetchAppState(),
      fetchRosterPlayers(),
      fetchGames()
    ]);
    const error = appStateResponse.error || rosterPlayersResponse.error || gamesResponse.error || null;
    return {
      data: {
        appState: appStateResponse.data || null,
        rosterPlayers: rosterPlayersResponse.data || [],
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

  async function upsertRosterPlayers(roster = [], rosterVersion = "") {
    const client = getClient();
    if (!client) return { data: [], error: new Error("Supabase client not ready.") };
    const rows = (Array.isArray(roster) ? roster : [])
      .filter((player) => player?.id)
      .map((player, index) => buildRosterPlayerRow(player, index, rosterVersion));
    if (!rows.length) return { data: [], error: null };
    const response = await client
      .from("roster_players")
      .upsert(rows, { onConflict: "id" })
      .select("id, updated_at");
    if (isMissingTableError(response.error, "roster_players")) {
      return { data: [], error: null, missingTable: true };
    }
    return response;
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
    const [appStateResponse, rosterPlayersResponse, gamesResponse] = await Promise.all([
      upsertAppState(state),
      upsertRosterPlayers(state?.roster || [], state?.rosterVersion || ""),
      upsertGames(state?.games || [])
    ]);
    return {
      data: {
        appState: appStateResponse.data || null,
        rosterPlayers: rosterPlayersResponse.data || [],
        games: gamesResponse.data || []
      },
      error: appStateResponse.error || rosterPlayersResponse.error || gamesResponse.error || null
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
    buildRosterPlayerRow,
    rosterPlayerFromRow,
    mergeRemoteSnapshot,
    fetchAppState,
    fetchRosterPlayers,
    fetchGames,
    fetchBootstrap,
    fetchLeagueStandings,
    upsertAppState,
    upsertRosterPlayers,
    upsertGames,
    pushSnapshot,
    replaceGamesSnapshot,
    deleteGames,
    isAdminEmail
  };
})(window);

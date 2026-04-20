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

  function buildAppStateRow(state) {
    return {
      id: "primary",
      roster: deepClone(state?.roster || []),
      lineup: deepClone(state?.lineup || []),
      roster_version: state?.rosterVersion ?? null,
      active_game_id: state?.activeGameId || "",
      metadata: {
        updated_from: "scorebook-app",
        games_count: Array.isArray(state?.games) ? state.games.length : 0
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

  function mergeRemoteSnapshot(baseState, appStateRow, gamesRows) {
    const nextState = deepClone(baseState || {});
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
      nextState.games = gamesRows.map((row) => deepClone(row.game_data || null)).filter(Boolean);
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
    const client = getClient();
    if (!client) return { data: [], error: new Error("Supabase client not ready.") };
    const ids = games.filter((game) => game?.id).map((game) => game.id);
    const existingResponse = await client.from("games").select("id");
    if (existingResponse.error) {
      return { data: [], error: existingResponse.error };
    }
    const staleIds = (existingResponse.data || [])
      .map((row) => row.id)
      .filter((id) => !ids.includes(id));
    if (staleIds.length) {
      const deleteResponse = await client.from("games").delete().in("id", staleIds);
      if (deleteResponse.error) {
        return { data: [], error: deleteResponse.error };
      }
    }
    return upsertGames(games);
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
    upsertAppState,
    upsertGames,
    pushSnapshot,
    replaceGamesSnapshot,
    isAdminEmail
  };
})(window);

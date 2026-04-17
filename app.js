const STORAGE_KEY = "oakmont-lions-scorebook-v1";

const eventRules = {
  "1B": { label: "Single", pa: true, ab: true, hit: true, tb: 1, reach: true, bip: true },
  "2B": { label: "Double", pa: true, ab: true, hit: true, tb: 2, reach: true, bip: true },
  "3B": { label: "Triple", pa: true, ab: true, hit: true, tb: 3, reach: true, bip: true },
  HR: { label: "Home run", pa: true, ab: true, hit: true, tb: 4, reach: true, bip: true, hr: true },
  BB: { label: "Walk", pa: true, ab: false, bb: true, reach: true },
  HBP: { label: "Hit by pitch", pa: true, ab: false, hbp: true, reach: true },
  ROE: { label: "Reached on error", pa: true, ab: true, reach: true, bip: true, roe: true },
  FC: { label: "Fielder's choice", pa: true, ab: true, out: true, bip: true },
  K: { label: "Strikeout", pa: true, ab: true, out: true, k: true },
  GO: { label: "Groundout", pa: true, ab: true, out: true, bip: true, launch: "gb" },
  FO: { label: "Flyout", pa: true, ab: true, out: true, bip: true, launch: "fb" },
  LO: { label: "Lineout", pa: true, ab: true, out: true, bip: true, launch: "ld" },
  SAC: { label: "Sacrifice", pa: true, ab: false, out: true, sac: true, bip: true },
  SB: { label: "Stolen base", pa: false, sb: true },
  CS: { label: "Caught stealing", pa: false, cs: true, out: true }
};

const launchLabels = {
  none: "No contact",
  gb: "Ground ball",
  ld: "Line drive",
  fb: "Fly ball",
  pu: "Pop up"
};

const contactLabels = {
  none: "No batted ball",
  weak: "Weak",
  solid: "Solid",
  hard: "Hard hit",
  barrel: "Barrel"
};

const pitchLabels = {
  ball: "Ball",
  called_strike: "Called strike",
  swinging_strike: "Swinging strike",
  foul: "Foul",
  in_play: "Ball in play"
};

const battedBallResults = new Set(["1B", "2B", "3B", "HR", "ROE", "FC", "GO", "FO", "LO", "SAC"]);

const defaultRoster = [
  makePlayer("p1", "Cam Miller", 2, "SS, P", "R", { contact: 68, power: 55, speed: 72, defense: 70 }),
  makePlayer("p2", "Eli Parker", 5, "C, 3B", "R", { contact: 61, power: 70, speed: 48, defense: 73 }),
  makePlayer("p3", "Noah Brooks", 7, "CF, P", "L", { contact: 64, power: 58, speed: 76, defense: 66 }),
  makePlayer("p4", "Mason Reed", 9, "1B, LF", "L", { contact: 57, power: 74, speed: 44, defense: 55 }),
  makePlayer("p5", "Luca Stone", 11, "2B, SS", "R", { contact: 72, power: 43, speed: 68, defense: 69 }),
  makePlayer("p6", "Owen Hayes", 13, "RF, 1B", "R", { contact: 54, power: 64, speed: 50, defense: 57 }),
  makePlayer("p7", "Jack Bennett", 15, "LF, CF", "S", { contact: 59, power: 49, speed: 74, defense: 61 }),
  makePlayer("p8", "Ryan Cole", 18, "3B, P", "R", { contact: 51, power: 62, speed: 52, defense: 64 }),
  makePlayer("p9", "Tyler Quinn", 21, "2B, RF", "R", { contact: 63, power: 46, speed: 66, defense: 60 }),
  makePlayer("p10", "Ben Carter", 24, "C, 1B", "L", { contact: 56, power: 67, speed: 42, defense: 68 })
];

let state = loadState();
let optimizedIds = [];
let pendingSpray = null;
let lineupBuilderGameId = null;

const els = {
  tabs: [...document.querySelectorAll(".tab")],
  views: [...document.querySelectorAll(".view")],
  gameTitle: document.getElementById("gameTitle"),
  gameContext: document.getElementById("gameContext"),
  lionsScore: document.getElementById("lionsScore"),
  opponentScore: document.getElementById("opponentScore"),
  bases: [...document.querySelectorAll(".base")],
  scorerStack: document.getElementById("scorerStack"),
  currentBatterName: document.getElementById("currentBatterName"),
  currentBatterMeta: document.getElementById("currentBatterMeta"),
  batterSummary: document.getElementById("batterSummary"),
  countDisplay: document.getElementById("countDisplay"),
  pitchButtons: [...document.querySelectorAll("[data-pitch]")],
  pitchTrail: document.getElementById("pitchTrail"),
  resetCountBtn: document.getElementById("resetCountBtn"),
  undoPitchBtn: document.getElementById("undoPitchBtn"),
  sprayChart: document.getElementById("sprayChart"),
  sprayMarkers: document.getElementById("sprayMarkers"),
  sprayFilter: document.getElementById("sprayFilter"),
  sprayHint: document.getElementById("sprayHint"),
  abCard: document.getElementById("abCard"),
  bipPanel: document.getElementById("bipPanel"),
  clearBipBtn: document.getElementById("clearBipBtn"),
  opponentAbPanel: document.getElementById("opponentAbPanel"),
  opponentBatterName: document.getElementById("opponentBatterName"),
  opponentBatterMeta: document.getElementById("opponentBatterMeta"),
  opponentBatterSummary: document.getElementById("opponentBatterSummary"),
  opponentCountDisplay: document.getElementById("opponentCountDisplay"),
  opponentOutsDisplay: document.getElementById("opponentOutsDisplay"),
  opponentPitchTrail: document.getElementById("opponentPitchTrail"),
  resetOpponentCountBtn: document.getElementById("resetOpponentCountBtn"),
  undoOpponentPitchBtn: document.getElementById("undoOpponentPitchBtn"),
  pitcherSelect: document.getElementById("pitcherSelect"),
  pitcherStatStrip: document.getElementById("pitcherStatStrip"),
  opponentOutcomeButtons: [...document.querySelectorAll("[data-opponent-result]")],
  runnerBases: [...document.querySelectorAll("[data-runner-base]")],
  runnerSummary: document.getElementById("runnerSummary"),
  runnerHint: document.getElementById("runnerHint"),
  stealButtons: [...document.querySelectorAll("[data-steal]")],
  scoreForm: document.getElementById("scoreForm"),
  choiceButtons: [...document.querySelectorAll("[data-choice-group]")],
  gameForm: document.getElementById("gameForm"),
  scheduleGameBtn: document.getElementById("scheduleGameBtn"),
  gamesGrid: document.getElementById("gamesGrid"),
  lineupBuilderPanel: document.getElementById("lineupBuilderPanel"),
  lineupBuilderTitle: document.getElementById("lineupBuilderTitle"),
  lineupBuilderRows: document.getElementById("lineupBuilderRows"),
  addLineupSpotBtn: document.getElementById("addLineupSpotBtn"),
  resetGameLineupBtn: document.getElementById("resetGameLineupBtn"),
  closeLineupBuilderBtn: document.getElementById("closeLineupBuilderBtn"),
  opponentInput: document.getElementById("opponentInput"),
  gameDateInput: document.getElementById("gameDateInput"),
  gameLocationInput: document.getElementById("gameLocationInput"),
  gameNotesInput: document.getElementById("gameNotesInput"),
  batterSelect: document.getElementById("batterSelect"),
  resultSelect: document.getElementById("resultSelect"),
  runsInput: document.getElementById("runsInput"),
  rbiInput: document.getElementById("rbiInput"),
  contactSelect: document.getElementById("contactSelect"),
  launchSelect: document.getElementById("launchSelect"),
  noteInput: document.getElementById("noteInput"),
  newGameBtn: document.getElementById("newGameBtn"),
  undoBtn: document.getElementById("undoBtn"),
  endHalfBtn: document.getElementById("endHalfBtn"),
  finishGameBtn: document.getElementById("finishGameBtn"),
  liveLineup: document.getElementById("liveLineup"),
  lineupCount: document.getElementById("lineupCount"),
  playFeed: document.getElementById("playFeed"),
  playCount: document.getElementById("playCount"),
  scoreOpponentLineupInput: document.getElementById("scoreOpponentLineupInput"),
  subPanel: document.getElementById("subPanel"),
  subSpotSelect: document.getElementById("subSpotSelect"),
  subPlayerSelect: document.getElementById("subPlayerSelect"),
  subTypeSelect: document.getElementById("subTypeSelect"),
  applySubBtn: document.getElementById("applySubBtn"),
  optimizeBtn: document.getElementById("optimizeBtn"),
  optimizedLineup: document.getElementById("optimizedLineup"),
  optimizerMode: document.getElementById("optimizerMode"),
  runWeight: document.getElementById("runWeight"),
  contactWeight: document.getElementById("contactWeight"),
  speedWeight: document.getElementById("speedWeight"),
  defenseWeight: document.getElementById("defenseWeight"),
  applyOptimizedBtn: document.getElementById("applyOptimizedBtn"),
  addPlayerBtn: document.getElementById("addPlayerBtn"),
  playerForm: document.getElementById("playerForm"),
  playerName: document.getElementById("playerName"),
  playerNumber: document.getElementById("playerNumber"),
  playerPositions: document.getElementById("playerPositions"),
  playerBats: document.getElementById("playerBats"),
  rosterGrid: document.getElementById("rosterGrid"),
  archiveSearch: document.getElementById("archiveSearch"),
  archiveGrid: document.getElementById("archiveGrid"),
  metricsGrid: document.getElementById("metricsGrid"),
  valueBoard: document.getElementById("valueBoard"),
  hittingStatsBody: document.getElementById("hittingStatsBody"),
  pitchingStatsBody: document.getElementById("pitchingStatsBody"),
  statsSprayPlayerSelect: document.getElementById("statsSprayPlayerSelect"),
  statsSprayGameSelect: document.getElementById("statsSprayGameSelect"),
  statsSprayMarkers: document.getElementById("statsSprayMarkers"),
  exportBtn: document.getElementById("exportBtn"),
  playerTemplate: document.getElementById("playerCardTemplate")
};

bindEvents();
render();

function makePlayer(id, name, number, positions, bats, grades) {
  return { id, name, number, positions, bats, active: true, grades };
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function uuid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeAtBat() {
  return {
    balls: 0,
    strikes: 0,
    pitches: [],
    pendingInPlay: false
  };
}

function cloneAtBat(atBat) {
  return {
    balls: atBat.balls || 0,
    strikes: atBat.strikes || 0,
    pitches: [...(atBat.pitches || [])],
    pendingInPlay: Boolean(atBat.pendingInPlay)
  };
}

function makeLineupEntries(playerIds = []) {
  return playerIds.map((playerId, index) => ({
    id: uuid(),
    playerId,
    role: defaultRoleForSpot(index),
    active: true,
    note: ""
  }));
}

function defaultRoleForSpot(index) {
  return ["C", "P", "1B", "2B", "3B", "SS", "LF", "CF", "RF"][index] || "EH";
}

function makeGame(opponent = "Wildcats") {
  return {
    id: uuid(),
    opponent,
    date: todayValue(),
    location: "",
    notes: "",
    status: "active",
    inning: 1,
    half: "top",
    outs: 0,
    bases: { first: false, second: false, third: false },
    batterIndex: 0,
    lineupEntries: makeLineupEntries(defaultRoster.filter((player) => player.active).map((player) => player.id)),
    opponentBatterIndex: 0,
    opponentLineup: [],
    pitcherId: "",
    score: { lions: 0, opponent: 0 },
    events: [],
    atBat: makeAtBat()
  };
}

function seedState() {
  const sampleGame = makeGame("Riverside Hawks");
  sampleGame.status = "completed";
  sampleGame.date = "2026-04-10";
  sampleGame.score = { lions: 7, opponent: 4 };
  sampleGame.events = [
    seedEvent(sampleGame, "p1", "BB", 1, 0, "none", "none", "high", "Opened with a disciplined walk."),
    seedEvent(sampleGame, "p2", "2B", 1, 2, "hard", "ld", "high", "Drove the outer-half pitch into the gap.", { x: 38, y: 36, zone: "LCF" }),
    seedEvent(sampleGame, "p3", "1B", 0, 1, "solid", "gb", "neutral", "Beat the throw with speed pressure.", { x: 54, y: 67, zone: "MIF" }),
    seedEvent(sampleGame, "p4", "HR", 1, 2, "barrel", "fb", "high", "Pulled a mistake with runners on.", { x: 27, y: 18, zone: "LF" }),
    seedEvent(sampleGame, "p5", "1B", 0, 0, "solid", "ld", "neutral", "Short swing with two strikes.", { x: 62, y: 48, zone: "RCF" }),
    seedEvent(sampleGame, "p6", "K", 0, 0, "none", "none", "low", "Chased above the zone."),
    seedEvent(sampleGame, "p7", "SB", 0, 0, "none", "none", "neutral", "Good jump on first move."),
    seedEvent(sampleGame, "p8", "FO", 0, 0, "weak", "fb", "low", "Got under it.", { x: 73, y: 29, zone: "RF" }),
    seedEvent(sampleGame, "p9", "1B", 1, 1, "hard", "ld", "high", "Line drive through the middle.", { x: 50, y: 42, zone: "CF" })
  ];
  const activeGame = makeGame("Wildcats");
  return {
    roster: defaultRoster,
    lineup: defaultRoster.filter((player) => player.active).map((player) => player.id),
    games: [sampleGame, activeGame],
    activeGameId: activeGame.id
  };
}

function seedEvent(game, playerId, result, runs, rbi, contact, launch, leverage, note, spray = null) {
  return {
    id: uuid(),
    gameId: game.id,
    playerId,
    result,
    runs,
    rbi,
    contact,
    launch,
    leverage,
    inning: game.inning,
    half: "top",
    outsBefore: 0,
    basesBefore: { first: false, second: false, third: false },
    scope: "offense",
    note,
    spray,
    pitches: [],
    createdAt: new Date().toISOString()
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw);
    if (!parsed.roster || !parsed.games || !parsed.lineup) return seedState();
    return normalizeState(parsed);
  } catch (error) {
    console.warn("Unable to load saved scorebook.", error);
    return seedState();
  }
}

function normalizeState(nextState) {
  nextState.games = nextState.games.map((game) => ({
    ...game,
    location: game.location || "",
    notes: game.notes || "",
    status: game.status || "active",
    lineupEntries: game.lineupEntries || makeLineupEntries(nextState.lineup || []),
    opponentBatterIndex: game.opponentBatterIndex || 0,
    opponentLineup: game.opponentLineup || [],
    pitcherId: game.pitcherId || "",
    atBat: game.atBat || makeAtBat(),
    events: (game.events || []).map((event) => ({
      ...event,
      pitches: event.pitches || [],
      spray: event.spray || null
    }))
  }));
  return nextState;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  els.scoreForm.addEventListener("submit", (event) => {
    event.preventDefault();
    logPlay();
  });

  els.gameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    scheduleGame();
  });
  els.scheduleGameBtn.addEventListener("click", scheduleGame);
  els.gamesGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-game-action]");
    if (!button) return;
    if (button.dataset.gameAction === "score") scoreScheduledGame(button.dataset.gameId);
    if (button.dataset.gameAction === "complete") completeScheduledGame(button.dataset.gameId);
    if (button.dataset.gameAction === "lineup") openLineupBuilder(button.dataset.gameId);
  });

  els.lineupBuilderRows.addEventListener("change", (event) => {
    const row = event.target.closest("[data-lineup-entry]");
    if (!row) return;
    updateLineupEntry(row.dataset.lineupEntry, row.querySelector("[data-lineup-player]").value, row.querySelector("[data-lineup-role]").value);
  });

  els.lineupBuilderRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-lineup-entry]");
    if (button) removeLineupEntry(button.dataset.removeLineupEntry);
  });

  els.addLineupSpotBtn.addEventListener("click", addLineupEntry);
  els.resetGameLineupBtn.addEventListener("click", resetBuilderLineup);
  els.closeLineupBuilderBtn.addEventListener("click", () => {
    lineupBuilderGameId = null;
    renderLineupBuilder();
  });

  els.choiceButtons.forEach((button) => {
    button.addEventListener("click", () => selectChoice(button.dataset.choiceGroup, button.dataset.choiceValue));
  });

  els.stealButtons.forEach((button) => {
    button.addEventListener("click", () => recordSteal(button.dataset.steal, button.dataset.stealResult));
  });

  els.opponentOutcomeButtons.forEach((button) => {
    button.addEventListener("click", () => logOpponentOutcome(button.dataset.opponentResult));
  });

  els.opponentInput.addEventListener("input", () => {
    const game = activeGame();
    game.opponent = els.opponentInput.value.trim() || "Opponent";
    saveState();
    renderScoreboard();
    renderGames();
    renderArchive();
  });

  els.gameDateInput.addEventListener("change", () => {
    activeGame().date = els.gameDateInput.value || todayValue();
    saveState();
    renderScoreboard();
    renderGames();
    renderArchive();
  });

  els.gameLocationInput.addEventListener("input", () => {
    activeGame().location = els.gameLocationInput.value.trim();
    saveState();
    renderGames();
  });

  els.gameNotesInput.addEventListener("input", () => {
    activeGame().notes = els.gameNotesInput.value.trim();
    saveState();
    renderGames();
  });

  els.scoreOpponentLineupInput.addEventListener("input", () => {
    updateOpponentLineup(els.scoreOpponentLineupInput.value);
  });

  els.pitcherSelect.addEventListener("change", () => {
    activeGame().pitcherId = els.pitcherSelect.value;
    saveState();
    renderAtBat();
  });

  els.pitchButtons.forEach((button) => {
    button.addEventListener("click", () => logPitch(button.dataset.pitch));
  });

  els.resetCountBtn.addEventListener("click", () => {
    activeGame().atBat = makeAtBat();
    pendingSpray = null;
    resetBipChoices();
    saveState();
    renderAtBat();
    renderSprayChart();
  });

  els.undoPitchBtn.addEventListener("click", undoPitch);
  els.resetOpponentCountBtn.addEventListener("click", () => {
    activeGame().atBat = makeAtBat();
    saveState();
    renderAtBat();
  });
  els.undoOpponentPitchBtn.addEventListener("click", undoPitch);
  els.clearBipBtn.addEventListener("click", () => {
    const game = activeGame();
    if (game.atBat) game.atBat.pendingInPlay = false;
    pendingSpray = null;
    resetBipChoices();
    saveState();
    renderAtBat();
    renderSprayChart();
  });
  els.sprayChart.addEventListener("click", setSprayFromPointer);
  els.sprayChart.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setPendingSpray(50, 45);
    }
  });
  els.sprayFilter.addEventListener("change", renderSprayChart);
  els.batterSelect.addEventListener("change", () => {
    const index = gameLineupPlayerIds().indexOf(els.batterSelect.value);
    if (index >= 0) {
      const game = activeGame();
      game.batterIndex = index;
      game.atBat = makeAtBat();
      pendingSpray = null;
      saveState();
      render();
    }
  });
  els.resultSelect.addEventListener("change", suggestRunValues);
  els.newGameBtn.addEventListener("click", () => switchView("games"));
  els.undoBtn.addEventListener("click", undoLastPlay);
  els.endHalfBtn.addEventListener("click", () => {
    advanceHalf(activeGame());
    saveState();
    render();
  });
  els.finishGameBtn.addEventListener("click", finishGame);

  els.optimizeBtn.addEventListener("click", () => {
    optimizedIds = buildOptimizedLineup();
    renderOptimizedLineup();
  });

  [els.runWeight, els.contactWeight, els.speedWeight, els.defenseWeight].forEach((input) => {
    input.addEventListener("input", () => {
      optimizedIds = buildOptimizedLineup();
      renderOptimizedLineup();
      renderValueBoard();
    });
  });

  els.applyOptimizedBtn.addEventListener("click", () => {
    if (!optimizedIds.length) optimizedIds = buildOptimizedLineup();
    const game = activeGame();
    game.lineupEntries = makeLineupEntries(optimizedIds);
    game.batterIndex = 0;
    saveState();
    render();
    switchView("score");
  });

  els.addPlayerBtn.addEventListener("click", () => els.playerName.focus());
  els.playerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addPlayer();
  });

  els.archiveSearch.addEventListener("input", renderArchive);
  els.applySubBtn.addEventListener("click", applySubstitution);
  els.statsSprayPlayerSelect.addEventListener("change", renderStatsSprayChart);
  els.statsSprayGameSelect.addEventListener("change", renderStatsSprayChart);
  els.exportBtn.addEventListener("click", exportData);
}

function switchView(view) {
  els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  els.views.forEach((panel) => panel.classList.toggle("is-visible", panel.dataset.panel === view));
}

function activeGame() {
  let game = state.games.find((item) => item.id === state.activeGameId);
  if (!game) {
    game = makeGame();
    state.games.push(game);
    state.activeGameId = game.id;
  }
  return game;
}

function activePlayers() {
  return gameLineupEntries()
    .map((entry) => state.roster.find((player) => player.id === entry.playerId))
    .filter(Boolean);
}

function gameLineupEntries(game = activeGame()) {
  if (!game.lineupEntries || !game.lineupEntries.length) {
    game.lineupEntries = makeLineupEntries(state.lineup);
  }
  return game.lineupEntries.filter((entry) => entry.active !== false && entry.playerId);
}

function gameLineupPlayerIds(game = activeGame()) {
  return gameLineupEntries(game).map((entry) => entry.playerId);
}

function currentBatterId(game = activeGame()) {
  const ids = gameLineupPlayerIds(game);
  return ids[game.batterIndex] || ids[0] || state.lineup[0] || state.roster[0]?.id || "";
}

function parseOpponentLineup(value) {
  return value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function opponentLineup(game = activeGame()) {
  if (game.opponentLineup && game.opponentLineup.length) return game.opponentLineup;
  return ["Batter 1", "Batter 2", "Batter 3", "Batter 4", "Batter 5", "Batter 6", "Batter 7", "Batter 8", "Batter 9"];
}

function currentOpponentBatter(game = activeGame()) {
  const lineup = opponentLineup(game);
  const index = game.opponentBatterIndex || 0;
  return lineup[index % lineup.length];
}

function nextOpponentBatterIndex(game) {
  const total = Math.max(opponentLineup(game).length, 1);
  return ((game.opponentBatterIndex || 0) + 1) % total;
}

function updateOpponentLineup(value) {
  const game = activeGame();
  game.opponentLineup = parseOpponentLineup(value);
  game.opponentBatterIndex = Math.min(game.opponentBatterIndex || 0, Math.max(game.opponentLineup.length - 1, 0));
  saveState();
  renderAtBat();
  renderLiveLineup();
  renderGames();
}

function currentPitcherId(game = activeGame()) {
  if (game.pitcherId) return game.pitcherId;
  const fallback = gameLineupPlayerIds(game)[0] || state.lineup[0] || state.roster[0]?.id || "";
  game.pitcherId = fallback;
  return fallback;
}

function selectChoice(group, value, silent = false) {
  const target = group === "result" ? els.resultSelect : group === "contact" ? els.contactSelect : els.launchSelect;
  if (!target) return;
  target.value = value;
  els.choiceButtons
    .filter((button) => button.dataset.choiceGroup === group)
    .forEach((button) => button.classList.toggle("is-selected", button.dataset.choiceValue === value));
  if (silent) return;
  if (group === "result") suggestRunValues();
  if ((group === "contact" || group === "launch") && value !== "none") {
    const game = activeGame();
    if (game.atBat) game.atBat.pendingInPlay = true;
    renderAtBat();
  }
}

function resetBipChoices() {
  selectChoice("result", "1B", true);
  selectChoice("contact", "none", true);
  selectChoice("launch", "none", true);
}

function logPitch(type) {
  const game = activeGame();
  if (!game.atBat) game.atBat = makeAtBat();
  const pitch = {
    id: uuid(),
    type,
    label: pitchLabels[type] || type,
    countBefore: `${game.atBat.balls}-${game.atBat.strikes}`,
    createdAt: new Date().toISOString()
  };
  game.atBat.pitches.push(pitch);

  if (game.half === "bottom") {
    if (type === "ball") {
      game.atBat.balls = Math.min(4, game.atBat.balls + 1);
      if (game.atBat.balls >= 4) {
        saveState();
        logOpponentOutcome("BB");
        return;
      }
    }
    if (type === "called_strike" || type === "swinging_strike") {
      game.atBat.strikes = Math.min(3, game.atBat.strikes + 1);
      if (game.atBat.strikes >= 3) {
        saveState();
        logOpponentOutcome("K");
        return;
      }
    }
    if (type === "foul" && game.atBat.strikes < 2) game.atBat.strikes += 1;
    saveState();
    renderAtBat();
    return;
  }

  if (type === "ball") {
    game.atBat.balls = Math.min(4, game.atBat.balls + 1);
    if (game.atBat.balls >= 4) {
      selectChoice("result", "BB");
    }
  }

  if (type === "called_strike" || type === "swinging_strike") {
    game.atBat.strikes = Math.min(3, game.atBat.strikes + 1);
    if (game.atBat.strikes >= 3) {
      selectChoice("result", "K");
    }
  }

  if (type === "foul" && game.atBat.strikes < 2) {
    game.atBat.strikes += 1;
  }

  if (type === "in_play") {
    game.atBat.pendingInPlay = true;
    if (els.contactSelect.value === "none") selectChoice("contact", "solid");
    if (els.launchSelect.value === "none") selectChoice("launch", "ld");
    if (!battedBallResults.has(els.resultSelect.value)) selectChoice("result", "1B", true);
    els.sprayHint.textContent = "Tap where the ball landed or was fielded.";
  }

  saveState();
  renderAtBat();
  renderSprayChart();
}

function undoPitch() {
  const game = activeGame();
  if (!game.atBat || !game.atBat.pitches.length) return;
  game.atBat.pitches.pop();
  const pitches = [...game.atBat.pitches];
  game.atBat = makeAtBat();
  pitches.forEach((pitch) => {
    if (pitch.type === "ball") game.atBat.balls = Math.min(4, game.atBat.balls + 1);
    if (pitch.type === "called_strike" || pitch.type === "swinging_strike") game.atBat.strikes = Math.min(3, game.atBat.strikes + 1);
    if (pitch.type === "foul" && game.atBat.strikes < 2) game.atBat.strikes += 1;
    if (pitch.type === "in_play") game.atBat.pendingInPlay = true;
    game.atBat.pitches.push(pitch);
  });
  saveState();
  renderAtBat();
}

function logPlay() {
  const game = activeGame();
  if (game.half === "bottom") {
    logOpponentOutcome(els.resultSelect.value || "GO");
    return;
  }
  if (game.status !== "completed") game.status = "active";
  game.opponent = game.opponent || "Opponent";
  game.date = game.date || todayValue();

  const playerId = els.batterSelect.value || currentBatterId(game);
  const result = els.resultSelect.value;
  const rule = eventRules[result];
  const runs = clampNumber(els.runsInput.value, 0, 4);
  const rbi = clampNumber(els.rbiInput.value, 0, 4);
  const snapshotBefore = {
    inning: game.inning,
    half: game.half,
    outs: game.outs,
    bases: { ...game.bases },
    batterIndex: game.batterIndex,
    score: { ...game.score },
    atBat: game.atBat ? cloneAtBat(game.atBat) : makeAtBat()
  };

  const event = {
    id: uuid(),
    gameId: game.id,
    playerId,
    result,
    runs,
    rbi,
    contact: els.contactSelect.value,
    launch: rule.launch || els.launchSelect.value,
    leverage: "neutral",
    inning: game.inning,
    half: game.half,
    outsBefore: game.outs,
    basesBefore: { ...game.bases },
    scope: game.half === "top" ? "offense" : "defense",
    note: els.noteInput.value.trim(),
    pitches: game.atBat ? [...game.atBat.pitches] : [],
    count: game.atBat ? `${game.atBat.balls}-${game.atBat.strikes}` : "0-0",
    spray: battedBallResults.has(result) ? pendingSpray : null,
    createdAt: new Date().toISOString(),
    snapshotBefore
  };

  game.events.push(event);

  if (game.half === "top") {
    game.score.lions += runs;
    applyBaseMovement(game, result, playerId);
    if (rule.pa) {
      game.batterIndex = nextBatterIndex(game.batterIndex);
      game.atBat = makeAtBat();
      pendingSpray = null;
    }
  } else {
    game.score.opponent += runs;
    applyBaseMovement(game, result, "opponent");
    if (rule.pa) {
      game.atBat = makeAtBat();
      pendingSpray = null;
    }
  }

  if (rule.out) game.outs += 1;
  if (game.outs >= 3) advanceHalf(game);

  els.runsInput.value = "0";
  els.rbiInput.value = "0";
  resetBipChoices();
  els.noteInput.value = "";
  saveState();
  render();
}

function clampNumber(value, min, max) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function nextBatterIndex(index) {
  const total = Math.max(gameLineupPlayerIds().length, 1);
  return (index + 1) % total;
}

function suggestRunValues() {
  const game = activeGame();
  if (els.resultSelect.value === "HR") {
    const occupied = Object.values(game.bases).filter(Boolean).length;
    const runs = occupied + 1;
    els.runsInput.value = String(runs);
    els.rbiInput.value = String(runs);
    selectChoice("contact", "barrel", true);
    selectChoice("launch", "fb", true);
  } else if (["K", "BB", "HBP", "SB", "CS"].includes(els.resultSelect.value)) {
    game.atBat.pendingInPlay = false;
    pendingSpray = null;
    if (["BB", "HBP"].includes(els.resultSelect.value) && game.bases.first && game.bases.second && game.bases.third) {
      els.runsInput.value = "1";
      els.rbiInput.value = "1";
    }
    selectChoice("contact", "none", true);
    selectChoice("launch", "none", true);
    renderAtBat();
    renderSprayChart();
  } else if (battedBallResults.has(els.resultSelect.value)) {
    if (game.atBat) game.atBat.pendingInPlay = true;
    if (els.contactSelect.value === "none") selectChoice("contact", "solid", true);
    if (els.launchSelect.value === "none") selectChoice("launch", "ld", true);
    renderAtBat();
  }
}

function applyBaseMovement(game, result, batterId = true) {
  const bases = game.bases;
  if (result === "HR") {
    game.bases = { first: false, second: false, third: false };
    return;
  }

  if (["1B", "2B", "3B"].includes(result)) {
    const move = Number(result.slice(0, 1));
    const occupied = [];
    if (isOccupied(bases.third)) occupied.push({ base: 3, runner: bases.third });
    if (isOccupied(bases.second)) occupied.push({ base: 2, runner: bases.second });
    if (isOccupied(bases.first)) occupied.push({ base: 1, runner: bases.first });
    const next = { first: false, second: false, third: false };
    occupied.forEach(({ base, runner }) => {
      const destination = base + move;
      if (destination === 1) next.first = runner;
      if (destination === 2) next.second = runner;
      if (destination === 3) next.third = runner;
    });
    if (move === 1) next.first = batterId;
    if (move === 2) next.second = batterId;
    if (move === 3) next.third = batterId;
    game.bases = next;
    return;
  }

  if (["BB", "HBP", "ROE"].includes(result)) {
    const next = { ...bases };
    if (isOccupied(next.first) && isOccupied(next.second)) next.third = next.second;
    if (isOccupied(next.first)) next.second = next.first;
    next.first = batterId;
    game.bases = next;
    return;
  }

  if (result === "FC") {
    game.bases = { ...bases, first: batterId };
    if (isOccupied(bases.first)) game.bases.second = false;
    return;
  }

  if (result === "SB") {
    if (isOccupied(bases.third)) return;
    if (isOccupied(bases.second)) {
      game.bases = { first: bases.first, second: false, third: bases.second };
    } else if (isOccupied(bases.first)) {
      game.bases = { first: false, second: bases.first, third: bases.third };
    }
    return;
  }

  if (result === "CS") {
    if (isOccupied(bases.third)) game.bases.third = false;
    else if (isOccupied(bases.second)) game.bases.second = false;
    else if (isOccupied(bases.first)) game.bases.first = false;
  }
}

function isOccupied(value) {
  return Boolean(value);
}

function baseKeyForSteal(target) {
  if (target === "second") return { from: "first", to: "second", label: "2B" };
  if (target === "third") return { from: "second", to: "third", label: "3B" };
  return { from: "third", to: "home", label: "Home" };
}

function recordSteal(target, outcome) {
  const game = activeGame();
  if (game.status !== "completed") game.status = "active";
  const steal = baseKeyForSteal(target);
  const runner = game.bases[steal.from];
  if (!isOccupied(runner)) return;
  if (steal.to !== "home" && isOccupied(game.bases[steal.to])) return;

  const snapshotBefore = {
    inning: game.inning,
    half: game.half,
    outs: game.outs,
    bases: { ...game.bases },
    batterIndex: game.batterIndex,
    score: { ...game.score },
    atBat: game.atBat ? cloneAtBat(game.atBat) : makeAtBat()
  };

  if (outcome === "safe") {
    game.bases[steal.from] = false;
    if (steal.to === "home") {
      if (game.half === "top") game.score.lions += 1;
      else game.score.opponent += 1;
    } else {
      game.bases[steal.to] = runner;
    }
  } else {
    game.bases[steal.from] = false;
    game.outs += 1;
  }

  const event = {
    id: uuid(),
    gameId: game.id,
    playerId: typeof runner === "string" ? runner : currentBatterId(game),
    result: outcome === "safe" ? "SB" : "CS",
    runs: outcome === "safe" && steal.to === "home" ? 1 : 0,
    rbi: 0,
    contact: "none",
    launch: "none",
    leverage: "neutral",
    inning: game.inning,
    half: game.half,
    outsBefore: snapshotBefore.outs,
    basesBefore: { ...snapshotBefore.bases },
    scope: game.half === "top" ? "offense" : "defense",
    note: `${outcome === "safe" ? "Safe steal of" : "Caught stealing"} ${steal.label}`,
    pitches: [],
    count: game.atBat ? `${game.atBat.balls}-${game.atBat.strikes}` : "0-0",
    spray: null,
    createdAt: new Date().toISOString(),
    snapshotBefore
  };
  game.events.push(event);
  if (game.outs >= 3) advanceHalf(game);
  saveState();
  render();
}

function logOpponentOutcome(result) {
  const game = activeGame();
  if (game.status !== "completed") game.status = "active";
  const rule = eventRules[result] || eventRules.GO;
  const batter = currentOpponentBatter(game);
  const pitcherId = currentPitcherId(game);
  const runs = opponentRunsForResult(game, result);
  const snapshotBefore = {
    inning: game.inning,
    half: game.half,
    outs: game.outs,
    bases: { ...game.bases },
    batterIndex: game.batterIndex,
    opponentBatterIndex: game.opponentBatterIndex || 0,
    score: { ...game.score },
    atBat: game.atBat ? cloneAtBat(game.atBat) : makeAtBat()
  };

  game.score.opponent += runs;
  applyBaseMovement(game, result, "opponent");
  if (rule.out) game.outs += 1;

  const event = {
    id: uuid(),
    gameId: game.id,
    playerId: `opp:${batter}`,
    opponentBatter: batter,
    result,
    runs,
    rbi: 0,
    contact: "none",
    launch: "none",
    leverage: "neutral",
    inning: game.inning,
    half: game.half,
    outsBefore: snapshotBefore.outs,
    basesBefore: { ...snapshotBefore.bases },
    scope: "defense",
    pitcherId,
    note: "Opponent plate appearance",
    pitches: game.atBat ? [...game.atBat.pitches] : [],
    count: game.atBat ? `${game.atBat.balls}-${game.atBat.strikes}` : "0-0",
    spray: null,
    createdAt: new Date().toISOString(),
    snapshotBefore
  };
  game.events.push(event);
  if (rule.pa) {
    game.opponentBatterIndex = nextOpponentBatterIndex(game);
    game.atBat = makeAtBat();
  }
  if (game.outs >= 3) advanceHalf(game);
  saveState();
  render();
}

function opponentRunsForResult(game, result) {
  const occupied = Object.values(game.bases).filter(Boolean).length;
  if (result === "HR") return occupied + 1;
  if (result === "3B") return occupied;
  if (result === "2B") return Number(Boolean(game.bases.second)) + Number(Boolean(game.bases.third));
  if (result === "1B") return Number(Boolean(game.bases.third));
  if (["BB", "HBP"].includes(result) && game.bases.first && game.bases.second && game.bases.third) return 1;
  return 0;
}

function advanceHalf(game) {
  game.outs = 0;
  game.bases = { first: false, second: false, third: false };
  game.atBat = makeAtBat();
  pendingSpray = null;
  if (game.half === "top") {
    game.half = "bottom";
  } else {
    game.half = "top";
    game.inning += 1;
  }
}

function undoLastPlay() {
  const game = activeGame();
  const event = game.events.pop();
  if (!event) return;
  if (event.snapshotBefore) {
    game.inning = event.snapshotBefore.inning;
    game.half = event.snapshotBefore.half;
    game.outs = event.snapshotBefore.outs;
    game.bases = { ...event.snapshotBefore.bases };
    game.batterIndex = event.snapshotBefore.batterIndex;
    game.opponentBatterIndex = event.snapshotBefore.opponentBatterIndex || game.opponentBatterIndex || 0;
    game.score = { ...event.snapshotBefore.score };
    game.atBat = cloneAtBat(event.snapshotBefore.atBat || makeAtBat());
    pendingSpray = event.spray || null;
  }
  saveState();
  render();
}

function startNewGame() {
  const game = makeGame("Opponent");
  state.games.push(game);
  state.activeGameId = game.id;
  pendingSpray = null;
  saveState();
  render();
}

function scheduleGame() {
  const opponent = els.opponentInput.value.trim() || "Opponent";
  const game = makeGame(opponent);
  game.date = els.gameDateInput.value || todayValue();
  game.location = els.gameLocationInput.value.trim();
  game.notes = els.gameNotesInput.value.trim();
  game.status = "scheduled";
  state.games.push(game);
  state.activeGameId = game.id;
  pendingSpray = null;
  saveState();
  render();
}

function scoreScheduledGame(gameId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return;
  game.status = game.status === "completed" ? "completed" : "active";
  state.activeGameId = game.id;
  pendingSpray = null;
  saveState();
  render();
  switchView("score");
}

function completeScheduledGame(gameId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return;
  game.status = "completed";
  saveState();
  render();
}

function finishGame() {
  const current = activeGame();
  current.status = "completed";
  pendingSpray = null;
  saveState();
  render();
  switchView("games");
}

function addPlayer() {
  const name = els.playerName.value.trim();
  if (!name) return;
  const player = makePlayer(
    uuid(),
    name,
    els.playerNumber.value.trim() || "--",
    els.playerPositions.value.trim() || "UTIL",
    els.playerBats.value,
    { contact: 50, power: 50, speed: 50, defense: 50 }
  );
  state.roster.push(player);
  state.lineup.push(player.id);
  els.playerForm.reset();
  els.playerBats.value = "R";
  saveState();
  render();
}

function render() {
  renderScoreboard();
  renderAtBat();
  renderRunnerTracker();
  renderSprayChart();
  renderBatterSelect();
  renderLiveLineup();
  renderPlayFeed();
  renderRoster();
  renderArchive();
  renderAnalysis();
  renderGames();
  renderSeasonStats();
  renderSubControls();
  renderLineupBuilder();
  renderStatsSprayControls();
  if (!optimizedIds.length) optimizedIds = buildOptimizedLineup();
  renderOptimizedLineup();
}

function renderScoreboard() {
  const game = activeGame();
  if (!game.atBat) game.atBat = makeAtBat();
  els.opponentInput.value = game.opponent;
  els.gameDateInput.value = game.date;
  els.gameLocationInput.value = game.location || "";
  els.gameNotesInput.value = game.notes || "";
  els.scoreOpponentLineupInput.value = (game.opponentLineup || []).join("\n");
  els.gameTitle.textContent = `Lions vs ${game.opponent}`;
  els.gameContext.textContent = `${game.half === "top" ? "Top" : "Bottom"} ${game.inning}, ${game.outs} ${game.outs === 1 ? "out" : "outs"}`;
  els.lionsScore.textContent = game.score.lions;
  els.opponentScore.textContent = game.score.opponent;
  els.bases.forEach((base) => {
    const key = base.dataset.base === "1" ? "first" : base.dataset.base === "2" ? "second" : "third";
    base.classList.toggle("is-filled", Boolean(game.bases[key]));
  });
}

function renderRunnerTracker() {
  const game = activeGame();
  const baseLabels = {
    first: "1B",
    second: "2B",
    third: "3B"
  };
  const occupied = [];
  els.runnerBases.forEach((baseEl) => {
    const key = baseEl.dataset.runnerBase;
    const runner = game.bases[key];
    const name = runnerName(runner);
    baseEl.classList.toggle("is-occupied", isOccupied(runner));
    baseEl.querySelector("span").textContent = name || "Empty";
    if (name) occupied.push(`${name} on ${baseLabels[key]}`);
  });
  els.runnerSummary.textContent = occupied.length ? occupied.join(" | ") : "Bases empty";
  const canStealSecond = isOccupied(game.bases.first) && !isOccupied(game.bases.second);
  const canStealThird = isOccupied(game.bases.second) && !isOccupied(game.bases.third);
  const canStealHome = isOccupied(game.bases.third);
  els.stealButtons.forEach((button) => {
    const target = button.dataset.steal;
    const enabled = target === "second" ? canStealSecond : target === "third" ? canStealThird : canStealHome;
    button.disabled = !enabled;
  });
}

function runnerName(runner) {
  if (!isOccupied(runner)) return "";
  const player = state.roster.find((item) => item.id === runner);
  if (player) return player.name.split(" ")[0];
  return runner === true ? "Runner" : "Opponent";
}

function renderAtBat() {
  const game = activeGame();
  if (!game.atBat) game.atBat = makeAtBat();
  const isOpponentHalf = game.half === "bottom";
  const currentPlayer = state.roster.find((player) => player.id === currentBatterId(game));
  els.currentBatterName.textContent = currentPlayer ? `#${currentPlayer.number} ${currentPlayer.name}` : "Current batter";
  els.currentBatterMeta.textContent = currentPlayer
    ? `${currentPlayer.positions} | ${game.half === "top" ? "Oakmont hitting" : "Opponent half"}`
    : "Set an active lineup to begin.";
  renderCurrentBatterSummary(game, currentPlayer);
  els.countDisplay.textContent = `${game.atBat.balls}-${game.atBat.strikes}`;
  const opponentBatter = currentOpponentBatter(game);
  renderPitcherSelect(game);
  els.opponentBatterName.textContent = opponentBatter;
  els.opponentBatterMeta.textContent = `${game.opponent} lineup | Batter ${(game.opponentBatterIndex || 0) + 1} of ${opponentLineup(game).length}`;
  renderOpponentBatterSummary(game, opponentBatter);
  els.opponentCountDisplay.textContent = `${game.atBat.balls}-${game.atBat.strikes}`;
  els.opponentOutsDisplay.textContent = `${game.outs} ${game.outs === 1 ? "out" : "outs"}`;
  els.opponentPitchTrail.innerHTML = game.atBat.pitches.length
    ? game.atBat.pitches
        .map((pitch, index) => `<span class="pitch-chip ${pitch.type}">${index + 1}. ${escapeHtml(pitch.label)}</span>`)
        .join("")
    : `<span class="player-meta">No pitches to this opponent hitter.</span>`;
  renderPitcherStatStrip(game);
  els.pitchTrail.innerHTML = game.atBat.pitches.length
    ? game.atBat.pitches
        .map((pitch, index) => `<span class="pitch-chip ${pitch.type}">${index + 1}. ${escapeHtml(pitch.label)}</span>`)
        .join("")
    : `<span class="player-meta">No pitches in this plate appearance.</span>`;
  els.abCard.classList.toggle("is-opponent", isOpponentHalf);
  els.scorerStack.classList.toggle("is-defense", isOpponentHalf);
  els.abCard.classList.toggle("is-outcome", !isOpponentHalf && Boolean(game.atBat.pendingInPlay));
  els.bipPanel.classList.toggle("is-visible", Boolean(game.atBat.pendingInPlay));
  els.scoreForm.classList.toggle("is-defense", isOpponentHalf);
  els.sprayChart.closest(".spray-panel").classList.toggle("is-defense", isOpponentHalf);
  if (!pendingSpray && !game.atBat.pendingInPlay) {
    els.sprayHint.textContent = "Tap the field after a ball is put in play.";
  }
}

function renderPitcherSelect(game = activeGame()) {
  const current = currentPitcherId(game);
  els.pitcherSelect.innerHTML = state.roster
    .map((player) => `<option value="${player.id}">#${escapeHtml(player.number)} ${escapeHtml(player.name)}</option>`)
    .join("");
  els.pitcherSelect.value = current;
}

function pitcherStats(playerId, gameId = null) {
  const stats = { pitches: 0, balls: 0, strikes: 0, batters: 0, outs: 0, h: 0, hr: 0, k: 0, bb: 0, hbp: 0, runs: 0 };
  state.games
    .filter((game) => !gameId || game.id === gameId)
    .flatMap((game) => game.events)
    .filter((event) => event.scope === "defense" && event.pitcherId === playerId)
    .forEach((event) => {
      const rule = eventRules[event.result] || {};
      stats.batters += rule.pa ? 1 : 0;
      stats.outs += rule.out ? 1 : 0;
      stats.h += rule.hit ? 1 : 0;
      stats.hr += event.result === "HR" ? 1 : 0;
      stats.k += event.result === "K" ? 1 : 0;
      stats.bb += event.result === "BB" ? 1 : 0;
      stats.hbp += event.result === "HBP" ? 1 : 0;
      stats.runs += event.runs || 0;
      (event.pitches || []).forEach((pitch) => {
        stats.pitches += 1;
        if (pitch.type === "ball") stats.balls += 1;
        if (["called_strike", "swinging_strike", "foul", "in_play"].includes(pitch.type)) stats.strikes += 1;
      });
    });
  stats.ip = stats.outs / 3;
  stats.strikeRate = divide(stats.strikes, stats.pitches);
  stats.kRate = divide(stats.k, stats.batters);
  stats.bbRate = divide(stats.bb, stats.batters);
  stats.kbb = stats.bb ? stats.k / stats.bb : stats.k;
  stats.k9 = divide(stats.k * 9, stats.ip);
  stats.r9 = divide(stats.runs * 9, stats.ip);
  stats.whip = divide(stats.bb + stats.h, stats.ip);
  stats.pitchesPerInning = divide(stats.pitches, stats.ip);
  return stats;
}

function renderPitcherStatStrip(game = activeGame()) {
  const stats = pitcherStats(currentPitcherId(game), game.id);
  els.pitcherStatStrip.innerHTML = [
    statCell("Pitches", stats.pitches),
    statCell("Balls", stats.balls),
    statCell("Strikes", stats.strikes),
    statCell("Strike %", `${Math.round(stats.strikeRate * 100)}%`)
  ].join("");
}

function renderCurrentBatterSummary(game, player) {
  if (!player) {
    els.batterSummary.innerHTML = `<div class="summary-chip"><strong>No batter</strong><span>Set lineup</span></div>`;
    return;
  }
  const events = game.events.filter((event) => event.scope === "offense" && event.playerId === player.id && eventRules[event.result]?.pa);
  els.batterSummary.innerHTML = batterSummaryMarkup(events, "First AB today");
}

function renderOpponentBatterSummary(game, batter) {
  const events = game.events.filter((event) => event.scope === "defense" && event.opponentBatter === batter && eventRules[event.result]?.pa);
  els.opponentBatterSummary.innerHTML = batterSummaryMarkup(events, "First AB for this hitter");
}

function batterSummaryMarkup(events, emptyLabel) {
  if (!events.length) {
    return `<div class="summary-chip"><strong>0 AB</strong><span>${escapeHtml(emptyLabel)}</span></div>`;
  }
  const hits = events.filter((event) => eventRules[event.result]?.hit).length;
  const reach = events.filter((event) => eventRules[event.result]?.reach).length;
  const last = [...events].slice(-3).map((event) => event.result).join(", ");
  return [
    `<div class="summary-chip"><strong>${events.length}</strong><span>PA today</span></div>`,
    `<div class="summary-chip"><strong>${hits}</strong><span>Hits</span></div>`,
    `<div class="summary-chip"><strong>${reach}</strong><span>Reached</span></div>`,
    `<div class="summary-chip"><strong>${escapeHtml(last)}</strong><span>Previous ABs</span></div>`
  ].join("");
}

function setSprayFromPointer(event) {
  if (activeGame().half === "bottom") return;
  const rect = els.sprayChart.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  setPendingSpray(x, y);
}

function setPendingSpray(x, y) {
  pendingSpray = {
    x: Math.max(4, Math.min(96, Math.round(x))),
    y: Math.max(4, Math.min(96, Math.round(y))),
    zone: sprayZone(x, y)
  };
  if (els.contactSelect.value === "none") selectChoice("contact", "solid", true);
  if (els.launchSelect.value === "none") selectChoice("launch", "ld", true);
  const game = activeGame();
  if (game.atBat) game.atBat.pendingInPlay = true;
  els.sprayHint.textContent = `Marked ${pendingSpray.zone}. Complete the AB to save it.`;
  renderAtBat();
  renderSprayChart();
}

function sprayZone(x, y) {
  if (y > 69) return x < 42 ? "Left infield" : x > 58 ? "Right infield" : "Middle infield";
  if (x < 35) return "Left field";
  if (x > 65) return "Right field";
  if (x < 46) return "Left-center";
  if (x > 54) return "Right-center";
  return "Center field";
}

function renderSprayChart() {
  const events = sprayEvents();
  const dots = events.map(renderSprayDot).join("");
  const pending = pendingSpray
    ? `<span class="spray-dot pending" style="left:${pendingSpray.x}%;top:${pendingSpray.y}%;" title="Pending ${escapeHtml(pendingSpray.zone)}">+</span>`
    : "";
  els.sprayMarkers.innerHTML = `${dots}${pending}`;
}

function sprayEvents() {
  const game = activeGame();
  const filter = els.sprayFilter.value;
  const currentHitterId = currentBatterId(game);
  return state.games
    .flatMap((item) => item.events.map((event) => ({ event, game: item })))
    .filter(({ event, game: item }) => {
      if (!event.spray) return false;
      const rule = eventRules[event.result] || {};
      if (filter === "hitter" && event.playerId !== currentHitterId) return false;
      if (filter === "team" && item.id !== game.id) return false;
      if (filter === "current" && item.id !== game.id) return false;
      if (filter === "hits" && !rule.hit) return false;
      if (filter === "outs" && !rule.out) return false;
      return true;
    });
}

function renderSprayDot({ event, game }) {
  const rule = eventRules[event.result];
  const player = state.roster.find((item) => item.id === event.playerId);
  const kind = rule.hit ? "hit" : "out";
  const title = `${player?.name || "Unknown"} ${rule.label} vs ${game.opponent} (${event.spray.zone})`;
  const label = rule.hit ? "H" : "O";
  return `<span class="spray-dot ${kind}" style="left:${event.spray.x}%;top:${event.spray.y}%;" title="${escapeHtml(title)}">${label}</span>`;
}

function renderBatterSelect() {
  const game = activeGame();
  if (game.half === "bottom") {
    els.batterSelect.innerHTML = `<option>${escapeHtml(currentOpponentBatter(game))}</option>`;
    return;
  }
  const entries = gameLineupEntries(game);
  const options = entries.map((entry, index) => {
    const player = state.roster.find((item) => item.id === entry.playerId);
    if (!player) return "";
    const label = `${index + 1}. #${player.number} ${player.name}`;
    return `<option value="${player.id}">${escapeHtml(label)}</option>`;
  });
  els.batterSelect.innerHTML = options.join("");
  const current = currentBatterId(game);
  if (current) els.batterSelect.value = current;
}

function renderLiveLineup() {
  const game = activeGame();
  if (game.half === "bottom") {
    const hitters = opponentLineup(game);
    els.lineupCount.textContent = `${hitters.length} hitters`;
    els.liveLineup.innerHTML = hitters
      .map((name, index) => {
        const current = index === (game.opponentBatterIndex || 0) ? " is-current" : "";
        return `<li class="${current}">
          <strong>${escapeHtml(name)}</strong>
          <div class="player-meta">${escapeHtml(game.opponent)} batting | Simple scoring</div>
        </li>`;
      })
      .join("");
    return;
  }
  const entries = gameLineupEntries(game);
  els.lineupCount.textContent = `${entries.length} active`;
  els.liveLineup.innerHTML = entries
    .map((entry, index) => {
      const player = state.roster.find((item) => item.id === entry.playerId);
      if (!player) return "";
      const stats = statsForPlayer(player.id);
      const current = index === game.batterIndex && game.half === "top" ? " is-current" : "";
      return `<li class="${current}">
        <strong>#${escapeHtml(player.number)} ${escapeHtml(player.name)}</strong>
        <div class="player-meta">${escapeHtml(entry.role)} | ${escapeHtml(player.positions)} | OPS ${formatRate(stats.ops)} | Contact ${Math.round(contactQuality(stats) * 100)}</div>
      </li>`;
    })
    .join("");
}

function renderSubControls() {
  const game = activeGame();
  if (game.half === "bottom") {
    els.subSpotSelect.innerHTML = "";
    els.subPlayerSelect.innerHTML = "";
    return;
  }
  const entries = gameLineupEntries(game);
  els.subSpotSelect.innerHTML = entries
    .map((entry, index) => {
      const player = state.roster.find((item) => item.id === entry.playerId);
      return `<option value="${entry.id}">${index + 1}. ${escapeHtml(player?.name || "Empty")} (${escapeHtml(entry.role)})</option>`;
    })
    .join("");
  const activeIds = new Set(entries.map((entry) => entry.playerId));
  els.subPlayerSelect.innerHTML = state.roster
    .map((player) => `<option value="${player.id}" ${activeIds.has(player.id) ? "disabled" : ""}>#${escapeHtml(player.number)} ${escapeHtml(player.name)}</option>`)
    .join("");
}

function applySubstitution() {
  const game = activeGame();
  const entryId = els.subSpotSelect.value;
  const playerId = els.subPlayerSelect.value;
  if (!entryId || !playerId) return;
  const type = els.subTypeSelect.value;
  game.lineupEntries = gameLineupEntries(game).map((entry) =>
    entry.id === entryId
      ? { ...entry, playerId, note: type === "ph" ? "Pinch hitter" : "Substitute" }
      : entry
  );
  game.events.push({
    id: uuid(),
    gameId: game.id,
    playerId,
    result: "SUB",
    runs: 0,
    rbi: 0,
    contact: "none",
    launch: "none",
    leverage: "neutral",
    inning: game.inning,
    half: game.half,
    outsBefore: game.outs,
    basesBefore: { ...game.bases },
    scope: "lineup",
    note: type === "ph" ? "Pinch hitter entered" : "Substitution entered",
    pitches: [],
    count: "0-0",
    spray: null,
    createdAt: new Date().toISOString(),
    snapshotBefore: {
      inning: game.inning,
      half: game.half,
      outs: game.outs,
      bases: { ...game.bases },
      batterIndex: game.batterIndex,
      opponentBatterIndex: game.opponentBatterIndex || 0,
      score: { ...game.score },
      atBat: game.atBat ? cloneAtBat(game.atBat) : makeAtBat()
    }
  });
  saveState();
  render();
}

function renderPlayFeed() {
  const game = activeGame();
  const recent = [...game.events].reverse().slice(0, 12);
  els.playCount.textContent = `${game.events.length} plays`;
  els.playFeed.innerHTML = recent.length
    ? recent
        .map((event) => {
          const player = state.roster.find((item) => item.id === event.playerId);
          const name = event.scope === "defense" ? event.opponentBatter || "Opponent batter" : player ? player.name : "Opponent";
          const scope = event.scope === "offense" ? "Lions" : "Opponent";
          const rule = eventRules[event.result] || { label: event.result };
          return `<article class="play-item">
            <strong>${escapeHtml(scope)} ${inningLabel(event)}: ${escapeHtml(name)} ${escapeHtml(rule.label)}</strong>
            <div class="play-meta">${event.pitches?.length || 0} pitches | Count ${escapeHtml(event.count || "0-0")} | Runs ${event.runs}, RBI ${event.rbi}</div>
            <div class="play-meta">${escapeHtml(contactLabels[event.contact] || event.contact)}, ${escapeHtml(launchLabels[event.launch] || event.launch)}${event.spray ? ` | ${escapeHtml(event.spray.zone)}` : ""}</div>
            ${event.note ? `<div class="play-meta">${escapeHtml(event.note)}</div>` : ""}
          </article>`;
        })
        .join("")
    : `<p class="player-meta">No plays yet. First pitch is waiting.</p>`;
}

function inningLabel(event) {
  return `${event.half === "top" ? "T" : "B"}${event.inning}`;
}

function renderRoster() {
  els.rosterGrid.innerHTML = "";
  state.roster.forEach((player) => {
    const stats = statsForPlayer(player.id);
    const node = els.playerTemplate.content.cloneNode(true);
    const card = node.querySelector(".player-card");
    card.dataset.playerId = player.id;
    node.querySelector(".number-pill").textContent = `#${player.number}`;
    node.querySelector("h3").textContent = player.name;
    node.querySelector("p").textContent = `${player.positions} | Bats ${player.bats}`;
    const activeToggle = node.querySelector(".active-toggle input");
    activeToggle.checked = state.lineup.includes(player.id);
    activeToggle.addEventListener("change", () => togglePlayerActive(player.id, activeToggle.checked));
    node.querySelector(".stat-strip").innerHTML = [
      statCell("AVG", formatRate(stats.avg)),
      statCell("OBP", formatRate(stats.obp)),
      statCell("SLG", formatRate(stats.slg)),
      statCell("OPS", formatRate(stats.ops))
    ].join("");

    node.querySelectorAll("[data-grade]").forEach((input) => {
      const grade = input.dataset.grade;
      input.value = player.grades[grade];
      input.addEventListener("input", () => {
        player.grades[grade] = Number(input.value);
        saveState();
        optimizedIds = buildOptimizedLineup();
        renderOptimizedLineup();
        renderValueBoard();
      });
    });
    els.rosterGrid.appendChild(node);
  });
}

function togglePlayerActive(playerId, isActive) {
  if (isActive && !state.lineup.includes(playerId)) state.lineup.push(playerId);
  if (!isActive) state.lineup = state.lineup.filter((id) => id !== playerId);
  state.roster = state.roster.map((player) => (player.id === playerId ? { ...player, active: isActive } : player));
  const game = activeGame();
  game.batterIndex = Math.min(game.batterIndex, Math.max(state.lineup.length - 1, 0));
  saveState();
  optimizedIds = buildOptimizedLineup();
  render();
}

function statCell(label, value) {
  return `<span>${label}<strong>${value}</strong></span>`;
}

function renderArchive() {
  const query = els.archiveSearch.value.trim().toLowerCase();
  const games = state.games
    .filter((game) => game.status === "completed" || game.events.length)
    .filter((game) => {
      if (!query) return true;
      const haystack = [
        game.opponent,
        game.date,
        ...game.events.flatMap((event) => {
          const player = state.roster.find((item) => item.id === event.playerId);
          return [player?.name, event.result, event.note, event.contact, event.launch, event.spray?.zone];
        })
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  els.archiveGrid.innerHTML = games.length
    ? games.map(renderArchiveCard).join("")
    : `<p class="player-meta">No games match that search.</p>`;
}

function renderArchiveCard(game) {
  const topEvents = game.events
    .filter((event) => event.scope !== "defense")
    .slice(-3)
    .reverse()
    .map((event) => {
      const player = state.roster.find((item) => item.id === event.playerId);
      return `<div class="archive-meta">${escapeHtml(player?.name || "Unknown")} ${escapeHtml(eventRules[event.result].label)} ${event.note ? `- ${escapeHtml(event.note)}` : ""}</div>`;
    })
    .join("");

  return `<article class="archive-card">
    <div class="archive-score">
      <span>${escapeHtml(game.date)}</span>
      <span>Oakmont ${game.score.lions} - ${game.score.opponent} ${escapeHtml(game.opponent)}</span>
    </div>
    <div class="archive-meta">${game.events.length} tracked events | ${game.status}</div>
    ${topEvents || `<div class="archive-meta">No offensive events logged.</div>`}
  </article>`;
}

function renderGames() {
  const activeId = activeGame().id;
  const sorted = [...state.games].sort((a, b) => {
    const dateCompare = (b.date || "").localeCompare(a.date || "");
    if (dateCompare) return dateCompare;
    return a.opponent.localeCompare(b.opponent);
  });
  els.gamesGrid.innerHTML = sorted
    .map((game) => {
      const active = game.id === activeId ? " is-active" : "";
      const score = game.events.length ? `Oakmont ${game.score.lions} - ${game.score.opponent} ${escapeHtml(game.opponent)}` : `Oakmont vs ${escapeHtml(game.opponent)}`;
      const status = game.status === "active" ? "Ready to score" : game.status;
      return `<article class="game-card${active}">
        <div>
          <span class="player-meta">${escapeHtml(game.date || "No date")} ${game.location ? `| ${escapeHtml(game.location)}` : ""}</span>
          <h3>${score}</h3>
        </div>
        <div class="archive-meta">${escapeHtml(status)} | ${game.events.length} tracked events</div>
        <div class="archive-meta">${opponentLineup(game).length} opponent hitters loaded</div>
        ${game.notes ? `<div class="archive-meta">${escapeHtml(game.notes)}</div>` : ""}
        <div class="game-actions">
          <button type="button" class="primary-action" data-game-action="score" data-game-id="${game.id}">${game.id === activeId ? "Continue Scoring" : "Score This Game"}</button>
          <button type="button" class="secondary-action" data-game-action="lineup" data-game-id="${game.id}">Lineup</button>
          <button type="button" class="secondary-action" data-game-action="complete" data-game-id="${game.id}">Mark Final</button>
        </div>
      </article>`;
    })
    .join("");
}

function openLineupBuilder(gameId) {
  lineupBuilderGameId = gameId;
  const game = state.games.find((item) => item.id === gameId);
  if (game && (!game.lineupEntries || !game.lineupEntries.length)) game.lineupEntries = makeLineupEntries(state.lineup);
  renderLineupBuilder();
}

function renderLineupBuilder() {
  const game = state.games.find((item) => item.id === lineupBuilderGameId);
  els.lineupBuilderPanel.classList.toggle("is-visible", Boolean(game));
  if (!game) return;
  els.lineupBuilderTitle.textContent = `Lineup vs ${game.opponent}`;
  els.lineupBuilderRows.innerHTML = gameLineupEntries(game)
    .map((entry, index) => `<div class="lineup-builder-row" data-lineup-entry="${entry.id}">
      <div class="lineup-order">${index + 1}</div>
      <label>Player ${playerSelectMarkup("data-lineup-player", entry.playerId)}</label>
      <label>Role ${roleSelectMarkup(entry.role)}</label>
      <button type="button" class="secondary-action" data-remove-lineup-entry="${entry.id}">Remove</button>
    </div>`)
    .join("");
}

function playerSelectMarkup(attributeName, selectedId = "") {
  return `<select ${attributeName}>${state.roster
    .map((player) => `<option value="${player.id}" ${player.id === selectedId ? "selected" : ""}>#${escapeHtml(player.number)} ${escapeHtml(player.name)}</option>`)
    .join("")}</select>`;
}

function roleSelectMarkup(selected = "EH") {
  const roles = ["C", "P", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "EH"];
  return `<select data-lineup-role>${roles.map((role) => `<option value="${role}" ${role === selected ? "selected" : ""}>${role}</option>`).join("")}</select>`;
}

function updateLineupEntry(entryId, playerId, role) {
  const game = state.games.find((item) => item.id === lineupBuilderGameId);
  if (!game) return;
  game.lineupEntries = gameLineupEntries(game).map((entry) => (entry.id === entryId ? { ...entry, playerId, role } : entry));
  saveState();
  renderLineupBuilder();
  if (game.id === activeGame().id) render();
}

function addLineupEntry() {
  const game = state.games.find((item) => item.id === lineupBuilderGameId);
  if (!game) return;
  const used = new Set(gameLineupPlayerIds(game));
  const player = state.roster.find((item) => !used.has(item.id)) || state.roster[0];
  if (!player) return;
  game.lineupEntries.push({ id: uuid(), playerId: player.id, role: defaultRoleForSpot(game.lineupEntries.length), active: true, note: "" });
  saveState();
  renderLineupBuilder();
}

function removeLineupEntry(entryId) {
  const game = state.games.find((item) => item.id === lineupBuilderGameId);
  if (!game) return;
  game.lineupEntries = gameLineupEntries(game).filter((entry) => entry.id !== entryId);
  game.batterIndex = Math.min(game.batterIndex, Math.max(game.lineupEntries.length - 1, 0));
  saveState();
  renderLineupBuilder();
  if (game.id === activeGame().id) render();
}

function resetBuilderLineup() {
  const game = state.games.find((item) => item.id === lineupBuilderGameId);
  if (!game) return;
  game.lineupEntries = makeLineupEntries(state.lineup);
  game.batterIndex = 0;
  saveState();
  renderLineupBuilder();
  if (game.id === activeGame().id) render();
}

function renderAnalysis() {
  const team = teamStats();
  els.metricsGrid.innerHTML = [
    metricCard("Team OPS", formatRate(team.ops), "OBP plus slugging from logged plate appearances."),
    metricCard("wOBA-lite", formatRate(team.woba), "Weighted offensive value using MLB-style event weights."),
    metricCard("Pitches/PA", team.pitchesPerPa.toFixed(2), "Plate discipline signal from pitch-by-pitch scoring."),
    metricCard("Hard-hit rate", `${Math.round(team.hardRate * 100)}%`, "Hard or barreled contact per batted ball."),
    metricCard("K rate", `${Math.round(team.kRate * 100)}%`, "Strikeouts per plate appearance."),
    metricCard("First-pitch strike", `${Math.round(team.firstPitchStrikeRate * 100)}%`, "How often the AB starts in a pitcher count.")
  ].join("");
  renderValueBoard();
}

function renderSeasonStats() {
  els.hittingStatsBody.innerHTML = state.roster
    .map((player) => {
      const hit = statsForPlayer(player.id);
      return `<tr>
        <td>#${escapeHtml(player.number)} ${escapeHtml(player.name)}</td>
        <td>${hit.pa}</td>
        <td>${formatRate(hit.avg)}</td>
        <td>${formatRate(hit.obp)}</td>
        <td>${formatRate(hit.slg)}</td>
        <td>${formatRate(hit.ops)}</td>
        <td>${hit.rbi}</td>
        <td>${hit.sb}</td>
        <td>${Math.round(hit.kRate * 100)}%</td>
      </tr>`;
    })
    .join("");
  els.pitchingStatsBody.innerHTML = state.roster
    .map((player) => {
      const pit = pitcherStats(player.id);
      return `<tr>
        <td>#${escapeHtml(player.number)} ${escapeHtml(player.name)}</td>
        <td>${formatInnings(pit.outs)}</td>
        <td>${pit.pitches}</td>
        <td>${pit.balls}</td>
        <td>${pit.strikes}</td>
        <td>${Math.round(pit.strikeRate * 100)}%</td>
        <td>${pit.batters}</td>
        <td>${pit.h}</td>
        <td>${pit.runs}</td>
        <td>${pit.bb}</td>
        <td>${pit.k}</td>
        <td>${Math.round(pit.kRate * 100)}%</td>
        <td>${Math.round(pit.bbRate * 100)}%</td>
        <td>${pit.kbb.toFixed(1)}</td>
        <td>${pit.k9.toFixed(1)}</td>
        <td>${pit.r9.toFixed(1)}</td>
        <td>${pit.whip.toFixed(2)}</td>
        <td>${pit.pitchesPerInning.toFixed(1)}</td>
      </tr>`;
    })
    .join("");
}

function renderStatsSprayControls() {
  const selectedPlayer = els.statsSprayPlayerSelect.value || state.roster[0]?.id || "";
  els.statsSprayPlayerSelect.innerHTML = state.roster
    .map((player) => `<option value="${player.id}" ${player.id === selectedPlayer ? "selected" : ""}>#${escapeHtml(player.number)} ${escapeHtml(player.name)}</option>`)
    .join("");
  const selectedGame = els.statsSprayGameSelect.value || "all";
  els.statsSprayGameSelect.innerHTML = [
    `<option value="all">All games</option>`,
    ...state.games
      .filter((game) => game.events.some((event) => event.spray))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((game) => `<option value="${game.id}" ${game.id === selectedGame ? "selected" : ""}>${escapeHtml(game.date)} vs ${escapeHtml(game.opponent)}</option>`)
  ].join("");
  if (selectedPlayer) els.statsSprayPlayerSelect.value = selectedPlayer;
  if ([...els.statsSprayGameSelect.options].some((option) => option.value === selectedGame)) els.statsSprayGameSelect.value = selectedGame;
  renderStatsSprayChart();
}

function renderStatsSprayChart() {
  const playerId = els.statsSprayPlayerSelect.value || state.roster[0]?.id;
  const gameId = els.statsSprayGameSelect.value || "all";
  const events = state.games
    .flatMap((game) => game.events.map((event) => ({ event, game })))
    .filter(({ event, game }) => event.spray && event.playerId === playerId && (gameId === "all" || game.id === gameId));
  els.statsSprayMarkers.innerHTML = events.length
    ? events.map(renderSprayDot).join("")
    : `<span class="spray-empty">No tracked batted balls</span>`;
}

function metricCard(label, value, copy) {
  return `<article class="metric-card">
    <span class="player-meta">${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    <div class="player-meta">${escapeHtml(copy)}</div>
  </article>`;
}

function renderValueBoard() {
  const ranked = state.roster
    .filter((player) => state.lineup.includes(player.id))
    .map((player) => ({ player, value: playerValue(player) }))
    .sort((a, b) => b.value - a.value);
  const max = Math.max(...ranked.map((item) => item.value), 1);
  els.valueBoard.innerHTML = ranked
    .map(({ player, value }) => {
      const pct = Math.max(8, Math.round((value / max) * 100));
      return `<div class="value-row">
        <div>
          <strong>${escapeHtml(player.name)}</strong>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        </div>
        <span>${Math.round(value)}</span>
      </div>`;
    })
    .join("");
}

function buildOptimizedLineup() {
  const candidates = state.roster
    .filter((player) => state.lineup.includes(player.id))
    .map((player) => {
      const stats = statsForPlayer(player.id);
      return {
        player,
        stats,
        overall: playerValue(player),
        obp: safeRate(stats.obp) * 100 + player.grades.contact * 0.35,
        power: safeRate(stats.slg) * 75 + player.grades.power,
        speed: player.grades.speed + stats.sb * 4 - stats.cs * 5,
        contact: (1 - safeRate(stats.kRate)) * 60 + contactQuality(stats) * 45 + player.grades.contact * 0.45
      };
    });

  const selected = [];
  const takeBest = (scorer) => {
    const remaining = candidates.filter((item) => !selected.includes(item.player.id));
    if (!remaining.length) return;
    remaining.sort((a, b) => scorer(b) - scorer(a));
    selected.push(remaining[0].player.id);
  };

  takeBest((item) => item.obp * 1.3 + item.speed + item.contact);
  takeBest((item) => item.obp * 1.2 + item.contact * 1.1);
  takeBest((item) => item.overall + item.contact + item.power * 0.5);
  takeBest((item) => item.power * 1.35 + item.overall);
  takeBest((item) => item.overall + item.power);

  candidates
    .filter((item) => !selected.includes(item.player.id))
    .sort((a, b) => b.overall - a.overall)
    .forEach((item) => selected.push(item.player.id));

  if (selected.length >= 9) {
    const lastThree = selected.slice(6).sort((a, b) => {
      const playerA = state.roster.find((player) => player.id === a);
      const playerB = state.roster.find((player) => player.id === b);
      return playerValue(playerB) + playerB.grades.speed * 0.25 - (playerValue(playerA) + playerA.grades.speed * 0.25);
    });
    return [...selected.slice(0, 6), ...lastThree];
  }
  return selected;
}

function renderOptimizedLineup() {
  if (!optimizedIds.length) optimizedIds = buildOptimizedLineup();
  const defensiveMap = assignDefense(optimizedIds);
  els.optimizerMode.textContent = `Weights ${els.runWeight.value}/${els.contactWeight.value}/${els.speedWeight.value}/${els.defenseWeight.value}`;
  els.optimizedLineup.innerHTML = optimizedIds
    .map((id) => {
      const player = state.roster.find((item) => item.id === id);
      if (!player) return "";
      const stats = statsForPlayer(id);
      const role = battingRole(optimizedIds.indexOf(id));
      return `<li>
        <strong>${escapeHtml(player.name)}</strong>
        <div class="player-meta">${role} | ${escapeHtml(defensiveMap[id] || "UTIL")} | OBP ${formatRate(stats.obp)} | SLG ${formatRate(stats.slg)} | Value ${Math.round(playerValue(player))}</div>
      </li>`;
    })
    .join("");
}

function battingRole(index) {
  const roles = ["Table setter", "Contact bridge", "Best all-around bat", "Run producer", "Damage support", "Pressure bat", "Defensive balance", "Second leadoff", "Turnover speed"];
  return roles[index] || "Depth matchup";
}

function assignDefense(ids) {
  const positions = ["C", "P", "SS", "CF", "2B", "3B", "1B", "LF", "RF"];
  const assignment = {};
  const used = new Set();
  positions.forEach((position) => {
    const best = ids
      .map((id) => state.roster.find((player) => player.id === id))
      .filter(Boolean)
      .filter((player) => !used.has(player.id))
      .filter((player) => player.positions.split(",").map((item) => item.trim()).includes(position))
      .sort((a, b) => b.grades.defense - a.grades.defense)[0];
    if (best) {
      assignment[best.id] = position;
      used.add(best.id);
    }
  });
  ids.forEach((id) => {
    if (!assignment[id]) assignment[id] = "UTIL";
  });
  return assignment;
}

function playerValue(player) {
  const stats = statsForPlayer(player.id);
  const weights = lineupWeights();
  const runCreation = safeRate(stats.obp) * 180 + safeRate(stats.slg) * 95 + safeRate(stats.woba) * 140 + stats.rbi * 2.5;
  const contact = (1 - safeRate(stats.kRate)) * 75 + contactQuality(stats) * 55 + player.grades.contact;
  const speed = player.grades.speed + stats.sb * 6 - stats.cs * 8;
  const defense = player.grades.defense;
  const clutch = stats.highLevPa ? (stats.highLevSuccess / stats.highLevPa) * 30 : 8;
  return runCreation * weights.run + contact * weights.contact + speed * weights.speed + defense * weights.defense + clutch;
}

function lineupWeights() {
  const raw = {
    run: Number(els.runWeight.value),
    contact: Number(els.contactWeight.value),
    speed: Number(els.speedWeight.value),
    defense: Number(els.defenseWeight.value)
  };
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0) || 1;
  return {
    run: raw.run / total,
    contact: raw.contact / total,
    speed: raw.speed / total,
    defense: raw.defense / total
  };
}

function allOffensiveEvents() {
  return state.games.flatMap((game) => game.events.filter((event) => event.scope !== "defense"));
}

function statsForPlayer(playerId) {
  const stats = emptyStats();
  allOffensiveEvents()
    .filter((event) => event.playerId === playerId)
    .forEach((event) => applyEventToStats(stats, event));
  finishStats(stats);
  return stats;
}

function teamStats() {
  const stats = emptyStats();
  allOffensiveEvents().forEach((event) => applyEventToStats(stats, event));
  finishStats(stats);
  return stats;
}

function emptyStats() {
  return {
    pa: 0,
    ab: 0,
    h: 0,
    singles: 0,
    doubles: 0,
    triples: 0,
    hr: 0,
    bb: 0,
    hbp: 0,
    k: 0,
    sac: 0,
    tb: 0,
    rbi: 0,
    sb: 0,
    cs: 0,
    bip: 0,
    hard: 0,
    barrel: 0,
    solid: 0,
    gb: 0,
    ld: 0,
    fb: 0,
    pu: 0,
    reach: 0,
    highLevPa: 0,
    highLevSuccess: 0,
    pitches: 0,
    balls: 0,
    calledStrikes: 0,
    swingingStrikes: 0,
    fouls: 0,
    inPlayPitches: 0,
    firstPitchStrikes: 0,
    firstPitchTrackedPa: 0
  };
}

function applyEventToStats(stats, event) {
  const rule = eventRules[event.result];
  if (!rule) return;
  if (rule.pa) stats.pa += 1;
  if (rule.ab) stats.ab += 1;
  if (rule.hit) stats.h += 1;
  if (event.result === "1B") stats.singles += 1;
  if (event.result === "2B") stats.doubles += 1;
  if (event.result === "3B") stats.triples += 1;
  if (event.result === "HR") stats.hr += 1;
  if (rule.bb) stats.bb += 1;
  if (rule.hbp) stats.hbp += 1;
  if (rule.k) stats.k += 1;
  if (rule.sac) stats.sac += 1;
  if (rule.sb) stats.sb += 1;
  if (rule.cs) stats.cs += 1;
  if (rule.reach) stats.reach += 1;
  stats.tb += rule.tb || 0;
  stats.rbi += event.rbi || 0;
  if (rule.bip) stats.bip += 1;
  if (event.contact === "hard") stats.hard += 1;
  if (event.contact === "barrel") {
    stats.hard += 1;
    stats.barrel += 1;
  }
  if (event.contact === "solid") stats.solid += 1;
  if (event.launch === "gb") stats.gb += 1;
  if (event.launch === "ld") stats.ld += 1;
  if (event.launch === "fb") stats.fb += 1;
  if (event.launch === "pu") stats.pu += 1;
  if (event.leverage === "high" && rule.pa) {
    stats.highLevPa += 1;
    if (rule.reach || event.rbi > 0 || event.result === "SAC") stats.highLevSuccess += 1;
  }
  const pitches = event.pitches || [];
  stats.pitches += pitches.length;
  pitches.forEach((pitch, index) => {
    if (pitch.type === "ball") stats.balls += 1;
    if (pitch.type === "called_strike") stats.calledStrikes += 1;
    if (pitch.type === "swinging_strike") stats.swingingStrikes += 1;
    if (pitch.type === "foul") stats.fouls += 1;
    if (pitch.type === "in_play") stats.inPlayPitches += 1;
    if (index === 0) {
      stats.firstPitchTrackedPa += 1;
      if (["called_strike", "swinging_strike", "foul", "in_play"].includes(pitch.type)) stats.firstPitchStrikes += 1;
    }
  });
}

function finishStats(stats) {
  stats.avg = divide(stats.h, stats.ab);
  stats.obp = divide(stats.h + stats.bb + stats.hbp, stats.ab + stats.bb + stats.hbp + stats.sac);
  stats.slg = divide(stats.tb, stats.ab);
  stats.ops = stats.obp + stats.slg;
  stats.babip = divide(stats.h - stats.hr, stats.ab - stats.k - stats.hr + stats.sac);
  stats.woba = divide(
    0.69 * stats.bb + 0.72 * stats.hbp + 0.89 * stats.singles + 1.27 * stats.doubles + 1.62 * stats.triples + 2.1 * stats.hr,
    stats.ab + stats.bb + stats.hbp + stats.sac
  );
  stats.kRate = divide(stats.k, stats.pa);
  stats.bbRate = divide(stats.bb, stats.pa);
  stats.hardRate = divide(stats.hard, stats.bip);
  stats.sbRate = divide(stats.sb, stats.sb + stats.cs);
  stats.highLevRate = divide(stats.highLevSuccess, stats.highLevPa);
  stats.pitchesPerPa = divide(stats.pitches, stats.pa);
  stats.firstPitchStrikeRate = divide(stats.firstPitchStrikes, stats.firstPitchTrackedPa);
}

function contactQuality(stats) {
  return divide(stats.solid * 0.55 + stats.hard * 0.95 + stats.barrel * 0.4, stats.bip);
}

function divide(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0;
  return numerator / denominator;
}

function safeRate(value) {
  return Number.isFinite(value) ? value : 0;
}

function formatRate(value) {
  const safe = safeRate(value);
  if (safe === 0) return ".000";
  return safe.toFixed(3).replace(/^0/, "");
}

function formatInnings(outs) {
  const whole = Math.floor(outs / 3);
  const remainder = outs % 3;
  return `${whole}.${remainder}`;
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `oakmont-lions-scorebook-${todayValue()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => {
        console.log("Service worker registered");
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}

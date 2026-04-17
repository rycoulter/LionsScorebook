const storage = window.ScorebookStorage || createFallbackScorebookStorage(window);

if (!window.ScorebookStorage) {
  window.ScorebookStorage = storage;
  console.warn("storage.js did not load; using bundled storage wrapper fallback.");
}

function createFallbackScorebookStorage(global) {
  const storageKey = "oakmont-lions-scorebook-v1";
  const libraryKey = "oakmont-lions-game-library-v1";

  function clone(value) {
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
      normalized.gamesById[game.id] = clone(game);
      if (!normalized.gameOrder.includes(game.id)) normalized.gameOrder.push(game.id);
    });

    Object.values(gamesById).forEach((game) => {
      if (!game?.id) return;
      normalized.gamesById[game.id] = clone(game);
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
      library.gamesById[game.id] = clone(game);
      if (!library.gameOrder.includes(game.id)) library.gameOrder.push(game.id);
    });
    library.activeGameId = activeGameId && library.gamesById[activeGameId] ? activeGameId : library.gameOrder[0] || "";
    return library;
  }

  function loadAppState() {
    try {
      const raw = global.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("Unable to load saved app state.", error);
      return null;
    }
  }

  function saveAppState(state) {
    global.localStorage.setItem(storageKey, JSON.stringify(state));
    return clone(state);
  }

  function loadLibrary() {
    try {
      const raw = global.localStorage.getItem(libraryKey);
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
    global.localStorage.setItem(libraryKey, JSON.stringify(normalized));
    return normalized;
  }

  function saveGame(game, setActive = true) {
    if (!game?.id) return loadLibrary();
    const library = loadLibrary();
    library.gamesById[game.id] = clone(game);
    if (!library.gameOrder.includes(game.id)) library.gameOrder.push(game.id);
    if (setActive || !library.activeGameId) library.activeGameId = game.id;
    return saveLibrary(library);
  }

  function loadGameById(gameId) {
    const library = loadLibrary();
    return library.gamesById[gameId] ? clone(library.gamesById[gameId]) : null;
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
    return clone(library.gamesById[gameId]);
  }

  function listGames() {
    const library = loadLibrary();
    return library.gameOrder.map((gameId) => clone(library.gamesById[gameId])).filter(Boolean);
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
        currentLibrary.gamesById[gameId] = clone(incomingLibrary.gamesById[gameId]);
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
    return clone(payload);
  }

  return {
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
}

const eventRules = {
  "1B": { label: "Single", pa: true, ab: true, hit: true, tb: 1, reach: true, bip: true },
  "2B": { label: "Double", pa: true, ab: true, hit: true, tb: 2, reach: true, bip: true },
  "3B": { label: "Triple", pa: true, ab: true, hit: true, tb: 3, reach: true, bip: true },
  HR: { label: "Home run", pa: true, ab: true, hit: true, tb: 4, reach: true, bip: true, hr: true },
  BB: { label: "Walk", pa: true, ab: false, bb: true, reach: true },
  HBP: { label: "Hit by pitch", pa: true, ab: false, hbp: true, reach: true },
  ROE: { label: "Reached on error", pa: true, ab: true, reach: true, bip: true, roe: true },
  FC: { label: "Fielder's choice", pa: true, ab: true, out: true, bip: true },
  DP: { label: "Double play", pa: true, ab: true, out: true, bip: true, dp: true },
  K: { label: "Strikeout", pa: true, ab: true, out: true, k: true },
  GO: { label: "Groundout", pa: true, ab: true, out: true, bip: true, launch: "gb" },
  FO: { label: "Flyout", pa: true, ab: true, out: true, bip: true, launch: "fb" },
  LO: { label: "Lineout", pa: true, ab: true, out: true, bip: true, launch: "ld" },
  SAC: { label: "Sacrifice", pa: true, ab: false, out: true, sac: true, bip: true },
  SB: { label: "Stolen base", pa: false, sb: true },
  CS: { label: "Caught stealing", pa: false, cs: true, out: true },
  TAG: { label: "Tag up", pa: false }
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

const defensivePositions = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

const battedBallResults = new Set(["1B", "2B", "3B", "HR", "ROE", "FC", "DP", "GO", "FO", "LO", "SAC"]);

const PITTSBURGH_NABA_URL = "https://www.pittsburghnaba.org/teams/?s=baseball&u=PITTSBURGHNABA";

const AA_SCOUTING_SNAPSHOT = {
  division: "AA",
  sourceUrl: PITTSBURGH_NABA_URL,
  sourceLabel: "Pittsburgh NABA AA listings",
  updatedLabel: "Official league snapshot",
  leagueLeaders: {
    hitters: [
      { name: "J. Desabato", team: "TUR", ab: 58, avg: ".638" },
      { name: "B. Hartz", team: "BAN", ab: 37, avg: ".595" },
      { name: "M. Demoss", team: "RRS", ab: 31, avg: ".581" },
      { name: "R. Devereaux", team: "KEY", ab: 61, avg: ".574" },
      { name: "S. Blackstone", team: "DUX", ab: 32, avg: ".562" }
    ],
    pitchers: [
      { name: "J. Dix", team: "PD2", w: 6, l: 1, k: 77, era: "0.94" },
      { name: "L. Carter", team: "BAN", w: 3, era: "1.01" },
      { name: "D. O'Brien", team: "KEY", w: 8, l: 1, k: 93, era: "1.17" },
      { name: "N. Riggle", team: "KEY", w: 4, l: 1, k: 51, era: "1.72" },
      { name: "M. Stanick", team: "BUC", w: 5, l: 1, k: 75, era: "1.97" }
    ]
  },
  teams: [
    {
      id: "key",
      name: "Keystone Oaks",
      code: "KEY",
      record: "21-2",
      points: 65,
      winPct: ".913",
      gb: "-",
      rf: 180,
      ra: 92,
      last10: "10-0",
      streak: "Won 18",
      url: "https://www.pittsburghnaba.org/teams/?u=PITTSBU-KEYSTONEOAKS",
      hitters: [
        { name: "R. Devereaux", pos: "1B", ab: 61, avg: ".574" },
        { name: "G. Sakely", pos: "SS", ab: 25, avg: ".440" },
        { name: "D. O'Brien", pos: "P", ab: 50, avg: ".360" },
        { name: "T. Klein", pos: "3B", ab: 31, avg: ".355" },
        { name: "T. Schuetz", pos: "LF", ab: 37, avg: ".351" }
      ],
      pitchers: [
        { name: "D. O'Brien", w: 8, l: 1, k: 93, era: "1.51" },
        { name: "N. Riggle", w: 4, l: 1, k: 51, era: "2.21" },
        { name: "J. Laporte", w: 5, l: 0, k: 27, era: "4.76" }
      ]
    },
    {
      id: "pd2",
      name: "Pittsburgh D2",
      code: "PD2",
      record: "14-9",
      points: 51,
      winPct: ".609",
      gb: "7",
      rf: 123,
      ra: 104,
      last10: "7-3",
      streak: "Lost 1",
      url: "https://www.pittsburghnaba.org/teams/?u=PITTSBU-PITTSBURGHD2",
      hitters: [
        { name: "N. Grice", pos: "3B", ab: 40, avg: ".500" },
        { name: "K. Ames", pos: "1B", ab: 63, avg: ".381" },
        { name: "N. Paul", pos: "RF", ab: 37, avg: ".351" },
        { name: "J. Hess", pos: "CF", ab: 63, avg: ".333" },
        { name: "M. Carpenter", pos: "P", ab: 27, avg: ".333" }
      ],
      pitchers: [
        { name: "J. Dix", w: 6, l: 1, k: 77, era: "0.94" },
        { name: "Z. Coukart", w: 1, l: 3, k: 21, era: "2.74" },
        { name: "J. Hess", w: 4, l: 2, k: 53, era: "3.86" }
      ]
    },
    {
      id: "dux",
      name: "South Oakland Ducks",
      code: "DUX",
      record: "13-11",
      points: 50,
      winPct: ".542",
      gb: "8.5",
      rf: 150,
      ra: 164,
      last10: "5-5",
      streak: "Lost 2",
      url: "https://www.pittsburghnaba.org/teams/?s=baseball&u=SOUTHOAKLANDDUCKS",
      hitters: [
        { name: "S. Blackstone", pos: "IF", ab: 32, avg: ".562" },
        { name: "M. Lombardi", pos: "RF", ab: 41, avg: ".439" },
        { name: "B. Gwin", pos: "CF", ab: 54, avg: ".426" },
        { name: "T. Morgan", pos: "OF", ab: 54, avg: ".426" },
        { name: "A. Defilippo", pos: "3B", ab: 57, avg: ".421" }
      ],
      pitchers: [
        { name: "B. Blackstone", w: 6, l: 3, k: 45, era: "2.91" },
        { name: "B. Welsh", w: 3, l: 4, k: 30, era: "3.52" }
      ]
    },
    {
      id: "buc",
      name: "Butler Buccos",
      code: "BUC",
      record: "13-10",
      points: 49,
      winPct: ".565",
      gb: "8",
      rf: 170,
      ra: 166,
      last10: "3-7",
      streak: "Lost 5",
      url: "https://www.pittsburghnaba.org/teams/?u=PITTSBU-BUTLERBUCCOS",
      hitters: [
        { name: "M. Stanick", pos: "CF", ab: 50, avg: ".480" },
        { name: "J. Domencic", pos: "LF", ab: 53, avg: ".472" },
        { name: "C. Carney", pos: "3B", ab: 24, avg: ".417" },
        { name: "A. Capizzi", pos: "2B", ab: 30, avg: ".367" },
        { name: "Z. Snyder", pos: "3B", ab: 41, avg: ".366" }
      ],
      pitchers: [
        { name: "M. Stanick", w: 5, l: 1, k: 75, era: "2.54" },
        { name: "P. O'Toole", w: 1, l: 1, k: 12, era: "2.57" },
        { name: "T. Botta", w: 3, l: 3, k: 36, era: "3.24" },
        { name: "C. Carney", w: 3, l: 0, k: 24, era: "4.67" }
      ]
    },
    {
      id: "shd",
      name: "South Hills Devils",
      code: "SHD",
      record: "13-9",
      points: 48,
      winPct: ".591",
      gb: "7.5",
      rf: 119,
      ra: 105,
      last10: "5-5",
      streak: "Won 4",
      url: "https://www.pittsburghnaba.org/teams/?p=home&s=baseball&u=PIT-SOUTHHILLSDEVILS",
      hitters: [
        { name: "A. Miles", pos: "P", ab: 59, avg: ".373" },
        { name: "R. Rodi", pos: "CF", ab: 65, avg: ".369" },
        { name: "B. Burnett", pos: "2B", ab: 55, avg: ".327" },
        { name: "O. Orona", pos: "LF", ab: 34, avg: ".324" },
        { name: "T. Arzenti", pos: "1B", ab: 51, avg: ".314" }
      ],
      pitchers: [
        { name: "H. Pincavitch", w: 4, l: 1, k: 28, era: "2.84" },
        { name: "A. Miles", w: 4, l: 5, k: 48, era: "4.49" }
      ]
    },
    {
      id: "ban",
      name: "BiscuitvilleTownSquare Bandidos",
      code: "BAN",
      record: "12-6-1",
      points: 43,
      winPct: ".658",
      gb: "6.5",
      rf: 116,
      ra: 56,
      last10: "7-2-1",
      streak: "Won 2",
      url: "https://www.pittsburghnaba.org/teams/default.asp?u=BAKERYSQUAREBANDIDOS&s=baseball&p=stats",
      statsUrl: "https://www.pittsburghnaba.org/teams/default.asp?u=BAKERYSQUAREBANDIDOS&s=baseball&p=stats",
      hitters: [
        { name: "B. Hartz", pos: "-", ab: 37, avg: ".595" }
      ],
      pitchers: [
        { name: "L. Carter", w: 3, era: "1.01" }
      ]
    },
    {
      id: "tur",
      name: "Bauerstown Turtles",
      code: "TUR",
      record: "10-12",
      points: 42,
      winPct: ".455",
      gb: "10.5",
      rf: 148,
      ra: 129,
      last10: "6-4",
      streak: "Won 2",
      url: "https://www.pittsburghnaba.org/teams/default.asp?p=home&s=baseball&u=BAUERSTOWNTURTLES",
      hitters: [
        { name: "J. Desabato", pos: "CF", ab: 58, avg: ".638" },
        { name: "E. Walsh", pos: "SS", ab: 57, avg: ".491" },
        { name: "A. Cugini", pos: "CF", ab: 40, avg: ".425" },
        { name: "P. Perman", pos: "2B", ab: 42, avg: ".381" },
        { name: "B. Driscoll", pos: "1B", ab: 35, avg: ".371" }
      ],
      pitchers: [
        { name: "M. Brooks", w: 3, l: 1, k: 25, era: "3.69" },
        { name: "P. Perman", w: 2, l: 2, k: 19, era: "5.25" },
        { name: "K. Ford", w: 2, l: 3, k: 13, era: "7.00" },
        { name: "E. Walsh", w: 2, l: 4, k: 24, era: "8.97" }
      ]
    },
    {
      id: "sse",
      name: "South Side Eagles",
      code: "SSE",
      record: "8-16",
      points: 40,
      winPct: ".333",
      gb: "13.5",
      rf: 160,
      ra: 191,
      last10: "3-7",
      streak: "Won 1",
      url: "https://www.pittsburghnaba.org/teams/?s=baseball&u=PITT-SOUTHSIDEEAGLES",
      hitters: [
        { name: "A. Lardo", pos: "CF", ab: 78, avg: ".449" },
        { name: "R. Saari", pos: "P", ab: 27, avg: ".444" },
        { name: "J. McAuliffe", pos: "P", ab: 79, avg: ".354" },
        { name: "E. Carey", pos: "P", ab: 77, avg: ".338" },
        { name: "J. Panek", pos: "OF", ab: 76, avg: ".316" }
      ],
      pitchers: [
        { name: "J. Seymour", w: 4, l: 2, k: 52, era: "2.12" },
        { name: "N. Belinsky", w: 2, l: 1, k: 19, era: "5.36" },
        { name: "A. Pannunzio", w: 2, l: 8, k: 44, era: "6.95" },
        { name: "E. Carey", w: 1, l: 2, k: 43, era: "7.61" }
      ]
    },
    {
      id: "rrs",
      name: "Ross Raiders",
      code: "RRS",
      record: "2-21-1",
      points: 28,
      winPct: ".104",
      gb: "19",
      rf: 81,
      ra: 209,
      last10: "0-10",
      streak: "Lost 13",
      url: PITTSBURGH_NABA_URL,
      hitters: [
        { name: "M. Demoss", pos: "-", ab: 31, avg: ".581" }
      ],
      pitchers: []
    }
  ]
};

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
let gameEditId = null;
let pendingRunnerOutBases = [];
let hittingSort = { key: "ops", direction: "desc" };
let pitchingSort = { key: "outs", direction: "desc" };
let statsSprayExpanded = false;
let rosterFilter = "active";
let scoutingData = null;
let selectedScoutingTeamId = "";
let scoutingRefreshState = "snapshot";
let scoutingStatusMessage = "Using Pittsburgh NABA AA snapshot.";
let scorebookGameId = "";
let bipOutcomeChosen = false;
let awaitingSprayLocation = false;
let awaitingRunnerDecision = false;
let scoringStep = "pitch";
let pendingRunnerChoices = {};
let pendingOutType = "";
let pendingOutFielder = "";

const els = {
  tabs: [...document.querySelectorAll(".tab")],
  views: [...document.querySelectorAll(".view")],
  homeScoreGameBtn: document.getElementById("homeScoreGameBtn"),
  homeRecord: document.getElementById("homeRecord"),
  homeRunSummary: document.getElementById("homeRunSummary"),
  homeMatchupImage: document.getElementById("homeMatchupImage"),
  homeNextGame: document.getElementById("homeNextGame"),
  homeNextGameMeta: document.getElementById("homeNextGameMeta"),
  homeScoutingBtn: document.getElementById("homeScoutingBtn"),
  homeGamesBtn: document.getElementById("homeGamesBtn"),
  homeBattingLeaders: document.getElementById("homeBattingLeaders"),
  homePitchingLeaders: document.getElementById("homePitchingLeaders"),
  homeUpcomingGames: document.getElementById("homeUpcomingGames"),
  gameTitle: document.getElementById("gameTitle"),
  headerBatterDisplay: document.getElementById("headerBatterDisplay"),
  headerCountDisplay: document.getElementById("headerCountDisplay"),
  gameContext: document.getElementById("gameContext"),
  inningStateDisplay: document.getElementById("inningStateDisplay"),
  outsStateDisplay: document.getElementById("outsStateDisplay"),
  lionsScore: document.getElementById("lionsScore"),
  opponentScore: document.getElementById("opponentScore"),
  bases: [...document.querySelectorAll(".base")],
  scorerStack: document.getElementById("scorerStack"),
  currentBatterName: document.getElementById("currentBatterName"),
  currentBatterMeta: document.getElementById("currentBatterMeta"),
  batterSummary: document.getElementById("batterSummary"),
  countDisplay: document.getElementById("countDisplay"),
  currentOutsDisplay: document.getElementById("currentOutsDisplay"),
  pitchButtons: [...document.querySelectorAll("[data-pitch]")],
  autoResultButtons: [...document.querySelectorAll("[data-auto-result]")],
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
  runnerPlayControls: document.getElementById("runnerPlayControls"),
  runnerOutButtons: [...document.querySelectorAll("[data-runner-out-base]")],
  resolvePlayBtn: document.querySelector("[data-resolve-play]"),
  scoringStepPanel: document.getElementById("scoringStepPanel"),
  scoringStepEyebrow: document.getElementById("scoringStepEyebrow"),
  scoringStepTitle: document.getElementById("scoringStepTitle"),
  scoringStepHint: document.getElementById("scoringStepHint"),
  scoringStepBody: document.getElementById("scoringStepBody"),
  panelUndoPitchBtn: document.getElementById("panelUndoPitchBtn"),
  scoreForm: document.getElementById("scoreForm"),
  choiceButtons: [...document.querySelectorAll("[data-choice-group]")],
  gameForm: document.getElementById("gameForm"),
  scheduleGameBtn: document.getElementById("scheduleGameBtn"),
  gamesGrid: document.getElementById("gamesGrid"),
  scorebookGameSelect: document.getElementById("scorebookGameSelect"),
  scorebookGameMeta: document.getElementById("scorebookGameMeta"),
  scorebookHead: document.getElementById("scorebookHead"),
  scorebookBody: document.getElementById("scorebookBody"),
  opponentScorebookHead: document.getElementById("opponentScorebookHead"),
  opponentScorebookBody: document.getElementById("opponentScorebookBody"),
  lineupBuilderPanel: document.getElementById("lineupBuilderPanel"),
  lineupBuilderTitle: document.getElementById("lineupBuilderTitle"),
  lineupBuilderRows: document.getElementById("lineupBuilderRows"),
  addLineupSpotBtn: document.getElementById("addLineupSpotBtn"),
  resetGameLineupBtn: document.getElementById("resetGameLineupBtn"),
  closeLineupBuilderBtn: document.getElementById("closeLineupBuilderBtn"),
  opponentInput: document.getElementById("opponentInput"),
  gameDateInput: document.getElementById("gameDateInput"),
  gameTimeInput: document.getElementById("gameTimeInput"),
  gameLocationInput: document.getElementById("gameLocationInput"),
  gameNotesInput: document.getElementById("gameNotesInput"),
  batterSelect: document.getElementById("batterSelect"),
  resultSelect: document.getElementById("resultSelect"),
  runsInput: document.getElementById("runsInput"),
  rbiInput: document.getElementById("rbiInput"),
  contactSelect: document.getElementById("contactSelect"),
  launchSelect: document.getElementById("launchSelect"),
  errorFielderSelect: document.getElementById("errorFielderSelect"),
  autoScorePreview: document.getElementById("autoScorePreview"),
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
  rosterFilter: document.getElementById("rosterFilter"),
  rosterFilterSummary: document.getElementById("rosterFilterSummary"),
  rosterGrid: document.getElementById("rosterGrid"),
  archiveSearch: document.getElementById("archiveSearch"),
  archiveGrid: document.getElementById("archiveGrid"),
  metricsGrid: document.getElementById("metricsGrid"),
  gameBreakdown: document.getElementById("gameBreakdown"),
  valueBoard: document.getElementById("valueBoard"),
  leadersGrid: document.getElementById("leadersGrid"),
  hittingStatsBody: document.getElementById("hittingStatsBody"),
  pitchingStatsBody: document.getElementById("pitchingStatsBody"),
  recordSummary: document.getElementById("recordSummary"),
  gameEditPanel: document.getElementById("gameEditPanel"),
  gameEditTitle: document.getElementById("gameEditTitle"),
  editOpponentInput: document.getElementById("editOpponentInput"),
  editDateInput: document.getElementById("editDateInput"),
  editTimeInput: document.getElementById("editTimeInput"),
  editLocationInput: document.getElementById("editLocationInput"),
  editNotesInput: document.getElementById("editNotesInput"),
  saveGameEditBtn: document.getElementById("saveGameEditBtn"),
  closeGameEditBtn: document.getElementById("closeGameEditBtn"),
  toggleStatsSprayBtn: document.getElementById("toggleStatsSprayBtn"),
  statsSprayPanel: document.getElementById("statsSprayPanel"),
  statsSprayPlayerSelect: document.getElementById("statsSprayPlayerSelect"),
  statsSprayGameSelect: document.getElementById("statsSprayGameSelect"),
  statsSprayMarkers: document.getElementById("statsSprayMarkers"),
  scoutingTeamSelect: document.getElementById("scoutingTeamSelect"),
  refreshScoutingBtn: document.getElementById("refreshScoutingBtn"),
  scoutingSourceStatus: document.getElementById("scoutingSourceStatus"),
  scoutingReport: document.getElementById("scoutingReport"),
  exportBtn: document.getElementById("exportBtn"),
  playerTemplate: document.getElementById("playerCardTemplate")
};

bindEvents();
initializeScoutingReport();
render();

function makePlayer(id, name, number, positions, bats, grades) {
  return { id, name, number, positions, bats, active: true, grades };
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function createId(prefix = "id") {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function uuid() {
  return createId();
}

function deepClone(value) {
  if (value === undefined || value === null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
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

function lineupEntriesFromRoster(playerIds = []) {
  return makeLineupEntries(playerIds).map((entry, index) => ({
    ...entry,
    order: index + 1
  }));
}

function opponentLineupEntries(names = []) {
  return names.map((name, index) => ({
    id: createId("opp"),
    name,
    order: index + 1,
    active: true
  }));
}

function emptyBases(value = null) {
  return { first: value, second: value, third: value };
}

function createGame(options = {}) {
  const config = typeof options === "string" ? { opponent: options } : options;
  const opponent = config.opponent || "Wildcats";
  const awayLineup = config.awayLineup || config.lineupEntries || lineupEntriesFromRoster(defaultRoster.filter((player) => player.active).map((player) => player.id));
  const homeLineup = config.homeLineup || opponentLineupEntries(config.opponentLineup || []);
  const batterId = awayLineup[0]?.playerId || awayLineup[0]?.id || "";
  const pitcherId = config.pitcherId || batterId;

  return {
    id: config.id || createId("game"),
    opponent,
    date: config.date || todayValue(),
    time: config.time || "",
    location: config.location || "",
    notes: config.notes || "",
    status: config.status || "active",
    teams: {
      away: { id: "oakmont-lions", name: "Oakmont Lions" },
      home: { id: "opponent", name: opponent }
    },
    lineups: {
      away: deepClone(awayLineup),
      home: deepClone(homeLineup)
    },
    current: {
      inning: config.inning ?? 1,
      half: config.half || "top",
      outs: config.outs ?? 0,
      balls: 0,
      strikes: 0,
      batterId,
      pitcherId,
      runners: emptyBases()
    },
    inning: config.inning ?? 1,
    half: config.half || "top",
    outs: config.outs ?? 0,
    bases: emptyBases(false),
    batterIndex: config.batterIndex ?? 0,
    lineupEntries: deepClone(awayLineup),
    opponentBatterIndex: config.opponentBatterIndex ?? 0,
    opponentLineup: homeLineup.map((entry) => entry.name),
    pitcherId,
    score: {
      lions: config.score?.lions ?? config.score?.away ?? 0,
      opponent: config.score?.opponent ?? config.score?.home ?? 0,
      away: config.score?.away ?? config.score?.lions ?? 0,
      home: config.score?.home ?? config.score?.opponent ?? 0
    },
    plateAppearances: [],
    currentPlateAppearanceId: "",
    substitutions: [],
    events: [],
    atBat: makeAtBat()
  };
}

function makeGame(opponent = "Wildcats") {
  return createGame({ opponent });
}

function makeUniqueGame(options = {}) {
  const existingIds = new Set(state?.games?.map((game) => game.id) || []);
  let game = createGame(options);
  while (existingIds.has(game.id)) {
    game = createGame({ ...(typeof options === "string" ? { opponent: options } : options), id: createId("game") });
  }
  return game;
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
    const library = storage.loadLibrary();
    const parsed = storage.loadAppState();
    const hasAppState = parsed?.roster && parsed?.lineup;
    const nextState = hasAppState
      ? parsed
      : {
          ...seedState(),
          games: []
        };
    if (library.gameOrder.length) {
      nextState.games = library.gameOrder.map((gameId) => library.gamesById[gameId]).filter(Boolean);
      nextState.activeGameId = library.activeGameId || nextState.games[0]?.id || "";
    } else if (!nextState.games?.length && !hasAppState) {
      const seeded = seedState();
      nextState.games = seeded.games;
      nextState.activeGameId = seeded.activeGameId;
      storage.saveLibrary(buildGameLibraryFromGames(nextState.games, nextState.activeGameId));
    }
    if (!nextState.roster || !nextState.games || !nextState.lineup) return seedState();
    const normalized = normalizeState(nextState);
    const activeFromLibrary = normalized.games.find((game) => game.id === library.activeGameId);
    if (activeFromLibrary) normalized.activeGameId = activeFromLibrary.id;
    if (!normalized.activeGameId && normalized.games.length) normalized.activeGameId = normalized.games[0].id;
    return normalized;
  } catch (error) {
    console.warn("Unable to load saved scorebook.", error);
    return seedState();
  }
}

function normalizeState(nextState) {
  nextState.games = nextState.games.map((game) => normalizeGame(game, nextState));
  return nextState;
}

function normalizeGame(game, nextState = state) {
  const lineupSource = game.lineups?.away || game.lineupEntries || makeLineupEntries(nextState.lineup || []);
  const homeSource = game.lineups?.home || opponentLineupEntries(game.opponentLineup || []);
  const lineupEntries = lineupSource.map((entry, index) => ({
    id: entry.id || createId("lineup"),
    playerId: entry.playerId || entry.id || "",
    role: entry.role || defaultRoleForSpot(index),
    order: entry.order || index + 1,
    active: entry.active !== false,
    note: entry.note || ""
  }));
  const homeLineup = homeSource.map((entry, index) => ({
    id: entry.id || createId("opp"),
    name: entry.name || String(entry),
    order: entry.order || index + 1,
    active: entry.active !== false
  }));
  const atBat = game.atBat || makeAtBat();
  const score = {
    lions: game.score?.lions ?? game.score?.away ?? 0,
    opponent: game.score?.opponent ?? game.score?.home ?? 0,
    away: game.score?.away ?? game.score?.lions ?? 0,
    home: game.score?.home ?? game.score?.opponent ?? 0
  };
  const normalized = {
    ...game,
    opponent: game.opponent || game.teams?.home?.name || "Opponent",
    time: game.time || "",
    location: game.location || "",
    notes: game.notes || "",
    status: game.status || "active",
    teams: {
      away: game.teams?.away || { id: "oakmont-lions", name: "Oakmont Lions" },
      home: { id: game.teams?.home?.id || "opponent", name: game.opponent || game.teams?.home?.name || "Opponent" }
    },
    lineups: {
      away: lineupEntries,
      home: homeLineup
    },
    inning: game.inning ?? game.current?.inning ?? 1,
    half: game.half ?? game.current?.half ?? "top",
    outs: game.outs ?? game.current?.outs ?? 0,
    bases: game.bases || game.current?.runners || emptyBases(false),
    batterIndex: game.batterIndex ?? 0,
    lineupEntries,
    opponentBatterIndex: game.opponentBatterIndex ?? 0,
    opponentLineup: homeLineup.map((entry) => entry.name),
    pitcherId: game.pitcherId || game.current?.pitcherId || "",
    score,
    atBat: {
      ...makeAtBat(),
      ...atBat,
      pitches: normalizePitchTrail(atBat.pitches || [])
    },
    events: (game.events || []).map((event) => ({
      ...event,
      pitches: normalizePitchTrail(event.pitches || []),
      spray: event.spray || event.result?.sprayChart || null
    })),
    substitutions: game.substitutions || []
  };
  normalized.current = {
    inning: normalized.inning,
    half: normalized.half,
    outs: normalized.outs,
    balls: normalized.atBat.balls ?? game.current?.balls ?? 0,
    strikes: normalized.atBat.strikes ?? game.current?.strikes ?? 0,
    batterId: game.current?.batterId || "",
    pitcherId: normalized.pitcherId,
    runners: deepClone(normalized.bases)
  };
  normalized.plateAppearances = normalizePlateAppearances(game.plateAppearances, normalized);
  normalized.currentPlateAppearanceId = game.currentPlateAppearanceId || "";
  syncGameCurrent(normalized);
  return normalized;
}

function normalizePlateAppearances(plateAppearances, game) {
  if (plateAppearances && plateAppearances.length) {
    return plateAppearances.map((appearance) => ({
      id: appearance.id || createId("pa"),
      gameId: appearance.gameId || game.id,
      inning: appearance.inning ?? game.inning,
      half: appearance.half || game.half,
      battingSide: appearance.battingSide || (appearance.half === "bottom" ? "home" : "away"),
      batterId: appearance.batterId || appearance.playerId || "",
      pitcherId: appearance.pitcherId || "",
      basesBefore: appearance.basesBefore || emptyBases(false),
      pitches: normalizePitchTrail(appearance.pitches || []),
      result: normalizePlateAppearanceResult(appearance.result),
      basesAfter: appearance.basesAfter || null,
      outsBefore: appearance.outsBefore ?? 0,
      outsAfter: appearance.outsAfter ?? appearance.outsBefore ?? 0,
      runsScored: appearance.runsScored ?? 0,
      startedAt: appearance.startedAt || appearance.createdAt || new Date().toISOString(),
      completedAt: appearance.completedAt || null
    }));
  }
  return (game.events || [])
    .filter((event) => eventRules[event.result]?.pa)
    .map((event) => ({
      id: event.plateAppearanceId || createId("pa"),
      gameId: game.id,
      inning: event.inning,
      half: event.half,
      battingSide: event.half === "bottom" ? "home" : "away",
      batterId: event.playerId,
      pitcherId: event.pitcherId || "",
      basesBefore: event.basesBefore || emptyBases(false),
      pitches: normalizePitchTrail(event.pitches || []),
      result: normalizePlateAppearanceResult({
        type: event.result,
        rbi: event.rbi || 0,
        contact: event.contact || "none",
        launch: event.launch || "none",
        sprayChart: event.spray || null,
        errorOnPlay: event.errorOnPlay || event.result === "ROE",
        errorFielderPosition: event.errorFielderPosition || "",
        runnerAdvancements: event.runnerAdvancements || [],
        notes: event.note || ""
      }),
      basesAfter: event.basesAfter || null,
      outsBefore: event.outsBefore ?? 0,
      outsAfter: event.outsAfter ?? event.outsBefore ?? 0,
      runsScored: event.runs ?? 0,
      startedAt: event.createdAt || new Date().toISOString(),
      completedAt: event.createdAt || null
    }));
}

function normalizePlateAppearanceResult(result) {
  if (!result) return null;
  const type = result.type || result.result || "";
  const rule = eventRules[type] || {};
  return {
    type,
    hit: Boolean(result.hit ?? rule.hit),
    officialAtBat: Boolean(result.officialAtBat ?? rule.ab),
    errorOnPlay: Boolean(result.errorOnPlay ?? type === "ROE"),
    errorFielderPosition: result.errorFielderPosition || "",
    rbi: result.rbi ?? 0,
    outsRecorded: result.outsRecorded ?? (rule.out ? 1 : 0),
    contact: result.contact || "none",
    launch: result.launch || rule.launch || "none",
    sprayChart: result.sprayChart || null,
    fieldedBy: result.fieldedBy || "",
    runnerAdvancements: result.runnerAdvancements || [],
    notes: result.notes || ""
  };
}

function normalizePitchTrail(pitches = []) {
  let balls = 0;
  let strikes = 0;
  return pitches.map((pitch, index) => {
    const outcome = pitch.outcome || pitch.type || "ball";
    const ballsBefore = pitch.ballsBefore ?? balls;
    const strikesBefore = pitch.strikesBefore ?? strikes;
    const next = nextPitchCount(ballsBefore, strikesBefore, outcome);
    balls = pitch.ballsAfter ?? next.balls;
    strikes = pitch.strikesAfter ?? next.strikes;
    return {
      id: pitch.id || createId("pitch"),
      pitchNumber: pitch.pitchNumber || index + 1,
      ballsBefore,
      strikesBefore,
      outcome,
      ballsAfter: balls,
      strikesAfter: strikes,
      inPlay: Boolean(pitch.inPlay ?? outcome === "in_play"),
      type: outcome,
      label: pitch.label || pitchLabels[outcome] || outcome,
      countBefore: pitch.countBefore || `${ballsBefore}-${strikesBefore}`,
      createdAt: pitch.createdAt || new Date().toISOString()
    };
  });
}

function nextPitchCount(ballsBefore, strikesBefore, outcome) {
  let balls = ballsBefore;
  let strikes = strikesBefore;
  if (outcome === "ball") balls = Math.min(4, balls + 1);
  if (outcome === "called_strike" || outcome === "swinging_strike") strikes = Math.min(3, strikes + 1);
  if (outcome === "foul" && strikes < 2) strikes += 1;
  return { balls, strikes };
}

function emptyGameLibrary() {
  return storage.emptyLibrary();
}

function buildGameLibraryFromGames(games = [], activeGameId = "") {
  return storage.buildLibraryFromGames(games, activeGameId);
}

function normalizeGameLibrary(library) {
  return storage.normalizeLibrary(library);
}

function loadGameLibrary() {
  return storage.loadLibrary();
}

function saveGameLibrary(library) {
  return storage.saveLibrary(library);
}

function saveGameToLibrary(game, setActive = true) {
  return storage.saveGame(game, setActive);
}

function loadGameById(gameId) {
  return storage.loadGameById(gameId);
}

function loadActiveGame() {
  return storage.getActiveGame();
}

function listSavedGames() {
  return storage.listGames();
}

function setActiveGame(gameId) {
  const game = storage.setActiveGame(gameId);
  if (!game) return null;
  if (typeof state !== "undefined") state.activeGameId = gameId;
  return game;
}

function deleteGame(gameId) {
  const saved = storage.deleteGame(gameId);
  if (typeof state !== "undefined") {
    state.games = state.games.filter((game) => game.id !== gameId);
    state.activeGameId = saved.activeGameId;
    storage.saveAppState(state);
  }
  return saved;
}

function clearGameLibrary() {
  const library = storage.saveLibrary(emptyGameLibrary());
  if (typeof state !== "undefined") {
    state.games = [];
    state.activeGameId = "";
    storage.saveAppState(state);
  }
  return library;
}

function exportGameAsJson(game) {
  if (game?.id && storage.loadGameById(game.id)) return storage.exportGame(game.id);
  return JSON.stringify(deepClone(game), null, 2);
}

function importGameFromText(jsonText, setActive = false) {
  const imported = storage.importGameFromText(jsonText, setActive);
  if (typeof state !== "undefined") {
    const library = storage.loadLibrary();
    state.games = library.gameOrder.map((gameId) => normalizeGame(library.gamesById[gameId], state)).filter(Boolean);
    state.activeGameId = library.activeGameId;
    saveState();
  }
  return imported;
}

function importGameFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file selected."));
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("error", () => reject(reader.error || new Error("Unable to read game file.")));
    reader.addEventListener("load", () => {
      try {
        resolve(importGameFromText(String(reader.result || ""), true));
      } catch (error) {
        reject(error);
      }
    });
    reader.readAsText(file);
  });
}

function exportSeasonAsJson(library = loadGameLibrary()) {
  return JSON.stringify(storage.normalizeLibrary(library), null, 2);
}

function saveState() {
  if (state?.games?.length) {
    state.games = state.games.map((game) => normalizeGame(game, state));
    const activeGameObject = state.games.find((game) => game.id === state.activeGameId);
    if (activeGameObject) storage.saveGame(activeGameObject, true);
    const library = buildGameLibraryFromGames(state.games, state.activeGameId);
    storage.saveLibrary(library);
  }
  storage.saveAppState(state);
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });
  els.homeScoreGameBtn.addEventListener("click", openCurrentGameForScoring);
  els.homeGamesBtn.addEventListener("click", () => switchView("games"));
  els.homeScoutingBtn.addEventListener("click", openNextGameScouting);
  els.homeUpcomingGames?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-home-scout-opponent]");
    if (!button) return;
    openScoutingForOpponent(button.dataset.homeScoutOpponent);
  });
  els.scorebookGameSelect.addEventListener("change", () => {
    scorebookGameId = els.scorebookGameSelect.value;
    renderTraditionalScorebook();
  });

  els.scoreForm.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  els.scoringStepPanel.addEventListener("click", handleScoringPanelClick);
  els.panelUndoPitchBtn.addEventListener("click", undoPitch);

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
    if (button.dataset.gameAction === "edit") openGameEditor(button.dataset.gameId);
    if (button.dataset.gameAction === "delete") removeScheduledGame(button.dataset.gameId);
  });

  els.closeGameEditBtn.addEventListener("click", () => {
    gameEditId = null;
    renderGameEditor();
  });

  els.saveGameEditBtn.addEventListener("click", saveGameEdits);

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
    button.addEventListener("click", () => {
      const group = button.dataset.choiceGroup;
      const value = button.dataset.choiceValue;
      if (group === "result") {
        if (battedBallResults.has(value)) {
          applyEvent(activeGame(), { type: "ball_in_play", outcome: value });
          return;
        }
        applyEvent(activeGame(), { type: "resolve_play", result: value });
        return;
      }
      selectChoice(group, value);
    });
  });

  els.stealButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyEvent(activeGame(), {
        type: button.dataset.stealResult === "out" ? "runner_out" : "runner_advance",
        mode: "steal",
        target: button.dataset.steal
      });
    });
  });

  els.runnerOutButtons.forEach((button) => {
    button.addEventListener("click", () => applyEvent(activeGame(), { type: "runner_out", base: button.dataset.runnerOutBase }));
  });
  els.resolvePlayBtn?.addEventListener("click", () => applyEvent(activeGame(), { type: "resolve_play" }));

  els.opponentOutcomeButtons.forEach((button) => {
    button.addEventListener("click", () => applyEvent(activeGame(), { type: "resolve_play", result: button.dataset.opponentResult }));
  });

  [els.opponentInput, els.gameDateInput, els.gameTimeInput, els.gameLocationInput, els.gameNotesInput]
    .forEach((input) => input.addEventListener("input", () => {
      input.dataset.dirty = "true";
    }));

  els.scoreOpponentLineupInput.addEventListener("input", () => {
    updateOpponentLineup(els.scoreOpponentLineupInput.value);
  });

  els.liveLineup.addEventListener("blur", (event) => {
    const item = event.target.closest("[data-opponent-lineup-index]");
    if (item) updateOpponentLineupName(Number(item.dataset.opponentLineupIndex), "value" in item ? item.value.trim() : item.textContent.trim());
  }, true);

  els.liveLineup.addEventListener("keydown", (event) => {
    const item = event.target.closest("[data-opponent-lineup-index]");
    if (!item) return;
    if (event.key === "Enter") {
      event.preventDefault();
      item.blur();
    }
  });

  els.pitcherSelect.addEventListener("change", () => {
    activeGame().pitcherId = els.pitcherSelect.value;
    saveState();
    renderAtBat();
  });

  els.pitchButtons.forEach((button) => {
    button.addEventListener("click", () => applyEvent(activeGame(), { type: "pitch", outcome: button.dataset.pitch }));
  });
  els.autoResultButtons.forEach((button) => {
    button.addEventListener("click", () => applyEvent(activeGame(), { type: "resolve_play", result: button.dataset.autoResult }));
  });

  els.resetCountBtn.addEventListener("click", () => {
    const game = activeGame();
    game.atBat = makeAtBat();
    const plateAppearance = getCurrentPlateAppearance(game, false);
    if (plateAppearance) plateAppearance.pitches = [];
    if (game.current) {
      game.current.balls = 0;
      game.current.strikes = 0;
    }
    clearPendingPlayState(game, true);
    resetBipChoices();
    saveState();
    renderAtBat();
    renderSprayChart();
    renderScoringStepPanel();
  });

  els.undoPitchBtn.addEventListener("click", undoPitch);
  els.resetOpponentCountBtn.addEventListener("click", () => {
    const game = activeGame();
    game.atBat = makeAtBat();
    const plateAppearance = getCurrentPlateAppearance(game, false);
    if (plateAppearance) plateAppearance.pitches = [];
    if (game.current) {
      game.current.balls = 0;
      game.current.strikes = 0;
    }
    saveState();
    renderAtBat();
    renderScoringStepPanel();
  });
  els.undoOpponentPitchBtn.addEventListener("click", undoPitch);
  els.clearBipBtn.addEventListener("click", () => {
    const game = activeGame();
    if (game.atBat) game.atBat.pendingInPlay = false;
    clearPendingPlayState(game, true);
    resetBipChoices();
    saveState();
    renderAtBat();
    renderSprayChart();
    renderScoringStepPanel();
  });
  els.scorerStack.addEventListener("pointerdown", setSprayFromPointer);
  els.sprayChart.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      applyEvent(activeGame(), { type: "spray", x: 50, y: 45 });
    }
  });
  els.sprayFilter.addEventListener("change", renderSprayChart);
  els.batterSelect.addEventListener("change", () => {
    renderBatterSelect();
  });
  els.resultSelect.addEventListener("change", suggestRunValues);
  els.newGameBtn.addEventListener("click", () => switchView("games"));
  els.undoBtn.addEventListener("click", undoLastPlay);
  els.endHalfBtn.addEventListener("click", () => {
    advanceHalfInning(activeGame());
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
    game.lineups.away = deepClone(game.lineupEntries);
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

  els.rosterFilter.addEventListener("change", () => {
    rosterFilter = els.rosterFilter.value;
    renderRoster();
  });

  els.rosterGrid.addEventListener("change", (event) => {
    const input = event.target.closest("[data-player-edit]");
    if (!input) return;
    const card = event.target.closest("[data-player-id]");
    if (!card) return;
    updatePlayerIdentity(card.dataset.playerId, input.dataset.playerEdit, input.value);
  });

  els.archiveSearch.addEventListener("input", renderArchive);
  els.applySubBtn.addEventListener("click", applySubstitution);
  els.statsSprayPlayerSelect.addEventListener("change", renderStatsSprayChart);
  els.statsSprayGameSelect.addEventListener("change", renderStatsSprayChart);
  els.toggleStatsSprayBtn.addEventListener("click", () => {
    statsSprayExpanded = !statsSprayExpanded;
    renderStatsSprayControls();
  });
  els.scoutingTeamSelect.addEventListener("change", () => {
    selectedScoutingTeamId = els.scoutingTeamSelect.value;
    renderScoutingReport();
    refreshScoutingData({ silent: true });
  });
  els.refreshScoutingBtn.addEventListener("click", () => refreshScoutingData());
  document.querySelectorAll("[data-hit-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.hitSort;
      hittingSort = {
        key,
        direction: hittingSort.key === key && hittingSort.direction === "desc" ? "asc" : "desc"
      };
      renderSeasonStats();
    });
  });
  document.querySelectorAll("[data-pit-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.pitSort;
      pitchingSort = {
        key,
        direction: pitchingSort.key === key && pitchingSort.direction === "desc" ? "asc" : "desc"
      };
      renderSeasonStats();
    });
  });
  els.exportBtn.addEventListener("click", exportData);
}

function switchView(view) {
  els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  els.views.forEach((panel) => panel.classList.toggle("is-visible", panel.dataset.panel === view));
}

function activeGame() {
  let game = state.games.find((item) => item.id === state.activeGameId);
  if (!game) {
    game = makeUniqueGame({ opponent: "Opponent" });
    state.games.push(game);
    state.activeGameId = game.id;
    saveGameToLibrary(game, true);
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
  if (!game.lineups) game.lineups = { away: [], home: opponentLineupEntries(game.opponentLineup || []) };
  game.lineups.away = deepClone(game.lineupEntries);
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

function defaultOpponentNames() {
  return ["Batter 1", "Batter 2", "Batter 3", "Batter 4", "Batter 5", "Batter 6", "Batter 7", "Batter 8", "Batter 9"];
}

function opponentLineupEntriesForGame(game = activeGame()) {
  if (!game.lineups) game.lineups = { away: deepClone(game.lineupEntries || []), home: [] };
  const sourceEntries = Array.isArray(game.lineups.home) && game.lineups.home.length
    ? game.lineups.home
    : opponentLineupEntries(game.opponentLineup?.length ? game.opponentLineup : defaultOpponentNames());
  const entries = sourceEntries.map((entry, index) => {
    const name = String(entry.name || game.opponentLineup?.[index] || `Batter ${index + 1}`).trim() || `Batter ${index + 1}`;
    return {
      id: entry.id || createId("opp"),
      name,
      order: index + 1,
      active: entry.active !== false
    };
  });
  game.lineups.home = entries;
  game.opponentLineup = entries.map((entry) => entry.name);
  return entries;
}

function opponentLineup(game = activeGame()) {
  return opponentLineupEntriesForGame(game).map((entry) => entry.name);
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
  if (!game.lineups) game.lineups = { away: deepClone(game.lineupEntries || []), home: [] };
  game.lineups.home = opponentLineupEntries(game.opponentLineup);
  game.opponentBatterIndex = Math.min(game.opponentBatterIndex || 0, Math.max(game.opponentLineup.length - 1, 0));
  saveState();
  renderAtBat();
  renderLiveLineup();
  renderGames();
}

function updateOpponentLineupName(index, name) {
  const game = activeGame();
  const entries = opponentLineupEntriesForGame(game);
  if (!name) name = `Batter ${index + 1}`;
  while (entries.length <= index) {
    entries.push({ id: createId("opp"), name: `Batter ${entries.length + 1}`, order: entries.length + 1, active: true });
  }
  entries[index] = { ...entries[index], name, order: index + 1, active: true };
  game.lineups.home = entries;
  game.opponentLineup = entries.map((entry) => entry.name);
  els.scoreOpponentLineupInput.value = game.opponentLineup.join("\n");
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

function battingSide(game = activeGame()) {
  return game.half === "bottom" ? "home" : "away";
}

function currentBatterModelId(game = activeGame()) {
  return battingSide(game) === "away" ? currentBatterId(game) : `opp:${currentOpponentBatter(game)}`;
}

function syncGameCurrent(game = activeGame()) {
  if (!game.current) game.current = {};
  if (!game.atBat) game.atBat = makeAtBat();
  game.current.inning = game.inning ?? game.current.inning ?? 1;
  game.current.half = game.half ?? game.current.half ?? "top";
  game.current.outs = game.outs ?? game.current.outs ?? 0;
  game.current.balls = game.atBat.balls ?? 0;
  game.current.strikes = game.atBat.strikes ?? 0;
  game.current.batterId = currentBatterModelId(game);
  game.current.pitcherId = game.pitcherId || game.current.pitcherId || "";
  game.current.runners = deepClone(game.bases || game.current.runners || emptyBases(false));
  if (game.score) {
    game.score.away = game.score.lions ?? game.score.away ?? 0;
    game.score.home = game.score.opponent ?? game.score.home ?? 0;
  }
  return game.current;
}

function commitCurrentToLegacy(game = activeGame()) {
  if (!game.current) return;
  game.inning = game.current.inning;
  game.half = game.current.half;
  game.outs = game.current.outs;
  game.bases = deepClone(game.current.runners);
  game.pitcherId = game.current.pitcherId || game.pitcherId;
  if (!game.atBat) game.atBat = makeAtBat();
  game.atBat.balls = game.current.balls;
  game.atBat.strikes = game.current.strikes;
  if (game.score) {
    game.score.lions = game.score.away ?? game.score.lions ?? 0;
    game.score.opponent = game.score.home ?? game.score.opponent ?? 0;
  }
}

function startPlateAppearance(game = activeGame(), batterId = currentBatterModelId(game), pitcherId = currentPitcherId(game)) {
  syncGameCurrent(game);
  const active = getCurrentPlateAppearance(game, false);
  if (active && !active.result) return active;
  const plateAppearance = {
    id: createId("pa"),
    gameId: game.id,
    inning: game.current.inning,
    half: game.current.half,
    battingSide: battingSide(game),
    batterId,
    pitcherId,
    basesBefore: deepClone(game.current.runners),
    pitches: [],
    result: null,
    basesAfter: null,
    outsBefore: game.current.outs,
    outsAfter: game.current.outs,
    runsScored: 0,
    startedAt: new Date().toISOString(),
    completedAt: null
  };
  if (!game.plateAppearances) game.plateAppearances = [];
  game.plateAppearances.push(plateAppearance);
  game.currentPlateAppearanceId = plateAppearance.id;
  return plateAppearance;
}

function getCurrentPlateAppearance(game = activeGame(), createIfMissing = true) {
  const current = (game.plateAppearances || []).find((appearance) => appearance.id === game.currentPlateAppearanceId);
  if (current && !current.result) return current;
  if (!createIfMissing) return null;
  return startPlateAppearance(game);
}

function recordPitch(game = activeGame(), outcome) {
  syncGameCurrent(game);
  const plateAppearance = getCurrentPlateAppearance(game);
  const ballsBefore = game.current.balls;
  const strikesBefore = game.current.strikes;
  const next = nextPitchCount(ballsBefore, strikesBefore, outcome);
  const pitch = {
    id: createId("pitch"),
    pitchNumber: plateAppearance.pitches.length + 1,
    ballsBefore,
    strikesBefore,
    outcome,
    ballsAfter: next.balls,
    strikesAfter: next.strikes,
    inPlay: outcome === "in_play",
    type: outcome,
    label: pitchLabels[outcome] || outcome,
    countBefore: `${ballsBefore}-${strikesBefore}`,
    createdAt: new Date().toISOString()
  };
  plateAppearance.pitches.push(pitch);
  game.current.balls = next.balls;
  game.current.strikes = next.strikes;
  if (!game.atBat) game.atBat = makeAtBat();
  game.atBat.balls = next.balls;
  game.atBat.strikes = next.strikes;
  game.atBat.pitches.push(pitch);
  if (pitch.inPlay) game.atBat.pendingInPlay = true;
  commitCurrentToLegacy(game);
  return pitch;
}

function applyRunnerAdvancements(game = activeGame(), runnerAdvancements = []) {
  syncGameCurrent(game);
  const runners = deepClone(game.current.runners || emptyBases(false));
  let runsScored = 0;
  let outsRecorded = 0;
  runnerAdvancements.forEach((advancement) => {
    const from = advancement.from || null;
    const to = advancement.to || null;
    const runnerId = advancement.runnerId || (from && runners[from]) || null;
    if (from && runners[from] === runnerId) runners[from] = false;
    if (advancement.remove) return;
    if (advancement.out) {
      outsRecorded += 1;
      return;
    }
    if (to === "home") {
      runsScored += 1;
      return;
    }
    if (to && Object.prototype.hasOwnProperty.call(runners, to)) runners[to] = runnerId;
  });
  game.current.runners = runners;
  game.bases = deepClone(runners);
  return { runners, runsScored, outsRecorded };
}

function finalizePlateAppearance(game = activeGame(), resultInput = {}) {
  syncGameCurrent(game);
  const plateAppearance = getCurrentPlateAppearance(game);
  const type = resultInput.type || resultInput.result || "GO";
  const rule = eventRules[type] || eventRules.GO;
  if (resultInput.pitcherId) plateAppearance.pitcherId = resultInput.pitcherId;
  const runnerAdvancements = resultInput.runnerAdvancements || defaultRunnerAdvancements(game, type, plateAppearance.batterId);
  const movement = applyRunnerAdvancements(game, runnerAdvancements);
  const runsScored = resultInput.runsScored ?? movement.runsScored;
  const outsRecorded = resultInput.outsRecorded ?? (rule.out ? 1 : 0) + movement.outsRecorded;
  const rbi = resultInput.rbi ?? 0;
  const snapshotBefore = resultInput.snapshotBefore || {
    inning: plateAppearance.inning,
    half: plateAppearance.half,
    outs: plateAppearance.outsBefore,
    bases: deepClone(plateAppearance.basesBefore),
    batterIndex: game.batterIndex,
    opponentBatterIndex: game.opponentBatterIndex || 0,
    score: deepClone(game.score),
    atBat: cloneAtBat(game.atBat || makeAtBat())
  };

  if (game.current.half === "top") {
    game.score.lions += runsScored;
    game.score.away = game.score.lions;
  } else {
    game.score.opponent += runsScored;
    game.score.home = game.score.opponent;
  }
  game.current.outs += outsRecorded;
  commitCurrentToLegacy(game);

  const result = normalizePlateAppearanceResult({
    type,
    hit: Boolean(rule.hit),
    officialAtBat: Boolean(rule.ab),
    errorOnPlay: resultInput.errorOnPlay ?? type === "ROE",
    errorFielderPosition: resultInput.errorFielderPosition || "",
    rbi,
    outsRecorded,
    contact: resultInput.contact || "none",
    launch: resultInput.launch || rule.launch || "none",
    sprayChart: resultInput.sprayChart || null,
    fieldedBy: resultInput.fieldedBy || "",
    runnerAdvancements,
    notes: resultInput.notes || ""
  });
  plateAppearance.result = result;
  plateAppearance.basesAfter = deepClone(game.current.runners);
  plateAppearance.outsAfter = game.current.outs;
  plateAppearance.runsScored = runsScored;
  plateAppearance.completedAt = new Date().toISOString();
  const lastPitch = plateAppearance.pitches[plateAppearance.pitches.length - 1];

  const event = {
    id: createId("event"),
    plateAppearanceId: plateAppearance.id,
    gameId: game.id,
    playerId: plateAppearance.batterId,
    opponentBatter: game.half === "bottom" ? currentOpponentBatter(game) : undefined,
    result: type,
    runs: runsScored,
    rbi,
    contact: result.contact,
    launch: result.launch,
    leverage: "neutral",
    inning: plateAppearance.inning,
    half: plateAppearance.half,
    outsBefore: plateAppearance.outsBefore,
    outsAfter: plateAppearance.outsAfter,
    basesBefore: deepClone(plateAppearance.basesBefore),
    basesAfter: deepClone(plateAppearance.basesAfter),
    scope: plateAppearance.half === "top" ? "offense" : "defense",
    pitcherId: plateAppearance.pitcherId,
    note: result.notes,
    pitches: deepClone(plateAppearance.pitches),
    count: `${lastPitch?.ballsAfter ?? 0}-${lastPitch?.strikesAfter ?? 0}`,
    spray: result.sprayChart,
    fieldedBy: result.fieldedBy,
    errorOnPlay: result.errorOnPlay,
    errorFielderPosition: result.errorFielderPosition,
    runnerAdvancements: deepClone(result.runnerAdvancements),
    createdAt: plateAppearance.completedAt,
    snapshotBefore
  };
  if (!game.events) game.events = [];
  game.events.push(event);

  if (rule.pa) {
    if (plateAppearance.half === "top") game.batterIndex = nextBatterIndex(game.batterIndex);
    if (plateAppearance.half === "bottom") game.opponentBatterIndex = nextOpponentBatterIndex(game);
  }
  game.current.balls = 0;
  game.current.strikes = 0;
  game.atBat = makeAtBat();
  game.currentPlateAppearanceId = "";
  if (game.current.outs >= 3) advanceHalfInning(game);
  else syncGameCurrent(game);
  return plateAppearance;
}

function defaultRunnerAdvancements(game, result, batterId) {
  return getDefaultRunnerAdvances(result, {
    ...(game.current?.runners || game.bases || emptyBases(false)),
    batter: batterId
  }).advancements;
}

function getDefaultRunnerAdvances(outcome, currentBaseState = {}) {
  const bases = deepClone({
    first: currentBaseState.first || false,
    second: currentBaseState.second || false,
    third: currentBaseState.third || false
  });
  const batterId = currentBaseState.batter || "batter";
  const normalized = normalizeBallInPlayOutcome(outcome);
  const baseNumber = { first: 1, second: 2, third: 3 };
  const baseName = { 1: "first", 2: "second", 3: "third" };
  const occupied = [
    ["third", bases.third],
    ["second", bases.second],
    ["first", bases.first]
  ].filter(([, runner]) => isOccupied(runner));
  const decisions = {};

  const setDecision = (from, runnerId, to, automatic = true) => {
    decisions[from] = {
      runnerId,
      from,
      to,
      automatic,
      out: to === "out",
      scored: to === "home"
    };
  };

  if (normalized === "HR") {
    occupied.forEach(([from, runner]) => setDecision(from, runner, "home"));
    setDecision("batter", batterId, "home");
  } else if (["1B", "2B", "3B"].includes(normalized)) {
    const move = Number(normalized.slice(0, 1));
    occupied.forEach(([from, runner]) => {
      const destination = baseNumber[from] + move;
      setDecision(from, runner, destination > 3 ? "home" : baseName[destination]);
    });
    setDecision("batter", batterId, baseName[move]);
  } else if (normalized === "ROE") {
    occupied.forEach(([from, runner]) => {
      const destination = baseNumber[from] + 1;
      setDecision(from, runner, destination > 3 ? "home" : baseName[destination]);
    });
    setDecision("batter", batterId, "first");
  } else if (["BB", "HBP"].includes(normalized)) {
    if (isOccupied(bases.third) && isOccupied(bases.second) && isOccupied(bases.first)) setDecision("third", bases.third, "home");
    else if (isOccupied(bases.third)) setDecision("third", bases.third, "hold");
    if (isOccupied(bases.second) && isOccupied(bases.first)) setDecision("second", bases.second, "third");
    else if (isOccupied(bases.second)) setDecision("second", bases.second, "hold");
    if (isOccupied(bases.first)) setDecision("first", bases.first, "second");
    setDecision("batter", batterId, "first");
  } else if (normalized === "FC") {
    if (isOccupied(bases.first)) setDecision("first", bases.first, "out");
    occupied.forEach(([from, runner]) => {
      if (!decisions[from]) setDecision(from, runner, "hold");
    });
    setDecision("batter", batterId, "first");
  } else if (normalized === "DP") {
    const outBase = isOccupied(bases.first) ? "first" : isOccupied(bases.second) ? "second" : isOccupied(bases.third) ? "third" : null;
    occupied.forEach(([from, runner]) => setDecision(from, runner, from === outBase ? "out" : "hold"));
    setDecision("batter", batterId, "out");
  } else {
    occupied.forEach(([from, runner]) => setDecision(from, runner, "hold"));
    setDecision("batter", batterId, "out");
  }

  const basesAfter = emptyBases(false);
  let runsScored = 0;
  let outsRecorded = 0;
  const advancements = Object.values(decisions).flatMap((decision) => {
    if (decision.to === "hold") {
      if (decision.from !== "batter" && Object.prototype.hasOwnProperty.call(basesAfter, decision.from)) basesAfter[decision.from] = decision.runnerId;
      return [];
    }
    if (decision.to === "out") {
      outsRecorded += 1;
      if (decision.from === "batter" && eventRules[normalized]?.out) return [];
      return [{ runnerId: decision.runnerId, from: decision.from, out: true }];
    }
    if (decision.to === "home") {
      runsScored += 1;
      return [{ runnerId: decision.runnerId, from: decision.from, to: "home" }];
    }
    if (Object.prototype.hasOwnProperty.call(basesAfter, decision.to)) basesAfter[decision.to] = decision.runnerId;
    return [{ runnerId: decision.runnerId, from: decision.from, to: decision.to }];
  });

  return {
    outcome: normalized,
    decisions,
    basesAfter,
    runsScored,
    outsRecorded,
    advancements
  };
}

function advanceHalfInning(game = activeGame()) {
  if (!game.current) syncGameCurrent(game);
  game.current.outs = 0;
  game.current.balls = 0;
  game.current.strikes = 0;
  game.current.runners = emptyBases(false);
  if (game.current.half === "top") {
    game.current.half = "bottom";
  } else {
    game.current.half = "top";
    game.current.inning += 1;
    if (game.current.inning > 7) game.status = "completed";
  }
  game.current.batterId = currentBatterModelId(game);
  game.current.pitcherId = game.pitcherId || game.current.pitcherId || "";
  game.currentPlateAppearanceId = "";
  game.atBat = makeAtBat();
  commitCurrentToLegacy(game);
  clearPendingPlayState(game, true);
}

function addSubstitution(game = activeGame(), substitution = {}) {
  syncGameCurrent(game);
  const entryId = substitution.lineupEntryId || substitution.entryId;
  const incomingPlayerId = substitution.incomingPlayerId || substitution.playerId;
  if (!entryId || !incomingPlayerId) return null;
  const currentEntries = gameLineupEntries(game);
  const outgoing = currentEntries.find((entry) => entry.id === entryId);
  if (!outgoing) return null;
  const record = {
    id: createId("sub"),
    gameId: game.id,
    inning: game.current.inning,
    half: game.current.half,
    teamSide: substitution.teamSide || "away",
    lineupEntryId: entryId,
    outgoingPlayerId: outgoing.playerId,
    incomingPlayerId,
    type: substitution.type || "sub",
    notes: substitution.notes || "",
    createdAt: new Date().toISOString()
  };
  game.lineupEntries = currentEntries.map((entry) =>
    entry.id === entryId
      ? { ...entry, playerId: incomingPlayerId, note: record.type === "ph" ? "Pinch hitter" : "Substitute" }
      : entry
  );
  game.lineups.away = deepClone(game.lineupEntries);
  if (!game.substitutions) game.substitutions = [];
  game.substitutions.push(record);
  game.events.push({
    id: createId("event"),
    gameId: game.id,
    playerId: incomingPlayerId,
    result: "SUB",
    runs: 0,
    rbi: 0,
    contact: "none",
    launch: "none",
    leverage: "neutral",
    inning: game.current.inning,
    half: game.current.half,
    outsBefore: game.current.outs,
    basesBefore: deepClone(game.current.runners),
    scope: "lineup",
    substitutionId: record.id,
    note: record.type === "ph" ? "Pinch hitter entered" : "Substitution entered",
    pitches: [],
    count: `${game.current.balls}-${game.current.strikes}`,
    spray: null,
    createdAt: record.createdAt,
    snapshotBefore: {
      inning: game.inning,
      half: game.half,
      outs: game.outs,
      bases: deepClone(game.bases),
      batterIndex: game.batterIndex,
      opponentBatterIndex: game.opponentBatterIndex || 0,
      score: deepClone(game.score),
      atBat: cloneAtBat(game.atBat || makeAtBat()),
      lineupEntries: deepClone(currentEntries)
    }
  });
  syncGameCurrent(game);
  return record;
}

function selectChoice(group, value, silent = false) {
  const target = group === "result" ? els.resultSelect : group === "contact" ? els.contactSelect : group === "error" ? els.errorFielderSelect : els.launchSelect;
  if (!target) return;
  target.value = value;
  els.choiceButtons
    .filter((button) => button.dataset.choiceGroup === group)
    .forEach((button) => button.classList.toggle("is-selected", button.dataset.choiceValue === value));
  if (silent) return;
  if (group === "result") {
    if (battedBallResults.has(value)) {
      const game = activeGame();
      bipOutcomeChosen = true;
      awaitingSprayLocation = true;
      if (game.atBat) game.atBat.pendingInPlay = false;
    }
    suggestRunValues();
    if (value === "BB" || value === "K" || value === "HBP") autoCompleteResult(value);
    if (battedBallResults.has(value)) maybeAutoCompleteBattedBall();
  }
  if (group === "launch" && value !== "none") {
    const game = activeGame();
    if (game.atBat && !awaitingSprayLocation) game.atBat.pendingInPlay = true;
    renderAtBat();
    maybeAutoCompleteBattedBall();
  }
  if (group === "error" && value) {
    bipOutcomeChosen = true;
    awaitingSprayLocation = true;
    const game = activeGame();
    if (game.atBat) game.atBat.pendingInPlay = false;
    selectChoice("result", "ROE", true);
    maybeAutoCompleteBattedBall();
  }
}

function clearPendingPlayState(game = activeGame(), clearAtBat = false) {
  pendingSpray = null;
  pendingRunnerOutBases = [];
  pendingRunnerChoices = {};
  pendingOutType = "";
  pendingOutFielder = "";
  bipOutcomeChosen = false;
  awaitingSprayLocation = false;
  awaitingRunnerDecision = false;
  scoringStep = "pitch";
  if (clearAtBat && game?.atBat) game.atBat.pendingInPlay = false;
}

function setScoringStep(step) {
  scoringStep = step;
  renderScoringStepPanel();
}

function resetBipChoices() {
  selectChoice("result", "1B", true);
  selectChoice("contact", "none", true);
  selectChoice("launch", "none", true);
  selectChoice("error", "", true);
  clearPendingPlayState(activeGame(), false);
  renderRunnerTracker();
}

function applyEvent(game = activeGame(), event = {}) {
  if (!game || !event.type) return null;
  syncGameCurrent(game);
  if (!game.atBat) game.atBat = makeAtBat();

  if (event.type === "pitch") {
    const outcome = event.outcome;
    const pitch = recordPitch(game, outcome);
    if (game.half === "bottom") {
      if (outcome === "ball" && pitch.ballsAfter >= 4) {
        return applyEvent(game, { type: "resolve_play", result: "BB" });
      }
      if ((outcome === "called_strike" || outcome === "swinging_strike") && pitch.strikesAfter >= 3) {
        return applyEvent(game, { type: "resolve_play", result: "K" });
      }
      if (outcome === "in_play") {
        clearPendingPlayState(game, true);
        if (game.atBat) game.atBat.pendingInPlay = true;
        scoringStep = "outcome";
      }
      saveState();
      renderAtBat();
      renderScoringStepPanel();
      return pitch;
    }
    if (outcome === "ball" && pitch.ballsAfter >= 4) return applyEvent(game, { type: "resolve_play", result: "BB" });
    if ((outcome === "called_strike" || outcome === "swinging_strike") && pitch.strikesAfter >= 3) return applyEvent(game, { type: "resolve_play", result: "K" });
    if (outcome === "in_play") {
      clearPendingPlayState(game, true);
      if (game.atBat) game.atBat.pendingInPlay = true;
      if (!battedBallResults.has(els.resultSelect.value)) selectChoice("result", "1B", true);
      els.sprayHint.textContent = "Select the outcome, then tap where the ball landed or was fielded.";
      scoringStep = "outcome";
    }
    saveState();
    renderAtBat();
    renderSprayChart();
    renderRunnerTracker();
    renderScoringStepPanel();
    return pitch;
  }

  if (event.type === "ball_in_play") {
    const rawOutcome = event.outcome || event.result;
    if (String(rawOutcome || "").toUpperCase() === "OUT") {
      pendingOutType = "";
      pendingOutFielder = "";
      if (game.atBat) game.atBat.pendingInPlay = false;
      scoringStep = "out_type";
      els.sprayHint.textContent = "Choose the out type before marking the field.";
      renderAtBat();
      renderScoringStepPanel();
      return "OUT";
    }
    const result = normalizeBallInPlayOutcome(rawOutcome);
    if (!battedBallResults.has(result)) return applyEvent(game, { type: "resolve_play", result });
    if (["GO", "FO", "LO"].includes(result)) {
      pendingOutType = result;
      pendingOutFielder = event.fieldedBy || pendingOutFielder || "";
      if (!pendingOutFielder) {
        if (game.atBat) game.atBat.pendingInPlay = false;
        scoringStep = "out_fielder";
        els.sprayHint.textContent = "Choose the defender who recorded the out.";
        renderAtBat();
        renderScoringStepPanel();
        return result;
      }
    }
    if (game.half === "bottom") {
      if (["GO", "FO", "LO"].includes(result)) pendingOutFielder = event.fieldedBy || pendingOutFielder || "";
      return applyEvent(game, { type: "resolve_play", result, fieldedBy: pendingOutFielder });
    }
    selectChoice("result", result, true);
    if (result === "HR") selectChoice("launch", "fb", true);
    else if (eventRules[result]?.launch) selectChoice("launch", eventRules[result].launch, true);
    else if (els.launchSelect.value === "none") selectChoice("launch", event.launch || "ld", true);
    clearPendingPlayState(game, true);
    pendingOutType = ["GO", "FO", "LO"].includes(result) ? result : "";
    pendingOutFielder = event.fieldedBy || pendingOutFielder || "";
    bipOutcomeChosen = true;
    awaitingSprayLocation = true;
    awaitingRunnerDecision = false;
    if (game.atBat) game.atBat.pendingInPlay = false;
    els.sprayHint.textContent = "Tap where the ball landed or was fielded.";
    scoringStep = "spray";
    saveState();
    renderAtBat();
    renderSprayChart();
    renderRunnerTracker();
    renderAutoScorePreview();
    renderScoringStepPanel();
    return result;
  }

  if (event.type === "spray") {
    setPendingSprayState(event.x, event.y);
    if (els.launchSelect.value === "none") selectChoice("launch", "ld", true);
    const result = els.resultSelect.value;
    if (bipOutcomeChosen && battedBallResults.has(result)) {
      awaitingSprayLocation = false;
      if (game.atBat) game.atBat.pendingInPlay = false;
      initializeRunnerDecisionChoices(game, result);
      awaitingRunnerDecision = true;
      els.sprayHint.textContent = "Review runner outs, then tap Resolve Play.";
      scoringStep = "runners";
    } else {
      if (game.atBat) game.atBat.pendingInPlay = true;
      els.sprayHint.textContent = `Marked ${pendingSpray.zone}. Select the outcome to continue.`;
      scoringStep = "outcome";
    }
    saveState();
    renderAtBat();
    renderRunnerTracker();
    renderSprayChart();
    renderAutoScorePreview();
    renderScoringStepPanel();
    return pendingSpray;
  }

  if (event.type === "runner_out") {
    if (event.mode === "steal") {
      recordSteal(event.target, "out");
      return null;
    }
    if (event.base) setRunnerChoice(event.base, "out");
    awaitingRunnerDecision = true;
    renderAutoScorePreview();
    renderScoringStepPanel();
    return pendingRunnerChoices;
  }

  if (event.type === "runner_advance") {
    if (event.mode === "steal") {
      recordSteal(event.target, "safe");
      return null;
    }
    if (event.base && event.to) setRunnerChoice(event.base, event.to);
    awaitingRunnerDecision = true;
    renderRunnerTracker();
    renderAutoScorePreview();
    renderScoringStepPanel();
    return null;
  }

  if (event.type === "special_action") {
    if (event.action === "steal") recordSteal(event.target, "safe");
    if (event.action === "caught_stealing") recordSteal(event.target, "out");
    if (event.action === "tag_up") recordTagUp(event.target);
    scoringStep = "pitch";
    renderScoringStepPanel();
    return null;
  }

  if (event.type === "resolve_play") {
    const result = normalizeBallInPlayOutcome(event.result || event.outcome || els.resultSelect.value || "GO");
    selectChoice("result", result, true);
    if (game.half === "bottom") {
      logOpponentOutcome(result, { fieldedBy: event.fieldedBy || pendingOutFielder });
      return result;
    }
    if (battedBallResults.has(result) && !pendingSpray) {
      bipOutcomeChosen = true;
      awaitingSprayLocation = true;
      awaitingRunnerDecision = false;
      if (game.atBat) game.atBat.pendingInPlay = false;
      els.sprayHint.textContent = "Tap where the ball landed or was fielded before resolving.";
      scoringStep = "spray";
      renderAtBat();
      renderRunnerTracker();
      renderScoringStepPanel();
      return null;
    }
    awaitingSprayLocation = false;
    awaitingRunnerDecision = false;
    scoringStep = "pitch";
    logPlay();
    return result;
  }

  return null;
}

function normalizeBallInPlayOutcome(value) {
  const key = String(value || "").toLowerCase();
  const map = {
    single: "1B",
    double: "2B",
    triple: "3B",
    home_run: "HR",
    homerun: "HR",
    hr: "HR",
    out: "GO",
    error: "ROE",
    roe: "ROE",
    fielders_choice: "FC",
    fielder_choice: "FC",
    fc: "FC",
    double_play: "DP",
    dp: "DP",
    sacrifice: "SAC",
    sac: "SAC",
    walk: "BB",
    bb: "BB",
    strikeout: "K",
    k: "K",
    hbp: "HBP"
  };
  return map[key] || String(value || "GO").toUpperCase();
}

function needsRunnerDecision(game = activeGame(), result = els.resultSelect.value) {
  if (result === "HR") return false;
  const bases = game.current?.runners || game.bases || emptyBases(false);
  return ["first", "second", "third"].some((base) => isOccupied(bases[base]));
}

function setRunnerChoice(base, to) {
  const current = pendingRunnerChoices[base] && typeof pendingRunnerChoices[base] === "object"
    ? pendingRunnerChoices[base]
    : { to: pendingRunnerChoices[base] || "hold", automaticTo: pendingRunnerChoices[base] || "hold" };
  pendingRunnerChoices = {
    ...pendingRunnerChoices,
    [base]: {
      ...current,
      to,
      adjusted: to !== current.automaticTo
    }
  };
  if (base !== "batter") {
    pendingRunnerOutBases = to === "out"
      ? [...new Set([...pendingRunnerOutBases, base])]
      : pendingRunnerOutBases.filter((item) => item !== base);
  }
}

function initializeRunnerDecisionChoices(game = activeGame(), result = els.resultSelect.value) {
  const batterId = currentBatterId(game);
  const bases = deepClone(game.current?.runners || game.bases || emptyBases(false));
  const defaults = getDefaultRunnerAdvances(result, { ...bases, batter: batterId });
  pendingRunnerChoices = {};
  ["third", "second", "first"].forEach((base) => {
    if (!isOccupied(bases[base])) return;
    const decision = defaults.decisions[base] || { runnerId: bases[base], to: "hold" };
    pendingRunnerChoices[base] = {
      runnerId: bases[base],
      from: base,
      to: decision.to || "hold",
      automaticTo: decision.to || "hold",
      adjusted: false
    };
  });
  const batterDecision = defaults.decisions.batter || { runnerId: batterId, to: defaultBatterDestination(result) };
  pendingRunnerChoices.batter = {
    runnerId: batterId,
    from: "batter",
    to: batterDecision.to || defaultBatterDestination(result),
    automaticTo: batterDecision.to || defaultBatterDestination(result),
    adjusted: false
  };
  pendingRunnerOutBases = Object.entries(pendingRunnerChoices)
    .filter(([base, choice]) => base !== "batter" && choice.to === "out")
    .map(([base]) => base);
}

function defaultBatterDestination(result) {
  if (result === "1B" || result === "ROE" || result === "FC") return "first";
  if (result === "2B") return "second";
  if (result === "3B") return "third";
  if (result === "HR") return "home";
  return "out";
}

function runnerDecisionCards(game = activeGame(), result = els.resultSelect.value) {
  const bases = game.current?.runners || game.bases || emptyBases(false);
  const cards = [];
  ["third", "second", "first"].forEach((base) => {
    if (isOccupied(bases[base])) {
      cards.push({
        base,
        label: runnerName(bases[base]) || baseLabel(base),
        start: baseLabel(base),
        options: runnerOptionsForBase(base)
      });
    }
  });
  cards.push({
    base: "batter",
    label: currentBatterLabel(game),
    start: "Batter",
    options: runnerOptionsForBase("batter")
  });
  cards.forEach((card) => {
    if (!pendingRunnerChoices[card.base]) {
      setRunnerChoice(card.base, card.base === "batter" ? defaultBatterDestination(result) : "hold");
    }
    const choice = pendingRunnerChoices[card.base];
    card.to = choice.to;
    card.automaticTo = choice.automaticTo;
    card.adjusted = Boolean(choice.adjusted);
  });
  return cards;
}

function runnerOptionsForBase(base) {
  if (base === "batter") return ["first", "second", "third", "home", "out"];
  if (base === "first") return ["hold", "second", "third", "home", "out"];
  if (base === "second") return ["hold", "third", "home", "out"];
  return ["hold", "home", "out"];
}

function baseLabel(base) {
  return {
    batter: "Batter",
    first: "1B",
    second: "2B",
    third: "3B",
    home: "Home",
    hold: "Hold",
    out: "Out"
  }[base] || base;
}

function currentBatterLabel(game = activeGame()) {
  const player = state.roster.find((item) => item.id === currentBatterId(game));
  return player ? `#${player.number} ${player.name}` : "Batter";
}

function logPitch(type) {
  return applyEvent(activeGame(), { type: "pitch", outcome: type });
}

function autoCompleteResult(result) {
  return applyEvent(activeGame(), { type: "resolve_play", result });
}

function maybeAutoCompleteBattedBall() {
  const game = activeGame();
  const result = els.resultSelect.value;
  if (game.half !== "top") return;
  if (!game.atBat?.pendingInPlay && !awaitingSprayLocation) return;
  if (!battedBallResults.has(result)) return;
  if (!bipOutcomeChosen) {
    els.sprayHint.textContent = "Select the outcome before the field tap saves the AB.";
    return;
  }
  if (!pendingSpray) {
    awaitingSprayLocation = true;
    if (game.atBat) game.atBat.pendingInPlay = false;
    els.sprayHint.textContent = "Now tap the field where the ball landed or was fielded.";
    renderAtBat();
    renderRunnerTracker();
    return;
  }
  awaitingSprayLocation = false;
  awaitingRunnerDecision = true;
  if (game.atBat) game.atBat.pendingInPlay = false;
  els.sprayHint.textContent = "Review runner outs, then tap Resolve Play.";
  renderAtBat();
  renderRunnerTracker();
}

function undoPitch() {
  const game = activeGame();
  const plateAppearance = getCurrentPlateAppearance(game, false);
  if (!game.atBat || !game.atBat.pitches.length) return;
  game.atBat.pitches.pop();
  if (plateAppearance?.pitches?.length) plateAppearance.pitches.pop();
  const pitches = normalizePitchTrail(game.atBat.pitches);
  game.atBat = makeAtBat();
  game.atBat.pitches = pitches;
  const lastPitch = pitches[pitches.length - 1];
  game.atBat.balls = lastPitch?.ballsAfter || 0;
  game.atBat.strikes = lastPitch?.strikesAfter || 0;
  game.atBat.pendingInPlay = pitches.some((pitch) => pitch.inPlay);
  if (!game.atBat.pendingInPlay) {
    clearPendingPlayState(game, true);
  }
  if (plateAppearance) plateAppearance.pitches = pitches;
  if (game.current) {
    game.current.balls = game.atBat.balls;
    game.current.strikes = game.atBat.strikes;
  }
  saveState();
  renderAtBat();
  renderScoringStepPanel();
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

  const playerId = currentBatterId(game);
  const result = els.resultSelect.value;
  const rule = eventRules[result];
  startPlateAppearance(game, playerId, "");
  const runnerAdvancements = runnerAdvancementsForPlay(game, result, playerId);
  const runs = runnerAdvancements.filter((advancement) => advancement.to === "home" && !advancement.out && !advancement.remove).length;
  const rbi = automaticRbiForPlay(result, runs);
  const outsRecorded = result === "DP" ? 2 : undefined;
  const snapshotBefore = {
    inning: game.inning,
    half: game.half,
    outs: game.outs,
    bases: { ...game.bases },
    batterIndex: game.batterIndex,
    score: { ...game.score },
    atBat: game.atBat ? cloneAtBat(game.atBat) : makeAtBat()
  };

  finalizePlateAppearance(game, {
    type: result,
    runsScored: runs,
    rbi,
    contact: els.contactSelect.value,
    launch: rule.launch || els.launchSelect.value,
    sprayChart: battedBallResults.has(result) ? pendingSpray : null,
    fieldedBy: ["GO", "FO", "LO"].includes(result) ? pendingOutFielder : "",
    runnerAdvancements,
    outsRecorded,
    errorOnPlay: result === "ROE" || Boolean(els.errorFielderSelect.value),
    errorFielderPosition: els.errorFielderSelect.value,
    notes: els.noteInput.value.trim(),
    snapshotBefore
  });
  clearPendingPlayState(game, true);

  els.runsInput.value = "0";
  els.rbiInput.value = "0";
  resetBipChoices();
  els.noteInput.value = "";
  saveState();
  render();
}

function automaticRbiForPlay(result, runs) {
  if (!runs) return 0;
  if (result === "ROE" || result === "DP") return 0;
  if (result === "FC") return runs;
  return runs;
}

function runnerAdvancementsForPlay(game, result, batterId) {
  const choiceKeys = Object.keys(pendingRunnerChoices);
  if (choiceKeys.length) return runnerAdvancementsFromChoices(game, batterId, result);
  const advancements = defaultRunnerAdvancements(game, result, batterId);
  const bases = deepClone(game.current?.runners || game.bases || emptyBases(false));
  if (result === "DP") {
    for (let index = advancements.length - 1; index >= 0; index -= 1) {
      if (advancements[index].out) advancements.splice(index, 1);
    }
  }
  const selectedOuts = new Set(pendingRunnerOutBases.filter((base) => isOccupied(bases[base])));
  if (result === "DP" && !selectedOuts.size) {
    if (isOccupied(bases.first)) selectedOuts.add("first");
    else if (isOccupied(bases.second)) selectedOuts.add("second");
    else if (isOccupied(bases.third)) selectedOuts.add("third");
  }
  selectedOuts.forEach((base) => {
    const runnerId = bases[base];
    const existingIndex = advancements.findIndex((advancement) => advancement.from === base);
    if (existingIndex >= 0) advancements.splice(existingIndex, 1);
    advancements.push({ runnerId, from: base, out: true });
  });
  return advancements;
}

function runnerAdvancementsFromChoices(game, batterId, result) {
  const bases = deepClone(game.current?.runners || game.bases || emptyBases(false));
  const advancements = [];
  ["third", "second", "first"].forEach((base) => {
    const runnerId = bases[base];
    if (!isOccupied(runnerId)) return;
    const choice = runnerChoiceDestination(base);
    if (choice === "hold") return;
    advancements.push(choice === "out"
      ? { runnerId, from: base, out: true }
      : { runnerId, from: base, to: choice });
  });
  const batterChoice = runnerChoiceDestination("batter") || "out";
  if (batterChoice === "out") {
    if (!eventRules[result]?.out) advancements.push({ runnerId: batterId, from: "batter", out: true });
  } else {
    advancements.push({ runnerId: batterId, from: "batter", to: batterChoice });
  }
  return advancements;
}

function runnerChoiceDestination(base) {
  const choice = pendingRunnerChoices[base];
  if (!choice) return "";
  return typeof choice === "object" ? choice.to : choice;
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
    selectChoice("launch", "fb", true);
  } else if (["K", "BB", "HBP", "SB", "CS"].includes(els.resultSelect.value)) {
    clearPendingPlayState(game, true);
    if (["BB", "HBP"].includes(els.resultSelect.value) && game.bases.first && game.bases.second && game.bases.third) {
      els.runsInput.value = "1";
      els.rbiInput.value = "1";
    }
    selectChoice("contact", "none", true);
    selectChoice("launch", "none", true);
    renderAtBat();
    renderSprayChart();
  } else if (battedBallResults.has(els.resultSelect.value)) {
    if (game.atBat && !bipOutcomeChosen && !awaitingSprayLocation) game.atBat.pendingInPlay = true;
    if (els.launchSelect.value === "none") selectChoice("launch", "ld", true);
    renderAtBat();
  }
  renderAutoScorePreview();
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

  const movement = applyRunnerAdvancements(game, [
    outcome === "safe"
      ? { runnerId: runner, from: steal.from, to: steal.to }
      : { runnerId: runner, from: steal.from, out: true }
  ]);
  if (outcome === "safe" && movement.runsScored) {
    if (game.half === "top") {
      game.score.lions += movement.runsScored;
      game.score.away = game.score.lions;
    } else {
      game.score.opponent += movement.runsScored;
      game.score.home = game.score.opponent;
    }
  }
  if (outcome === "out") {
    game.current.outs += movement.outsRecorded;
    commitCurrentToLegacy(game);
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
  if (game.outs >= 3) advanceHalfInning(game);
  saveState();
  render();
}

function recordTagUp(target) {
  const game = activeGame();
  if (game.status !== "completed") game.status = "active";
  const tag = tagUpMovement(target);
  if (!tag) return;
  const runner = game.bases[tag.from];
  if (!isOccupied(runner)) return;
  if (tag.to !== "home" && isOccupied(game.bases[tag.to])) return;

  const snapshotBefore = {
    inning: game.inning,
    half: game.half,
    outs: game.outs,
    bases: { ...game.bases },
    batterIndex: game.batterIndex,
    score: { ...game.score },
    atBat: game.atBat ? cloneAtBat(game.atBat) : makeAtBat()
  };
  const movement = applyRunnerAdvancements(game, [{ runnerId: runner, from: tag.from, to: tag.to }]);
  if (movement.runsScored) {
    if (game.half === "top") {
      game.score.lions += movement.runsScored;
      game.score.away = game.score.lions;
    } else {
      game.score.opponent += movement.runsScored;
      game.score.home = game.score.opponent;
    }
  }
  const createdAt = new Date().toISOString();
  game.events.push({
    id: createId("event"),
    gameId: game.id,
    playerId: game.half === "top" ? runner : undefined,
    opponentBatter: game.half === "bottom" ? currentOpponentBatter(game) : undefined,
    result: "TAG",
    runs: movement.runsScored,
    rbi: 0,
    contact: "none",
    launch: "none",
    leverage: "neutral",
    inning: game.inning,
    half: game.half,
    outsBefore: snapshotBefore.outs,
    outsAfter: game.outs,
    basesBefore: snapshotBefore.bases,
    basesAfter: deepClone(game.bases),
    note: `${runnerName(runner) || "Runner"} tagged up to ${baseLabel(tag.to)}`,
    pitches: [],
    count: `${game.atBat?.balls || 0}-${game.atBat?.strikes || 0}`,
    spray: null,
    runnerAdvancements: [{ runnerId: runner, from: tag.from, to: tag.to }],
    createdAt,
    snapshotBefore
  });
  commitCurrentToLegacy(game);
  saveState();
  render();
}

function tagUpMovement(target) {
  if (target === "second") return { from: "first", to: "second" };
  if (target === "third") return { from: "second", to: "third" };
  if (target === "home") return { from: "third", to: "home" };
  return null;
}

function logOpponentOutcome(result, options = {}) {
  const game = activeGame();
  if (game.status !== "completed") game.status = "active";
  const batter = currentOpponentBatter(game);
  const pitcherId = currentPitcherId(game);
  const runs = opponentRunsForResult(game, result);
  startPlateAppearance(game, `opp:${batter}`, pitcherId);
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

  finalizePlateAppearance(game, {
    type: result,
    runs,
    runsScored: runs,
    rbi: 0,
    contact: "none",
    launch: eventRules[result]?.launch || "none",
    fieldedBy: options.fieldedBy || "",
    pitcherId,
    outsRecorded: result === "DP" ? 2 : undefined,
    notes: "Opponent plate appearance",
    snapshotBefore
  });
  clearPendingPlayState(game, true);
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
  advanceHalfInning(game);
}

function undoLastPlay() {
  const game = activeGame();
  const event = game.events.pop();
  if (!event) return;
  if (event.plateAppearanceId) {
    game.plateAppearances = (game.plateAppearances || []).filter((appearance) => appearance.id !== event.plateAppearanceId);
    game.currentPlateAppearanceId = "";
  }
  if (event.substitutionId) {
    game.substitutions = (game.substitutions || []).filter((substitution) => substitution.id !== event.substitutionId);
  }
  if (event.snapshotBefore) {
    game.inning = event.snapshotBefore.inning;
    game.half = event.snapshotBefore.half;
    game.outs = event.snapshotBefore.outs;
    game.bases = { ...event.snapshotBefore.bases };
    game.batterIndex = event.snapshotBefore.batterIndex;
    game.opponentBatterIndex = event.snapshotBefore.opponentBatterIndex ?? game.opponentBatterIndex ?? 0;
    game.score = { ...event.snapshotBefore.score };
    game.atBat = cloneAtBat(event.snapshotBefore.atBat || makeAtBat());
    if (event.snapshotBefore.lineupEntries) {
      game.lineupEntries = deepClone(event.snapshotBefore.lineupEntries);
      game.lineups.away = deepClone(game.lineupEntries);
    }
    clearPendingPlayState(game, false);
    pendingSpray = event.spray || null;
    syncGameCurrent(game);
  }
  saveState();
  render();
}

function startNewGame() {
  const game = makeUniqueGame({ opponent: "Opponent" });
  state.games.push(game);
  state.activeGameId = game.id;
  saveGameToLibrary(game, true);
  clearPendingPlayState(game, true);
  saveState();
  render();
}

function scheduleGame() {
  const opponent = els.opponentInput.value.trim() || "Opponent";
  const game = makeUniqueGame({ opponent });
  game.date = els.gameDateInput.value || todayValue();
  game.time = els.gameTimeInput.value || "";
  game.location = els.gameLocationInput.value.trim();
  game.notes = els.gameNotesInput.value.trim();
  game.status = "scheduled";
  state.games.push(game);
  state.activeGameId = game.id;
  saveGameToLibrary(game, true);
  clearPendingPlayState(game, true);
  saveState();
  resetGameCreationForm();
  render();
}

function resetGameCreationForm() {
  els.opponentInput.value = "";
  els.gameDateInput.value = todayValue();
  els.gameTimeInput.value = "";
  els.gameLocationInput.value = "";
  els.gameNotesInput.value = "";
  [els.opponentInput, els.gameDateInput, els.gameTimeInput, els.gameLocationInput, els.gameNotesInput]
    .forEach((input) => {
      delete input.dataset.dirty;
    });
}

function scoreScheduledGame(gameId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return;
  game.status = game.status === "completed" ? "completed" : "active";
  setActiveGame(game.id);
  clearPendingPlayState(game, true);
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
  clearPendingPlayState(current, true);
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
  renderHome();
  renderScoreboard();
  renderAtBat();
  renderScoringStepPanel();
  renderRunnerTracker();
  renderSprayChart();
  renderBatterSelect();
  renderLiveLineup();
  renderPlayFeed();
  renderRoster();
  renderArchive();
  renderAnalysis();
  renderGames();
  renderGameEditor();
  renderSeasonStats();
  renderLeaders();
  renderSubControls();
  renderLineupBuilder();
  renderStatsSprayControls();
  renderScoutingReport();
  renderTraditionalScorebook();
  if (!optimizedIds.length) optimizedIds = buildOptimizedLineup();
  renderOptimizedLineup();
}

function renderHome() {
  const record = seasonRecord();
  const upcoming = upcomingScheduledGames(3);
  const next = upcoming[0] || null;
  els.homeRecord.textContent = `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ""}`;
  els.homeRunSummary.textContent = `${record.runsFor} RF | ${record.runsAgainst} RA`;
  if (next) {
    els.homeNextGame.textContent = `vs ${next.opponent}`;
    els.homeNextGameMeta.textContent = gameScheduleMeta(next);
    setHomeMatchupImage(next.opponent);
    els.homeScoutingBtn.disabled = false;
  } else {
    els.homeNextGame.textContent = "No upcoming game scheduled";
    els.homeNextGameMeta.textContent = "Create a game from the Games tab.";
    setHomeMatchupImage("");
    els.homeScoutingBtn.disabled = true;
  }
  const nextTwo = upcoming.slice(1, 3);
  if (els.homeUpcomingGames) {
    els.homeUpcomingGames.innerHTML = nextTwo.length
      ? nextTwo.map(renderUpcomingGameCard).join("")
      : `<div class="upcoming-empty">No additional upcoming games scheduled.</div>`;
  }

  const hitterRows = state.roster.map((player) => ({ player, stats: statsForPlayer(player.id) }));
  const pitcherRows = state.roster.map((player) => ({ player, stats: pitcherStats(player.id) }));
  els.homeBattingLeaders.innerHTML = [
    leaderCard("AVG", hitterRows, (row) => row.stats.avg, (value) => formatRate(value)),
    leaderCard("RBI", hitterRows, (row) => row.stats.rbi, String),
    leaderCard("OPS", hitterRows, (row) => row.stats.ops, (value) => formatRate(value))
  ].join("");
  els.homePitchingLeaders.innerHTML = [
    leaderCard("Strikeouts", pitcherRows, (row) => row.stats.k, String),
    leaderCard("WHIP", pitcherRows, (row) => row.stats.whip, (value) => value.toFixed(2), true),
    leaderCard("Strike %", pitcherRows, (row) => row.stats.strikeRate, (value) => `${Math.round(value * 100)}%`)
  ].join("");
}

function seasonRecord() {
  const completed = state.games.filter(gameIsFinal);
  const wins = completed.filter((game) => (game.score?.lions || 0) > (game.score?.opponent || 0)).length;
  const losses = completed.filter((game) => (game.score?.lions || 0) < (game.score?.opponent || 0)).length;
  const ties = completed.filter((game) => (game.score?.lions || 0) === (game.score?.opponent || 0)).length;
  return {
    wins,
    losses,
    ties,
    runsFor: completed.reduce((sum, game) => sum + (game.score?.lions || 0), 0),
    runsAgainst: completed.reduce((sum, game) => sum + (game.score?.opponent || 0), 0)
  };
}

function gameIsFinal(game) {
  return Boolean(game && (game.status === "completed" || game.status === "final" || Number(game.inning || 0) > 7));
}

function upcomingScheduledGames(limit = 3) {
  const today = todayValue();
  return [...state.games]
    .filter((game) => !gameIsFinal(game))
    .filter((game) => (game.date || today) >= today)
    .sort((a, b) => {
      const aDate = a.date || today;
      const bDate = b.date || today;
      const dateCompare = aDate.localeCompare(bDate);
      if (dateCompare) return dateCompare;
      return (a.time || "").localeCompare(b.time || "");
    })
    .slice(0, limit);
}

function nextScheduledGame() {
  return upcomingScheduledGames(1)[0] || null;
}

function getMatchupImage(opponentName) {
  return window.MatchupImages?.getMatchupImage(opponentName) || "lions-logo.png";
}

function setHomeMatchupImage(opponentName) {
  if (!els.homeMatchupImage) return;
  els.homeMatchupImage.src = getMatchupImage(opponentName);
  els.homeMatchupImage.alt = opponentName ? `Oakmont Lions vs ${opponentName}` : "Oakmont Lions";
}

function gameScheduleMeta(game) {
  return `${game.date || "No date"}${game.time ? ` at ${game.time}` : ""}${game.location ? ` | ${game.location}` : ""}`;
}

function renderUpcomingGameCard(game) {
  return `<article class="upcoming-game-card">
    <img src="${escapeHtml(getMatchupImage(game.opponent))}" alt="Oakmont Lions vs ${escapeHtml(game.opponent)}">
    <div>
      <span class="scout-kicker">Upcoming</span>
      <h4>vs ${escapeHtml(game.opponent)}</h4>
      <p class="player-meta">${escapeHtml(gameScheduleMeta(game))}</p>
      <button type="button" class="secondary-action upcoming-scout-button" data-home-scout-opponent="${escapeHtml(game.opponent)}">View Scouting Report</button>
    </div>
  </article>`;
}

function openCurrentGameForScoring() {
  const current = activeGame();
  if (gameIsFinal(current)) {
    const next = nextScheduledGame();
    if (next) {
      setActiveGame(next.id);
      clearPendingPlayState(next, true);
      saveState();
    }
  }
  switchView("score");
}

function openNextGameScouting() {
  const next = nextScheduledGame();
  openScoutingForOpponent(next?.opponent || "");
}

function openScoutingForOpponent(opponent) {
  const match = matchScoutingTeam(opponent);
  if (match) selectedScoutingTeamId = match.id;
  renderScoutingReport();
  switchView("scouting");
}

function matchScoutingTeam(opponent) {
  const key = normalizeScoutName(opponent);
  if (!key || !scoutingData?.teams) return null;
  return scoutingData.teams
    .map((team) => ({ team, score: scoutingMatchScore(opponent, team) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.team || null;
}

function scoutingMatchScore(opponent, team) {
  const opponentKey = normalizeScoutName(opponent);
  const teamKeys = [team.name, team.code, team.id, ...(team.aliases || [])].map(normalizeScoutName).filter(Boolean);
  if (teamKeys.includes(opponentKey)) return 100;
  if (teamKeys.some((teamKey) => teamKey.includes(opponentKey) || opponentKey.includes(teamKey))) return 80;

  const opponentTokens = scoutNameTokens(opponent);
  const teamTokens = new Set([team.name, team.code, team.id, ...(team.aliases || [])].flatMap(scoutNameTokens));
  const matches = opponentTokens.filter((token) => teamTokens.has(token));
  if (!matches.length) return 0;
  return Math.round((matches.length / Math.max(opponentTokens.length, 1)) * 60);
}

function scoutNameTokens(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function renderScoreboard() {
  const game = activeGame();
  if (!game.atBat) game.atBat = makeAtBat();
  syncGameCurrent(game);
  els.scoreOpponentLineupInput.value = opponentLineup(game).join("\n");
  els.gameTitle.textContent = `Lions vs ${game.opponent}`;
  const inningLabel = game.status === "completed" ? "Final" : `${game.half === "top" ? "Top" : "Bottom"} ${game.inning}`;
  const headerBatter = game.half === "top" ? currentBatterLabel(game) : currentOpponentBatter(game);
  els.headerBatterDisplay.textContent = game.half === "top" ? `${headerBatter} batting` : `${headerBatter} batting for ${game.opponent}`;
  els.inningStateDisplay.textContent = inningLabel;
  els.headerCountDisplay.textContent = `${game.atBat.balls}-${game.atBat.strikes}`;
  els.outsStateDisplay.textContent = String(game.outs);
  els.gameContext.textContent = game.status === "completed"
    ? `Final after ${Math.min(game.inning, 7)} innings`
    : `${game.half === "top" ? "Top" : "Bottom"} ${game.inning}, ${game.outs} ${game.outs === 1 ? "out" : "outs"}`;
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
  const sprayBaseSelectors = {
    first: ".spray-first-base",
    second: ".spray-second-base",
    third: ".spray-third-base"
  };
  const occupied = [];
  els.runnerBases.forEach((baseEl) => {
    const key = baseEl.dataset.runnerBase;
    const runner = game.bases[key];
    const name = runnerName(runner);
    const occupiedBase = isOccupied(runner);
    baseEl.classList.toggle("is-occupied", occupiedBase);
    baseEl.classList.toggle("is-pending-out", pendingRunnerOutBases.includes(key));
    baseEl.querySelector("span").textContent = name || "Empty";
    const sprayBase = els.sprayChart?.querySelector(sprayBaseSelectors[key]);
    if (sprayBase) {
      sprayBase.classList.toggle("is-occupied", occupiedBase);
    }
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
  const showRunnerOuts = (Boolean(game.atBat?.pendingInPlay) || awaitingSprayLocation || awaitingRunnerDecision) && game.half === "top";
  els.runnerPlayControls.classList.toggle("is-visible", showRunnerOuts);
  els.runnerOutButtons.forEach((button) => {
    const base = button.dataset.runnerOutBase;
    const enabled = showRunnerOuts && isOccupied(game.bases[base]);
    button.disabled = !enabled;
    button.classList.toggle("is-selected", pendingRunnerOutBases.includes(base));
  });
  renderAutoScorePreview();
}

function runnerName(runner) {
  if (!isOccupied(runner)) return "";
  const player = state.roster.find((item) => item.id === runner);
  if (player) return player.name.split(" ")[0];
  return runner === true ? "Runner" : "Opponent";
}

function togglePendingRunnerOut(base) {
  if (!base) return;
  if (pendingRunnerOutBases.includes(base)) {
    pendingRunnerOutBases = pendingRunnerOutBases.filter((item) => item !== base);
  } else {
    pendingRunnerOutBases.push(base);
  }
  renderRunnerTracker();
}

function renderAutoScorePreview() {
  const game = activeGame();
  if (!els.autoScorePreview || game.half === "bottom") return;
  const result = els.resultSelect.value || "1B";
  const batterId = currentBatterId(game);
  const runnerAdvancements = runnerAdvancementsForPlay(game, result, batterId);
  const runs = runnerAdvancements.filter((advancement) => advancement.to === "home" && !advancement.out && !advancement.remove).length;
  const rbi = automaticRbiForPlay(result, runs);
  const extraOuts = result === "DP" ? 2 : Math.min(3, (eventRules[result]?.out ? 1 : 0) + runnerAdvancements.filter((advancement) => advancement.out).length);
  els.runsInput.value = String(runs);
  els.rbiInput.value = String(rbi);
  els.autoScorePreview.textContent = `Auto: ${runs} run${runs === 1 ? "" : "s"}, ${rbi} RBI, ${extraOuts} out${extraOuts === 1 ? "" : "s"} on this result.`;
}

function handleScoringPanelClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.scoreStepBack !== undefined) {
    backScoringStep();
    return;
  }
  if (button.dataset.stepPitch) {
    applyEvent(activeGame(), { type: "pitch", outcome: button.dataset.stepPitch });
    return;
  }
  if (button.dataset.stepAutoResult) {
    applyEvent(activeGame(), { type: "resolve_play", result: button.dataset.stepAutoResult });
    return;
  }
  if (button.dataset.stepMore !== undefined) {
    setScoringStep("more");
    return;
  }
  if (button.dataset.specialAction) {
    applyEvent(activeGame(), {
      type: "special_action",
      action: button.dataset.specialAction,
      target: button.dataset.specialTarget
    });
    return;
  }
  if (button.dataset.stepOutcome) {
    applyEvent(activeGame(), { type: "ball_in_play", outcome: button.dataset.stepOutcome });
    return;
  }
  if (button.dataset.outType) {
    pendingOutType = button.dataset.outType;
    pendingOutFielder = "";
    scoringStep = "out_fielder";
    renderScoringStepPanel();
    return;
  }
  if (button.dataset.outFielder) {
    pendingOutFielder = button.dataset.outFielder;
    applyEvent(activeGame(), { type: "ball_in_play", outcome: pendingOutType || "GO", fieldedBy: pendingOutFielder });
    return;
  }
  if (button.dataset.runnerChoiceBase) {
    const choice = button.dataset.runnerChoice;
    applyEvent(activeGame(), {
      type: choice === "out" ? "runner_out" : "runner_advance",
      base: button.dataset.runnerChoiceBase,
      to: choice
    });
    return;
  }
  if (button.dataset.confirmPlay !== undefined) {
    applyEvent(activeGame(), { type: "resolve_play" });
    return;
  }
  if (button.dataset.opponentResult) {
    applyEvent(activeGame(), { type: "resolve_play", result: button.dataset.opponentResult });
  }
}

function backScoringStep() {
  const game = activeGame();
  if (scoringStep === "runners") {
    pendingRunnerChoices = {};
    pendingRunnerOutBases = [];
    pendingSpray = null;
    awaitingRunnerDecision = false;
    awaitingSprayLocation = true;
    scoringStep = "spray";
  } else if (scoringStep === "spray") {
    pendingSpray = null;
    awaitingSprayLocation = false;
    if (game.atBat) game.atBat.pendingInPlay = !pendingOutType;
    scoringStep = pendingOutType ? "out_fielder" : "outcome";
  } else if (scoringStep === "out_fielder") {
    pendingOutFielder = "";
    scoringStep = "out_type";
  } else if (scoringStep === "out_type") {
    pendingOutType = "";
    if (game.atBat) game.atBat.pendingInPlay = true;
    scoringStep = "outcome";
  } else if (scoringStep === "outcome" || scoringStep === "more") {
    clearPendingPlayState(game, true);
    scoringStep = "pitch";
  }
  saveState();
  renderAtBat();
  renderRunnerTracker();
  renderSprayChart();
  renderScoringStepPanel();
}

function renderScoringStepPanel() {
  if (!els.scoringStepPanel) return;
  const game = activeGame();
  if (!game.atBat) game.atBat = makeAtBat();
  if (game.half === "bottom") {
    renderOpponentScoringStepPanel(game);
    return;
  }
  if (awaitingRunnerDecision) scoringStep = "runners";
  else if (awaitingSprayLocation) scoringStep = "spray";
  else if (game.atBat.pendingInPlay && !["out_type", "out_fielder"].includes(scoringStep)) scoringStep = "outcome";
  const config = scoringStepConfig(game);
  els.scoringStepPanel.dataset.step = scoringStep;
  els.scoringStepEyebrow.textContent = config.eyebrow;
  els.scoringStepTitle.textContent = config.title;
  els.scoringStepHint.textContent = config.hint;
  els.panelUndoPitchBtn.hidden = !["pitch", "more"].includes(scoringStep);
  const backButton = els.scoringStepPanel.querySelector("[data-score-step-back]");
  if (backButton) backButton.hidden = scoringStep === "pitch";
  els.scoringStepBody.innerHTML = config.body;
}

function scoringStepConfig(game) {
  if (scoringStep === "more") {
    return {
      eyebrow: "More",
      title: "Quick Result",
      hint: "Use quick results or separate runner actions outside ball-in-play flow.",
      body: `<div class="step-grid step-grid-three">
        ${stepButton("Walk", "step-auto-result", "BB", "neutral")}
        ${stepButton("Strikeout", "step-auto-result", "K", "out")}
        ${stepButton("HBP", "step-auto-result", "HBP", "hbp")}
      </div>
      ${renderSpecialActionGrid(game)}`
    };
  }
  if (scoringStep === "outcome") {
    return {
      eyebrow: "Ball In Play",
      title: "Select Outcome",
      hint: "Choose result, then tap field location.",
      body: `<div class="step-grid step-grid-outcomes">
        ${stepButton("Single", "step-outcome", "1B", "hit")}
        ${stepButton("Double", "step-outcome", "2B", "hit")}
        ${stepButton("Triple", "step-outcome", "3B", "hit")}
        ${stepButton("Home Run", "step-outcome", "HR", "hit")}
        ${stepButton("Out", "step-outcome", "OUT", "out")}
        ${stepButton("Error", "step-outcome", "ROE", "error")}
        ${stepButton("Fielder's Choice", "step-outcome", "FC", "out")}
        ${stepButton("Double Play", "step-outcome", "DP", "out")}
        ${stepButton("Sacrifice", "step-outcome", "SAC", "out")}
      </div>`
    };
  }
  if (scoringStep === "out_type") {
    return {
      eyebrow: "Out Detail",
      title: "Choose Out Type",
      hint: "Scorebook notation depends on the out type and fielder.",
      body: `<div class="step-grid step-grid-three">
        ${stepButton("Ground Out", "out-type", "GO", "out")}
        ${stepButton("Fly Out", "out-type", "FO", "out")}
        ${stepButton("Line Out", "out-type", "LO", "out")}
      </div>`
    };
  }
  if (scoringStep === "out_fielder") {
    return {
      eyebrow: "Out Detail",
      title: `${resultLabel(pendingOutType || "GO")} - Fielder`,
      hint: "Choose the primary defender who made the play.",
      body: `<div class="step-grid step-grid-fielders">
        ${defensivePositions.map((position) => stepButton(position, "out-fielder", position, "neutral")).join("")}
      </div>`
    };
  }
  if (scoringStep === "spray") {
    return {
      eyebrow: "Spray Chart",
      title: `${resultLabel(els.resultSelect.value)} Selected`,
      hint: pendingSpray ? `Marked ${pendingSpray.zone}.` : "Tap the field where the ball landed or was fielded.",
      body: `<div class="spray-instruction-card">
        <strong>${escapeHtml(resultLabel(els.resultSelect.value))}</strong>
        <span>Keep the field clear. Tap the landing or fielded spot on the diamond.</span>
      </div>`
    };
  }
  if (scoringStep === "runners") {
    const result = els.resultSelect.value;
    if (!Object.keys(pendingRunnerChoices).length) initializeRunnerDecisionChoices(game, result);
    return {
      eyebrow: "Runner Decisions",
      title: "Set Advancements",
      hint: "Choose where each involved runner ended, then confirm.",
      body: `${runnerDecisionCards(game, result).map(renderRunnerDecisionCard).join("")}
        <div class="confirm-play-row">
          <button type="button" class="secondary-action" data-score-step-back>Back</button>
          <button type="button" class="primary-action confirm-play-button" data-confirm-play>Confirm Play</button>
        </div>`
    };
  }
  return {
    eyebrow: "Pitch Mode",
    title: "Record Pitch",
    hint: "Choose the pitch result.",
    body: `<div class="step-grid step-grid-pitches">
        ${stepButton("Ball", "step-pitch", "ball", "ball")}
        ${stepButton("Called Strike", "step-pitch", "called_strike", "strike")}
        ${stepButton("Swinging Strike", "step-pitch", "swinging_strike", "strike")}
        ${stepButton("Foul", "step-pitch", "foul", "foul")}
        ${stepButton("In Play", "step-pitch", "in_play", "inplay")}
      </div>
      <div class="panel-secondary-row">
        <button type="button" class="step-button step-button-more" data-step-more>More Results</button>
      </div>`
  };
}

function renderOpponentScoringStepPanel(game) {
  els.scoringStepPanel.dataset.step = "opponent";
  els.scoringStepEyebrow.textContent = "Opponent";
  els.scoringStepTitle.textContent = currentOpponentBatter(game);
  els.panelUndoPitchBtn.hidden = !["pitch", "more"].includes(scoringStep);
  const backButton = els.scoringStepPanel.querySelector("[data-score-step-back]");
  if (backButton) backButton.hidden = scoringStep === "pitch";

  if (scoringStep === "out_type") {
    els.scoringStepHint.textContent = "Choose the type of out.";
    els.scoringStepBody.innerHTML = `<div class="step-grid step-grid-three">
      ${stepButton("Ground Out", "out-type", "GO", "out")}
      ${stepButton("Fly Out", "out-type", "FO", "out")}
      ${stepButton("Line Out", "out-type", "LO", "out")}
    </div>`;
    return;
  }

  if (scoringStep === "out_fielder") {
    els.scoringStepHint.textContent = "Choose the primary defender who made the play.";
    els.scoringStepBody.innerHTML = `<div class="step-grid step-grid-fielders">
      ${defensivePositions.map((position) => stepButton(position, "out-fielder", position, "neutral")).join("")}
    </div>`;
    return;
  }

  if (scoringStep === "outcome" || game.atBat.pendingInPlay) {
    scoringStep = "outcome";
    els.scoringStepHint.textContent = "Choose the ball-in-play result to complete this opponent AB.";
    els.scoringStepBody.innerHTML = opponentOutcomeGrid();
    return;
  }

  if (scoringStep === "more") {
    els.scoringStepHint.textContent = "Use quick opponent results without a ball in play.";
    els.scoringStepBody.innerHTML = `<div class="step-grid step-grid-three">
      ${stepButton("Walk", "step-auto-result", "BB", "neutral")}
      ${stepButton("Strikeout", "step-auto-result", "K", "out")}
      ${stepButton("HBP", "step-auto-result", "HBP", "hbp")}
    </div>`;
    return;
  }

  scoringStep = "pitch";
  els.scoringStepHint.textContent = "Track the count. In Play opens the outcome choices.";
  els.scoringStepBody.innerHTML = `<div class="step-grid step-grid-pitches">
      ${stepButton("Ball", "step-pitch", "ball", "ball")}
      ${stepButton("Called Strike", "step-pitch", "called_strike", "strike")}
      ${stepButton("Swinging Strike", "step-pitch", "swinging_strike", "strike")}
      ${stepButton("Foul", "step-pitch", "foul", "foul")}
      ${stepButton("In Play", "step-pitch", "in_play", "inplay")}
    </div>
    <div class="panel-secondary-row">
      <button type="button" class="step-button step-button-more" data-step-more>More Results</button>
    </div>`;
}

function stepButton(label, dataName, value, tone) {
  return `<button type="button" class="step-button step-${tone}" data-${dataName}="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

function opponentOutcomeGrid() {
  return `<div class="step-grid step-grid-opponent">
    ${["1B", "2B", "3B", "HR", "OUT", "ROE", "FC", "DP", "SAC"]
      .map((result) => {
        const label = result === "OUT" ? "Out" : resultLabel(result);
        const tone = result === "OUT" ? "step-out" : stepToneForResult(result);
        return `<button type="button" class="step-button ${tone}" data-step-outcome="${result}">${escapeHtml(label)}</button>`;
      })
      .join("")}
  </div>`;
}

function renderSpecialActionGrid(game = activeGame()) {
  const buttons = [];
  const add = (label, action, target, tone = "neutral") => {
    buttons.push(`<button type="button" class="step-button step-${tone}" data-special-action="${action}" data-special-target="${target}">${escapeHtml(label)}</button>`);
  };
  if (isOccupied(game.bases.first) && !isOccupied(game.bases.second)) {
    add("Steal 2B", "steal", "second", "hit");
    add("Caught 2B", "caught_stealing", "second", "out");
    add("Tag 1B to 2B", "tag_up", "second", "neutral");
  }
  if (isOccupied(game.bases.second) && !isOccupied(game.bases.third)) {
    add("Steal 3B", "steal", "third", "hit");
    add("Caught 3B", "caught_stealing", "third", "out");
    add("Tag 2B to 3B", "tag_up", "third", "neutral");
  }
  if (isOccupied(game.bases.third)) {
    add("Steal Home", "steal", "home", "hit");
    add("Caught Home", "caught_stealing", "home", "out");
    add("Tag 3B Home", "tag_up", "home", "neutral");
  }
  if (!buttons.length) {
    return `<div class="special-action-empty">No runners are available for steal, caught stealing, or tag up.</div>`;
  }
  return `<div class="special-action-group">
    <span>Runner Actions</span>
    <div class="step-grid step-grid-special">${buttons.join("")}</div>
  </div>`;
}

function renderRunnerDecisionCard(card) {
  const selected = runnerChoiceDestination(card.base) || "hold";
  const destination = baseLabel(card.to || "hold");
  return `<article class="runner-decision-card ${card.adjusted ? "is-adjusted" : "is-auto"}">
    <div class="runner-decision-summary">
      <strong>Runner: ${escapeHtml(card.label)}</strong>
      <span class="runner-route">${escapeHtml(card.start)} &rarr; ${escapeHtml(destination)}</span>
      <em class="runner-auto-badge">${card.adjusted ? "ADJUSTED" : "AUTO"}</em>
    </div>
    <div class="runner-choice-group">
      ${runnerOverrideOptions(card).map((option) => `<button type="button" class="runner-choice ${selected === option ? "is-selected" : ""} ${option === "out" ? "is-out" : ""}" data-runner-choice-base="${card.base}" data-runner-choice="${option}">${escapeHtml(runnerOverrideLabel(card, option))}</button>`).join("")}
    </div>
  </article>`;
}

function runnerOverrideOptions(card) {
  const auto = card.to || card.automaticTo || "hold";
  const options = [auto];
  if (card.base !== "batter" && !options.includes("hold")) options.push("hold");
  const next = nextBaseFrom(card.start);
  if (next && !options.includes(next)) options.push(next);
  if (!options.includes("home")) options.push("home");
  if (!options.includes("out")) options.push("out");
  return options.filter((option) => card.options.includes(option));
}

function runnerOverrideLabel(card, option) {
  const automatic = card.to || card.automaticTo || "hold";
  if (option === automatic) return option === "out" ? "Out" : "Keep";
  if (option === "home") return "Score";
  if (option === "out") return card.to === "home" || card.automaticTo === "home" ? "Out at Home" : "Out";
  if (option === "hold") return "Keep";
  return "Advance";
}

function nextBaseFrom(start) {
  if (start === "Batter") return "first";
  if (start === "1B") return "second";
  if (start === "2B") return "third";
  if (start === "3B") return "home";
  return "";
}

function resultLabel(result) {
  return eventRules[result]?.label || result || "Result";
}

function stepToneForResult(result) {
  if (["1B", "2B", "3B", "HR"].includes(result)) return "step-hit";
  if (["ROE", "HBP"].includes(result)) return "step-error";
  if (["BB"].includes(result)) return "step-neutral";
  return "step-out";
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
  els.currentOutsDisplay.textContent = `${game.outs} ${game.outs === 1 ? "out" : "outs"}`;
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
  const isResolvingBattedBall = awaitingSprayLocation || awaitingRunnerDecision;
  els.abCard.classList.toggle("is-placing", !isOpponentHalf && isResolvingBattedBall);
  els.abCard.classList.toggle("is-runner-decision", !isOpponentHalf && awaitingRunnerDecision);
  els.scorerStack.classList.toggle("is-placing", !isOpponentHalf && isResolvingBattedBall);
  els.scorerStack.classList.toggle("is-runner-decision", !isOpponentHalf && awaitingRunnerDecision);
  els.abCard.classList.toggle("is-outcome", !isOpponentHalf && Boolean(game.atBat.pendingInPlay));
  els.bipPanel.classList.toggle("is-visible", Boolean(game.atBat.pendingInPlay));
  els.scoreForm.classList.toggle("is-defense", isOpponentHalf);
  els.sprayChart.closest(".spray-panel").classList.toggle("is-defense", isOpponentHalf);
  if (awaitingRunnerDecision) {
    els.sprayHint.textContent = "Review runner outs, then tap Resolve Play.";
  } else if (awaitingSprayLocation && !pendingSpray) {
    els.sprayHint.textContent = "Tap the field where the ball landed or was fielded.";
  } else if (!pendingSpray && !game.atBat.pendingInPlay) {
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
      stats.outs += Math.max(0, (event.outsAfter ?? event.outsBefore ?? 0) - (event.outsBefore ?? 0)) || (rule.out ? 1 : 0);
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
  const game = activeGame();
  if (game.half === "bottom") return;
  if (!awaitingSprayLocation && !game.atBat?.pendingInPlay) return;
  if (event.target.closest?.("button, input, select, textarea, [contenteditable='true']")) return;
  const rect = els.sprayChart.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
  event.preventDefault();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  applyEvent(game, { type: "spray", x, y });
}

function setPendingSprayState(x, y) {
  pendingSpray = {
    x: Math.max(4, Math.min(96, Math.round(x))),
    y: Math.max(4, Math.min(96, Math.round(y))),
    zone: sprayZone(x, y)
  };
  return pendingSpray;
}

function setPendingSpray(x, y) {
  return applyEvent(activeGame(), { type: "spray", x, y });
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
    els.batterSelect.disabled = true;
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
  els.batterSelect.disabled = true;
  els.batterSelect.title = "Batting order is locked to the current lineup spot.";
}

function renderLiveLineup() {
  const game = activeGame();
  if (game.half === "bottom") {
    const hitters = opponentLineupEntriesForGame(game);
    els.lineupCount.textContent = `${hitters.length} hitters`;
    els.liveLineup.innerHTML = hitters
      .map((entry, index) => {
        const current = index === (game.opponentBatterIndex || 0) ? " is-current" : "";
        return `<li class="opponent-lineup-row${current}">
          <div class="lineup-order">${index + 1}</div>
          <label>
            <span>Opponent hitter</span>
            <input value="${escapeHtml(entry.name)}" spellcheck="false" data-opponent-lineup-index="${index}">
          </label>
          <div class="player-meta">${escapeHtml(game.opponent)} batting | Type to edit</div>
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
  els.subPanel.classList.toggle("is-hidden", game.half === "bottom");
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
  addSubstitution(game, {
    lineupEntryId: entryId,
    incomingPlayerId: playerId,
    type,
    notes: type === "ph" ? "Pinch hitter entered" : "Substitution entered"
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
          const scope = event.scope === "defense" ? "Opponent" : "Lions";
          const rule = eventRules[event.result] || { label: event.result };
          const battedBallDetail = [
            event.launch && event.launch !== "none" ? launchLabels[event.launch] || event.launch : "",
            event.spray ? event.spray.zone : ""
          ].filter(Boolean).join(" | ");
          return `<article class="play-item">
            <strong>${escapeHtml(scope)} ${inningLabel(event)}: ${escapeHtml(name)} ${escapeHtml(rule.label)}</strong>
            <div class="play-meta">${event.pitches?.length || 0} pitches | Count ${escapeHtml(event.count || "0-0")} | Runs ${event.runs}, RBI ${event.rbi}</div>
            ${battedBallDetail ? `<div class="play-meta">${escapeHtml(battedBallDetail)}</div>` : ""}
            ${event.errorOnPlay ? `<div class="play-meta">Error charged${event.errorFielderPosition ? ` to ${escapeHtml(event.errorFielderPosition)}` : ""}</div>` : ""}
            ${event.runnerAdvancements?.some((advancement) => advancement.out) ? `<div class="play-meta">Runner out on play</div>` : ""}
            ${event.note ? `<div class="play-meta">${escapeHtml(event.note)}</div>` : ""}
          </article>`;
        })
        .join("")
    : `<p class="player-meta">No plays yet. First pitch is waiting.</p>`;
}

function inningLabel(event) {
  return `${event.half === "top" ? "T" : "B"}${event.inning}`;
}

function renderTraditionalScorebook() {
  if (!els.scorebookBody) return;
  const active = activeGame();
  if (!scorebookGameId || !state.games.some((game) => game.id === scorebookGameId)) scorebookGameId = active.id;
  els.scorebookGameSelect.innerHTML = [...state.games]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((game) => `<option value="${game.id}" ${game.id === scorebookGameId ? "selected" : ""}>${escapeHtml(game.date || "No date")} vs ${escapeHtml(game.opponent)}</option>`)
    .join("");
  const game = state.games.find((item) => item.id === scorebookGameId) || active;
  els.scorebookGameMeta.textContent = `${game.date || "No date"} | Oakmont ${game.score.lions} - ${game.score.opponent} ${game.opponent}`;
  const innings = [1, 2, 3, 4, 5, 6, 7];
  const head = `<tr><th>Lineup</th>${innings.map((inning) => `<th>${inning}</th>`).join("")}<th>R</th><th>H</th><th>RBI</th></tr>`;
  els.scorebookHead.innerHTML = head;
  els.opponentScorebookHead.innerHTML = head.replace("Lineup", "Opponent");

  const offenseEvents = game.events.filter((event) => event.scope === "offense" && eventRules[event.result]?.pa);
  const defenseEvents = game.events.filter((event) => event.scope === "defense" && eventRules[event.result]?.pa);
  els.scorebookBody.innerHTML = renderScorebookRows(
    gameLineupEntries(game).map((entry, index) => {
      const player = state.roster.find((item) => item.id === entry.playerId);
      return {
        id: entry.playerId,
        label: `${index + 1}. #${player?.number ?? ""} ${player?.name || "Open spot"}`,
        role: entry.role,
        events: offenseEvents.filter((event) => event.playerId === entry.playerId)
      };
    }),
    innings
  );
  const opponentNames = opponentLineup(game);
  els.opponentScorebookBody.innerHTML = renderScorebookRows(
    opponentNames.map((name, index) => ({
      id: name,
      label: `${index + 1}. ${name}`,
      role: game.opponent,
      events: defenseEvents.filter((event) => event.opponentBatter === name)
    })),
    innings
  );
}

function renderScorebookRows(rows, innings) {
  if (!rows.length) {
    return `<tr><td colspan="${innings.length + 4}" class="scorebook-empty">No lineup loaded.</td></tr>`;
  }
  return rows.map((row) => {
    const runs = row.events.reduce((sum, event) => sum + (event.runs || 0), 0);
    const hits = row.events.filter((event) => eventRules[event.result]?.hit).length;
    const rbi = row.events.reduce((sum, event) => sum + (event.rbi || 0), 0);
    return `<tr>
      <th>
        <strong>${escapeHtml(row.label)}</strong>
        <span>${escapeHtml(row.role || "")}</span>
      </th>
      ${innings.map((inning) => `<td>${renderScorebookCell(row.events.filter((event) => event.inning === inning))}</td>`).join("")}
      <td>${runs}</td>
      <td>${hits}</td>
      <td>${rbi}</td>
    </tr>`;
  }).join("");
}

function renderScorebookCell(events) {
  if (!events.length) return `<span class="scorebook-empty">-</span>`;
  return events.map((event) => {
    const rule = eventRules[event.result] || { label: event.result };
    const pitchCount = event.pitches?.length || 0;
    const notation = scorebookNotation(event);
    const reached = batterReachedBase(event.result);
    const scored = Boolean((event.runs || 0) && ["HR"].includes(event.result));
    const detail = scorebookDetail(event, pitchCount);
    return `<div class="scorebook-cell ${rule.hit ? "is-hit" : rule.out ? "is-out" : "is-reach"}">
      <div class="scorebook-diamond ${scored ? "is-run" : ""}">
        <span class="path hp-1 ${reached >= 1 ? "is-active" : ""}"></span>
        <span class="path one-2 ${reached >= 2 ? "is-active" : ""}"></span>
        <span class="path two-3 ${reached >= 3 ? "is-active" : ""}"></span>
        <span class="path three-h ${reached >= 4 ? "is-active" : ""}"></span>
        <strong>${escapeHtml(notation)}</strong>
        ${rule.out ? `<small>${escapeHtml(outNumber(event))}</small>` : ""}
      </div>
      <span>${escapeHtml(detail || rule.label)}</span>
      ${event.note ? `<em>${escapeHtml(event.note)}</em>` : ""}
    </div>`;
  }).join("");
}

function scorebookNotation(event) {
  const result = event.result;
  if (["GO", "FO", "LO"].includes(result)) return scorebookOutNotation(result, event.fieldedBy);
  if (result === "K") return "K";
  if (result === "BB") return "BB";
  if (result === "HBP") return "HP";
  if (result === "ROE") return event.errorFielderPosition ? `E${fielderNumber(event.errorFielderPosition)}` : "E";
  if (result === "FC") return "FC";
  if (result === "DP") return "DP";
  if (result === "SAC") return "SAC";
  return result;
}

function scorebookOutNotation(result, fieldedBy = "") {
  const number = fielderNumber(fieldedBy);
  if (!number) return result;
  if (result === "GO") {
    if (fieldedBy === "1B") return "3A";
    return `${number}-3`;
  }
  if (result === "FO") return `F${number}`;
  if (result === "LO") return `L${number}`;
  return result;
}

function batterReachedBase(result) {
  if (result === "1B" || result === "BB" || result === "HBP" || result === "ROE" || result === "FC") return 1;
  if (result === "2B") return 2;
  if (result === "3B") return 3;
  if (result === "HR") return 4;
  return 0;
}

function scorebookDetail(event, pitchCount) {
  return [
    pitchCount ? `${pitchCount} pitches` : "",
    event.count ? `Count ${event.count}` : "",
    event.rbi ? `${event.rbi} RBI` : "",
    event.runs ? `${event.runs} R` : "",
    event.spray?.zone || "",
    event.runnerAdvancements?.some((advancement) => advancement.out) ? "Runner out" : ""
  ].filter(Boolean).join(" | ");
}

function outNumber(event) {
  const after = event.outsAfter ?? event.outsBefore ?? 0;
  if (!after) return "OUT";
  return `${after}${ordinalSuffix(after)} out`;
}

function fielderNumber(position) {
  return { P: 1, C: 2, "1B": 3, "2B": 4, "3B": 5, SS: 6, LF: 7, CF: 8, RF: 9 }[position] || "";
}

function renderRoster() {
  els.rosterGrid.innerHTML = "";
  els.rosterFilter.value = rosterFilter;
  const visiblePlayers = state.roster.filter((player) => {
    if (rosterFilter === "all") return true;
    if (rosterFilter === "inactive") return !state.lineup.includes(player.id);
    return state.lineup.includes(player.id);
  });
  els.rosterFilterSummary.textContent = `${visiblePlayers.length} ${rosterFilter === "all" ? "total" : rosterFilter} player${visiblePlayers.length === 1 ? "" : "s"}`;
  if (!visiblePlayers.length) {
    els.rosterGrid.innerHTML = `<p class="player-meta">No ${escapeHtml(rosterFilter)} players to show.</p>`;
    return;
  }
  visiblePlayers.forEach((player) => {
    const stats = statsForPlayer(player.id);
    const node = els.playerTemplate.content.cloneNode(true);
    const card = node.querySelector(".player-card");
    card.dataset.playerId = player.id;
    node.querySelector(".number-pill").textContent = `#${player.number}`;
    node.querySelector("h3").textContent = player.name;
    node.querySelector("p").textContent = `${player.positions} | Bats ${player.bats}`;
    node.querySelector('[data-player-edit="name"]').value = player.name;
    node.querySelector('[data-player-edit="number"]').value = player.number;
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
      setGradeFill(input);
      input.addEventListener("input", () => {
        player.grades[grade] = Number(input.value);
        setGradeFill(input);
        saveState();
        optimizedIds = buildOptimizedLineup();
        renderOptimizedLineup();
        renderValueBoard();
      });
    });
    els.rosterGrid.appendChild(node);
  });
}

function setGradeFill(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const value = Number(input.value) || min;
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100));
  input.style.setProperty("--grade-fill", `${pct}%`);
}

function updatePlayerIdentity(playerId, field, value) {
  const cleaned = value.trim();
  if (!cleaned) {
    renderRoster();
    return;
  }
  state.roster = state.roster.map((player) => {
    if (player.id !== playerId) return player;
    if (field === "name") return { ...player, name: cleaned };
    if (field === "number") return { ...player, number: cleaned };
    return player;
  });
  saveState();
  render();
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
      const rule = eventRules[event.result] || { label: event.result };
      return `<div class="archive-meta">${escapeHtml(player?.name || "Unknown")} ${escapeHtml(rule.label)} ${event.note ? `- ${escapeHtml(event.note)}` : ""}</div>`;
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
  renderRecordSummary();
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
          <span class="player-meta">${escapeHtml(game.date || "No date")} ${game.time ? `| ${escapeHtml(game.time)}` : ""} ${game.location ? `| ${escapeHtml(game.location)}` : ""}</span>
          <h3>${score}</h3>
        </div>
        <div class="archive-meta">${escapeHtml(status)} | ${game.events.length} tracked events</div>
        <div class="archive-meta">${opponentLineup(game).length} opponent hitters loaded</div>
        ${game.notes ? `<div class="archive-meta">${escapeHtml(game.notes)}</div>` : ""}
        <div class="game-actions">
          <button type="button" class="primary-action" data-game-action="score" data-game-id="${game.id}">${game.id === activeId ? "Continue Scoring" : "Score This Game"}</button>
          <button type="button" class="secondary-action" data-game-action="lineup" data-game-id="${game.id}">Lineup</button>
          <button type="button" class="secondary-action" data-game-action="edit" data-game-id="${game.id}">Edit</button>
          <button type="button" class="secondary-action" data-game-action="complete" data-game-id="${game.id}">Mark Final</button>
          <button type="button" class="secondary-action danger-action" data-game-action="delete" data-game-id="${game.id}">Remove</button>
        </div>
      </article>`;
    })
    .join("");
}

function renderRecordSummary() {
  const completed = state.games.filter(gameIsFinal);
  const wins = completed.filter((game) => (game.score?.lions || 0) > (game.score?.opponent || 0)).length;
  const losses = completed.filter((game) => (game.score?.lions || 0) < (game.score?.opponent || 0)).length;
  const ties = completed.filter((game) => (game.score?.lions || 0) === (game.score?.opponent || 0)).length;
  els.recordSummary.innerHTML = [
    metricCard("Record", `${wins}-${losses}${ties ? `-${ties}` : ""}`, "Completed games only."),
    metricCard("Games Saved", String(state.games.length), "Stored in the local game library."),
    metricCard("Runs For", String(completed.reduce((sum, game) => sum + (game.score?.lions || 0), 0)), "Oakmont runs in final games."),
    metricCard("Runs Against", String(completed.reduce((sum, game) => sum + (game.score?.opponent || 0), 0)), "Opponent runs in final games.")
  ].join("");
}

function openGameEditor(gameId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return;
  gameEditId = gameId;
  els.editOpponentInput.value = game.opponent || "";
  els.editDateInput.value = game.date || todayValue();
  els.editTimeInput.value = game.time || "";
  els.editLocationInput.value = game.location || "";
  els.editNotesInput.value = game.notes || "";
  renderGameEditor();
}

function renderGameEditor() {
  const game = state.games.find((item) => item.id === gameEditId);
  els.gameEditPanel.classList.toggle("is-visible", Boolean(game));
  if (!game) return;
  els.gameEditTitle.textContent = `Edit ${game.opponent}`;
}

function saveGameEdits() {
  const game = state.games.find((item) => item.id === gameEditId);
  if (!game) return;
  game.opponent = els.editOpponentInput.value.trim() || "Opponent";
  if (game.teams?.home) game.teams.home.name = game.opponent;
  game.date = els.editDateInput.value || todayValue();
  game.time = els.editTimeInput.value || "";
  game.location = els.editLocationInput.value.trim();
  game.notes = els.editNotesInput.value.trim();
  saveState();
  render();
}

function removeScheduledGame(gameId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return;
  const ok = window.confirm(`Remove ${game.opponent} on ${game.date || "this date"}?`);
  if (!ok) return;
  deleteGame(gameId);
  if (!state.activeGameId && state.games.length) state.activeGameId = state.games[0].id;
  if (gameEditId === gameId) gameEditId = null;
  saveState();
  render();
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
  game.lineups.away = deepClone(game.lineupEntries);
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
  game.lineups.away = deepClone(game.lineupEntries);
  saveState();
  renderLineupBuilder();
}

function removeLineupEntry(entryId) {
  const game = state.games.find((item) => item.id === lineupBuilderGameId);
  if (!game) return;
  game.lineupEntries = gameLineupEntries(game).filter((entry) => entry.id !== entryId);
  game.lineups.away = deepClone(game.lineupEntries);
  game.batterIndex = Math.min(game.batterIndex, Math.max(game.lineupEntries.length - 1, 0));
  saveState();
  renderLineupBuilder();
  if (game.id === activeGame().id) render();
}

function resetBuilderLineup() {
  const game = state.games.find((item) => item.id === lineupBuilderGameId);
  if (!game) return;
  game.lineupEntries = makeLineupEntries(state.lineup);
  game.lineups.away = deepClone(game.lineupEntries);
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
  renderGameBreakdown();
  renderValueBoard();
}

function renderGameBreakdown() {
  els.gameBreakdown.innerHTML = state.games
    .filter((game) => game.events.length || game.status !== "scheduled")
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((game) => {
      const offensiveEvents = game.events.filter((event) => event.scope === "offense" && eventRules[event.result]?.pa);
      const stats = emptyStats();
      offensiveEvents.forEach((event) => applyEventToStats(stats, event));
      finishStats(stats);
      const lineup = gameLineupEntries(game)
        .map((entry, index) => {
          const player = state.roster.find((item) => item.id === entry.playerId);
          if (!player) return "";
          const playerEvents = offensiveEvents.filter((event) => event.playerId === player.id);
          const reached = playerEvents.filter((event) => eventRules[event.result]?.reach).length;
          return `${index + 1}. ${player.name} ${entry.role} (${reached}/${Math.max(playerEvents.length, 1)} reached)`;
        })
        .filter(Boolean)
        .join(" | ");
      return `<article class="breakdown-card">
        <div class="mini-head">
          <div>
            <h3>${escapeHtml(game.date || "No date")} vs ${escapeHtml(game.opponent)}</h3>
            <span class="player-meta">Oakmont ${game.score.lions} - ${game.score.opponent} | ${game.status}</span>
          </div>
          <span class="player-meta">${offensiveEvents.length} PA</span>
        </div>
        <div class="stat-strip">
          ${statCell("OPS", formatRate(stats.ops))}
          ${statCell("OBP", formatRate(stats.obp))}
          ${statCell("K%", `${Math.round(stats.kRate * 100)}%`)}
          ${statCell("P/PA", stats.pitchesPerPa.toFixed(2))}
        </div>
        <p class="player-meta">${escapeHtml(lineup || "No Oakmont lineup logged.")}</p>
      </article>`;
    })
    .join("") || `<p class="player-meta">Game analysis appears after scorekeeping begins.</p>`;
}

function initializeScoutingReport() {
  scoutingData = deepClone(AA_SCOUTING_SNAPSHOT);
  selectedScoutingTeamId = scoutingData.teams[0]?.id || "";
  scoutingRefreshState = "snapshot";
  scoutingStatusMessage = "Using Pittsburgh NABA AA snapshot.";
  setTimeout(() => refreshScoutingData({ silent: true }), 0);
}

async function refreshScoutingData(options = {}) {
  if (!scoutingData) scoutingData = deepClone(AA_SCOUTING_SNAPSHOT);
  const selectedTeam = getSelectedScoutingTeam();
  const urls = [PITTSBURGH_NABA_URL, teamStatsPageUrl(selectedTeam)]
    .filter(Boolean)
    .filter((url, index, list) => list.indexOf(url) === index);

  if (!urls.length || typeof fetch !== "function") {
    scoutingRefreshState = "snapshot";
    scoutingStatusMessage = "Using Pittsburgh NABA AA snapshot.";
    renderScoutingReport();
    return;
  }

  if (!options.silent) {
    scoutingStatusMessage = "Checking Pittsburgh NABA for the latest AA data...";
    els.refreshScoutingBtn.disabled = true;
    renderScoutingReport();
  }

  let touchedLiveData = false;
  let fetchFailed = false;
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Pittsburgh NABA returned ${response.status}`);
      const html = await response.text();
      if (url === PITTSBURGH_NABA_URL) {
        const parsedLeague = parsePittsburghNabaScouting(html, scoutingData);
        touchedLiveData = touchedLiveData || Boolean(parsedLeague.liveDataFound);
        delete parsedLeague.liveDataFound;
        scoutingData = parsedLeague;
      } else {
        const parsedTeam = parseTeamPageScouting(html);
        if (parsedTeam.hitters.length || parsedTeam.pitchers.length) {
          mergeScoutingTeamLeaders(selectedTeam.id, parsedTeam);
          touchedLiveData = true;
        }
      }
    } catch (error) {
      fetchFailed = true;
    }
  }
  scoutingRefreshState = touchedLiveData ? "live" : "snapshot";
  scoutingStatusMessage = touchedLiveData
    ? `Updated from Pittsburgh NABA for ${selectedTeam?.name || "AA opponents"}.`
    : "Using Pittsburgh NABA AA snapshot. Live refresh may be blocked by the league site from this browser.";
  if (!fetchFailed && !touchedLiveData) scoutingStatusMessage = "Using Pittsburgh NABA AA snapshot.";
  els.refreshScoutingBtn.disabled = false;
  renderScoutingReport();
}

function parsePittsburghNabaScouting(html, currentData) {
  const parsed = deepClone(currentData || AA_SCOUTING_SNAPSHOT);
  const text = visibleTextFromHtml(html);
  const standings = parseAaStandings(text);
  standings.forEach((standing) => {
    const team = parsed.teams.find((item) => normalizeScoutName(item.name) === normalizeScoutName(standing.name));
    if (team) Object.assign(team, standing);
  });
  const leagueLeaders = parseLeagueAaLeaders(text);
  if (leagueLeaders.hitters.length) parsed.leagueLeaders.hitters = leagueLeaders.hitters;
  if (leagueLeaders.pitchers.length) parsed.leagueLeaders.pitchers = leagueLeaders.pitchers;
  parsed.updatedLabel = "Live Pittsburgh NABA refresh";
  parsed.liveDataFound = Boolean(standings.length || leagueLeaders.hitters.length || leagueLeaders.pitchers.length);
  return parsed;
}

function parseAaStandings(text) {
  const normalized = text.replace(/\u00a0/g, " ").replace(/\s+/g, " ");
  return AA_SCOUTING_SNAPSHOT.teams.map((team) => {
    const escapedName = team.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escapedName}\\s+\\|\\s+([\\d-]+)\\s+\\|\\s+(\\d+)\\s+\\|\\s+([.\\d]+)\\s+\\|\\s+([^|]+?)\\s+\\|\\s+[^|]+\\|\\s+[^|]+\\|\\s+(\\d+)\\s+\\|\\s+(\\d+)\\s+\\|\\s+([^|]+?)\\s+\\|\\s+([^|]+?)(?=\\s+[A-Z][A-Za-z]|\\s+A\\s+Team|$)`, "i");
    const match = normalized.match(pattern);
    if (!match) return null;
    return {
      name: team.name,
      record: match[1],
      points: Number(match[2]),
      winPct: match[3],
      gb: match[4].trim(),
      rf: Number(match[5]),
      ra: Number(match[6]),
      last10: match[7].trim(),
      streak: match[8].trim()
    };
  }).filter(Boolean);
}

function parseLeagueAaLeaders(text) {
  const aaMatch = text.match(/\bAA\b([\s\S]*?)(?:\bA\b\s+Batting|2023|Number of Visitors|$)/i);
  if (!aaMatch) return { hitters: [], pitchers: [] };
  const block = aaMatch[1];
  const hitters = parseScoutingHitterRows(linesBetween(block, "Batting", "Pitching"), "team");
  const pitchers = parseScoutingPitcherRows(linesBetween(block, "Pitching", ""));
  return { hitters, pitchers };
}

function parseTeamPageScouting(html) {
  const text = visibleTextFromHtml(html);
  const leadersBlock = text.match(/Stat Leaders([\s\S]*?)(?:Team Schedule|Schedule|Standings|Last Game|Number of Visitors|Admin Log In|$)/i);
  const block = leadersBlock ? leadersBlock[1] : text;
  return {
    hitters: parseScoutingHitterRows(linesBetween(block, "Batting", "Pitching"), "position"),
    pitchers: parseScoutingPitcherRows(linesBetween(block, "Pitching", ""))
  };
}

function visibleTextFromHtml(html) {
  if (typeof DOMParser === "function") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body?.innerText || doc.body?.textContent || html).replace(/\u00a0/g, " ");
  }
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/\u00a0/g, " ");
}

function linesBetween(text, startLabel, endLabel) {
  const lines = scoutingLines(text);
  const cleanLine = (line) => line.replace(/^\*\s*/, "").toLowerCase();
  const start = startLabel ? lines.findIndex((line) => cleanLine(line).startsWith(startLabel.toLowerCase())) : 0;
  if (start < 0) return [];
  const end = endLabel
    ? lines.findIndex((line, index) => index > start && cleanLine(line).startsWith(endLabel.toLowerCase()))
    : lines.length;
  return lines.slice(start + 1, end > start ? end : lines.length);
}

function scoutingLines(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " | ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseScoutingHitterRows(lines, secondaryKey) {
  const pipeRows = lines
    .filter((line) => line.includes("|"))
    .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean))
    .filter((cells) => cells.length >= 4 && /^\d+$/.test(cells[2]) && /^\.\d{3}$/.test(cells[3]))
    .map((cells) => ({
      name: cells[0],
      [secondaryKey === "team" ? "team" : "pos"]: cells[1],
      ab: Number(cells[2]),
      avg: cells[3]
    }));
  if (pipeRows.length) return pipeRows.slice(0, 7);

  const tokens = lines.filter((line) => !/^(pos|team|ab|avg|batting|\*)$/i.test(line));
  const rows = [];
  for (let index = 0; index < tokens.length - 3; index += 1) {
    if (/^\d+$/.test(tokens[index + 2]) && /^\.\d{3}$/.test(tokens[index + 3])) {
      rows.push({
        name: tokens[index],
        [secondaryKey === "team" ? "team" : "pos"]: tokens[index + 1],
        ab: Number(tokens[index + 2]),
        avg: tokens[index + 3]
      });
      index += 3;
    }
  }
  return rows.slice(0, 7);
}

function parseScoutingPitcherRows(lines) {
  const pipeRows = lines
    .filter((line) => line.includes("|"))
    .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean))
    .filter((cells) => (
      cells.length >= 5 && /^\d+$/.test(cells[1]) && /^\d+$/.test(cells[2]) && /^\d+$/.test(cells[3]) && eraLike(cells[4])
    ) || (
      cells.length >= 4 && /^[A-Z]{2,4}$/.test(cells[1]) && /^\d+$/.test(cells[2]) && eraLike(cells[3])
    ))
    .map((cells) => {
      if (cells.length >= 5 && /^\d+$/.test(cells[1])) {
        return { name: cells[0], w: Number(cells[1]), l: Number(cells[2]), k: Number(cells[3]), era: cells[4] };
      }
      return { name: cells[0], team: cells[1], w: Number(cells[2]), era: cells[3] };
    });
  if (pipeRows.length) return pipeRows.slice(0, 7);

  const tokens = lines.filter((line) => !/^(w|l|k|era|pitching|\*)$/i.test(line));
  const rows = [];
  for (let index = 0; index < tokens.length - 3; index += 1) {
    if (/^\d+$/.test(tokens[index + 1]) && /^\d+$/.test(tokens[index + 2]) && /^\d+$/.test(tokens[index + 3]) && eraLike(tokens[index + 4])) {
      rows.push({ name: tokens[index], w: Number(tokens[index + 1]), l: Number(tokens[index + 2]), k: Number(tokens[index + 3]), era: tokens[index + 4] });
      index += 4;
    } else if (/^[A-Z]{2,4}$/.test(tokens[index + 1]) && /^\d+$/.test(tokens[index + 2]) && eraLike(tokens[index + 3])) {
      rows.push({ name: tokens[index], team: tokens[index + 1], w: Number(tokens[index + 2]), era: tokens[index + 3] });
      index += 3;
    }
  }
  return rows.slice(0, 7);
}

function eraLike(value) {
  return /^\d+\.\d{2}$/.test(String(value || ""));
}

function mergeScoutingTeamLeaders(teamId, parsedTeam) {
  const team = scoutingData?.teams.find((item) => item.id === teamId);
  if (!team) return;
  if (parsedTeam.hitters.length) team.hitters = parsedTeam.hitters;
  if (parsedTeam.pitchers.length) team.pitchers = parsedTeam.pitchers;
}

function getSelectedScoutingTeam() {
  if (!scoutingData) scoutingData = deepClone(AA_SCOUTING_SNAPSHOT);
  return scoutingData.teams.find((team) => team.id === selectedScoutingTeamId) || scoutingData.teams[0];
}

function renderScoutingReport() {
  if (!els.scoutingReport || !els.scoutingTeamSelect) return;
  if (!scoutingData) scoutingData = deepClone(AA_SCOUTING_SNAPSHOT);
  if (!selectedScoutingTeamId) selectedScoutingTeamId = scoutingData.teams[0]?.id || "";
  const team = getSelectedScoutingTeam();
  els.scoutingTeamSelect.innerHTML = scoutingData.teams
    .map((item) => `<option value="${item.id}" ${item.id === team.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("");
  els.scoutingTeamSelect.value = team.id;
  els.scoutingSourceStatus.textContent = scoutingStatusMessage;

  const hitters = scoutingTopHitters(team);
  const pitchers = team.pitchers?.length ? team.pitchers : scoutingData.leagueLeaders.pitchers.filter((leader) => leader.team === team.code);
  const games = gamesFromRecord(team.record);
  const rfPerGame = games ? team.rf / games : 0;
  const raPerGame = games ? team.ra / games : 0;
  const differential = (team.rf || 0) - (team.ra || 0);
  const gamePlan = buildScoutingGamePlan(team, hitters, pitchers, rfPerGame, raPerGame);

  els.scoutingReport.innerHTML = `
    <article class="scouting-card scouting-hero-card">
      <div class="mini-head">
        <div>
          <h3>${escapeHtml(team.name)}</h3>
          <span class="player-meta">AA Division | ${escapeHtml(team.record)} | ${escapeHtml(team.streak)}</span>
        </div>
        <a class="scout-link" href="${escapeHtml(teamStatsPageUrl(team))}" target="_blank" rel="noreferrer">Team Stats Page</a>
      </div>
      <div class="scout-metrics">
        ${scoutMetric("Win %", team.winPct)}
        ${scoutMetric("RF/G", rfPerGame.toFixed(1))}
        ${scoutMetric("RA/G", raPerGame.toFixed(1))}
        ${scoutMetric("Run Diff", signedNumber(differential))}
        ${scoutMetric("Last 10", team.last10)}
      </div>
    </article>
    <div class="scouting-grid">
      <article class="scouting-card">
        <div class="mini-head">
          <h3>Circle These Bats</h3>
          <span>Top five by AVG</span>
        </div>
        ${renderScoutingHitters(hitters, team)}
      </article>
      <article class="scouting-card">
        <div class="mini-head">
          <h3>Pitching Looks</h3>
          <span>${pitchers.length ? "Likely arms" : "No listed arms"}</span>
        </div>
        ${renderScoutingPitchers(pitchers, team)}
      </article>
      <article class="scouting-card scout-plan-card">
        <div class="mini-head">
          <h3>Coach's Plan</h3>
          <span>${scoutingRefreshState === "live" ? "Live data" : "Snapshot"}</span>
        </div>
        <ul class="scout-plan">
          ${gamePlan.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </article>
    </div>
  `;
}

function renderScoutingHitters(hitters, team) {
  if (!hitters.length) {
    const league = scoutingData.leagueLeaders.hitters.slice(0, 5);
    return `<p class="player-meta">No team-specific batting leaders were available. Keep the AA league leaders on the card:</p>
      <div class="scout-list">${league.map((row) => hitterScoutRow(row)).join("")}</div>`;
  }
  const missing = Math.max(0, 5 - hitters.length);
  return `<div class="scout-list">
    ${hitters.slice(0, 5).map((row) => hitterScoutRow(row, team)).join("")}
    ${Array.from({ length: missing }).map(() => `<div class="scout-row scout-row-muted">
      <strong>Refresh for next listed bat</strong>
      <span>${escapeHtml(team.code)}</span>
      <span>-</span>
      <span class="scout-value">--</span>
    </div>`).join("")}
  </div>`;
}

function scoutingTopHitters(team) {
  const seen = new Set();
  return [
    ...(team.hitters || []),
    ...scoutingData.leagueLeaders.hitters.filter((leader) => leader.team === team.code)
  ]
    .filter((row) => {
      const key = normalizeScoutName(row.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number.parseFloat(b.avg || "0") - Number.parseFloat(a.avg || "0"))
    .slice(0, 5);
}

function hitterScoutRow(row) {
  const side = row.pos || row.team || "-";
  return `<div class="scout-row">
    <strong>${escapeHtml(row.name)}</strong>
    <span>${escapeHtml(side)}</span>
    <span>${Number(row.ab || 0)} AB</span>
    <span class="scout-value">${escapeHtml(row.avg || "-")}</span>
  </div>`;
}

function renderScoutingPitchers(pitchers) {
  if (!pitchers.length) {
    const league = scoutingData.leagueLeaders.pitchers.slice(0, 5);
    return `<p class="player-meta">No team-specific pitching leaders were available. Scout the AA run prevention leaders first:</p>
      <div class="scout-list">${league.map((row) => pitcherScoutRow(row)).join("")}</div>`;
  }
  return `<div class="scout-list">${pitchers.slice(0, 7).map((row) => pitcherScoutRow(row)).join("")}</div>`;
}

function pitcherScoutRow(row) {
  const record = row.l === undefined ? `${row.w ?? "-"} W` : `${row.w ?? "-"}-${row.l ?? "-"}`;
  const strikeouts = row.k === undefined ? "" : `<span>${Number(row.k || 0)} K</span>`;
  return `<div class="scout-row">
    <strong>${escapeHtml(row.name)}</strong>
    <span>${escapeHtml(row.team || record)}</span>
    ${strikeouts}
    <span class="scout-value">${escapeHtml(row.era || "-")} ERA</span>
  </div>`;
}

function buildScoutingGamePlan(team, hitters, pitchers, rfPerGame, raPerGame) {
  const topHitter = hitters[0];
  const topPitcher = pitchers[0];
  const runDiff = (team.rf || 0) - (team.ra || 0);
  const winPct = Number.parseFloat(team.winPct || "0");
  const teamRank = [...scoutingData.teams]
    .sort((a, b) => Number.parseFloat(b.winPct || "0") - Number.parseFloat(a.winPct || "0"))
    .findIndex((item) => item.id === team.id) + 1;
  const bestAvg = Number.parseFloat(topHitter?.avg || "0");
  const topFiveAverage = divide(
    hitters.reduce((sum, hitter) => sum + Number.parseFloat(hitter.avg || "0"), 0),
    hitters.length || 1
  );
  const plan = [];
  if (topHitter) {
    plan.push(`${topHitter.name} is the first red flag at ${topHitter.avg}. With runners on, expand carefully and make the next bat prove it.`);
  }
  if (topPitcher) {
    const pitcherShape = topPitcher.k ? `${topPitcher.k} strikeouts` : `${topPitcher.w ?? "-"} wins`;
    plan.push(`Prepare for ${topPitcher.name}: ${topPitcher.era || "--"} ERA with ${pitcherShape}. Track first-pitch strikes and make him show command from the stretch.`);
  }
  if (winPct >= 0.65) {
    plan.push(`They sit near the top of AA at ${team.record}. We need clean first innings: no free 90s, no extra outs, no missed cutoff throws.`);
  } else if (winPct <= 0.4) {
    plan.push(`Their ${team.record} profile says pressure matters. Score first, run the bases hard, and force them to defend every routine ball.`);
  } else {
    plan.push(`This is a middle-table matchup. Win counts early and avoid giving their top five a second chance with runners aboard.`);
  }
  if (rfPerGame >= 6.5 && runDiff > 0) {
    plan.push(`${team.rf} runs for is real offense. Keep double-play depth ready and treat walks before the order turns over like doubles.`);
  } else if (team.ra > team.rf) {
    plan.push(`${team.ra} runs allowed gives us an opening. Bunt looks, steal reads, and first-to-third pressure should stay on until they stop it.`);
  } else {
    plan.push(`Their run margin is ${signedNumber(runDiff)}. One clean defensive inning after we score can swing this game.`);
  }
  if (topFiveAverage >= 0.4) {
    plan.push(`The listed top bats average ${topFiveAverage.toFixed(3).replace(/^0/, "")}. Pitch to the bottom edge and make them hit our pitch, not theirs.`);
  } else if (bestAvg > 0) {
    plan.push(`The danger is concentrated at the top. Do not let the ${teamRank}${ordinalSuffix(teamRank)}-ranked profile get free traffic for ${topHitter.name}.`);
  }
  return plan;
}

function ordinalSuffix(value) {
  if ([11, 12, 13].includes(value % 100)) return "th";
  if (value % 10 === 1) return "st";
  if (value % 10 === 2) return "nd";
  if (value % 10 === 3) return "rd";
  return "th";
}

function scoutMetric(label, value) {
  return `<div class="scout-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function gamesFromRecord(record) {
  return String(record || "")
    .split("-")
    .map((part) => Number(part) || 0)
    .reduce((sum, value) => sum + value, 0);
}

function signedNumber(value) {
  return value > 0 ? `+${value}` : String(value);
}

function normalizeScoutName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function teamStatsPageUrl(team) {
  if (!team) return PITTSBURGH_NABA_URL;
  if (team.statsUrl) return team.statsUrl;
  try {
    const url = new URL(team.url || PITTSBURGH_NABA_URL, window.location.href);
    const teamCode = url.searchParams.get("u");
    if (teamCode) {
      return `https://www.pittsburghnaba.org/teams/default.asp?u=${encodeURIComponent(teamCode)}&s=baseball&p=stats`;
    }
  } catch (error) {
    // Fall back to the league page when a team URL is not parseable.
  }
  return team.url || PITTSBURGH_NABA_URL;
}

function renderSeasonStats() {
  updateSortIndicators();
  const hittingRows = state.roster
    .map((player) => ({ player, hit: statsForPlayer(player.id), gp: gamesPlayedForPlayer(player.id) }))
    .sort((a, b) => compareHittingRows(a, b));
  els.hittingStatsBody.innerHTML = hittingRows
    .map(({ player, hit, gp }) => {
      return `<tr>
        <td>#${escapeHtml(player.number)} ${escapeHtml(player.name)}</td>
        <td>${gp}</td>
        <td>${hit.pa}</td>
        <td>${hit.ab}</td>
        <td>${hit.h}</td>
        <td>${hit.singles}</td>
        <td>${hit.doubles}</td>
        <td>${hit.triples}</td>
        <td>${hit.hr}</td>
        <td>${formatRate(hit.avg)}</td>
        <td>${formatRate(hit.obp)}</td>
        <td>${formatRate(hit.slg)}</td>
        <td>${formatRate(hit.ops)}</td>
        <td>${hit.rbi}</td>
        <td>${hit.bb}</td>
        <td>${hit.k}</td>
        <td>${hit.sb}</td>
        <td>${hit.roe}</td>
        <td>${hit.errors}</td>
      </tr>`;
    })
    .join("");
  els.pitchingStatsBody.innerHTML = state.roster
    .map((player) => ({ player, pit: pitcherStats(player.id) }))
    .sort((a, b) => comparePitchingRows(a, b))
    .map(({ player, pit }) => {
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
  els.statsSprayPanel.classList.toggle("is-visible", statsSprayExpanded);
  els.toggleStatsSprayBtn.textContent = statsSprayExpanded ? "Close Spray Chart" : "Open Spray Chart";
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

function renderLeaders() {
  const hitterRows = state.roster.map((player) => ({ player, stats: statsForPlayer(player.id) }));
  const pitcherRows = state.roster.map((player) => ({ player, stats: pitcherStats(player.id) }));
  els.leadersGrid.innerHTML = [
    leaderCard("AVG", hitterRows, (row) => row.stats.avg, (value) => formatRate(value)),
    leaderCard("RBI", hitterRows, (row) => row.stats.rbi, String),
    leaderCard("OPS", hitterRows, (row) => row.stats.ops, (value) => formatRate(value)),
    leaderCard("Pitching K", pitcherRows, (row) => row.stats.k, String),
    leaderCard("WHIP", pitcherRows, (row) => row.stats.whip, (value) => value.toFixed(2), true)
  ].join("");
}

function leaderCard(label, rows, scorer, formatter, lowWins = false) {
  const leaders = rows
    .filter((row) => scorer(row) > 0 || (row.player.active && !lowWins))
    .sort((a, b) => lowWins ? scorer(a) - scorer(b) : scorer(b) - scorer(a))
    .slice(0, 3);
  return `<article class="leader-card">
    <h3>${escapeHtml(label)}</h3>
    ${leaders.map((row, index) => `<div class="leader-row">
      <span>${index + 1}. ${escapeHtml(row.player.name)}</span>
      <strong>${escapeHtml(formatter(scorer(row)))}</strong>
    </div>`).join("") || `<p class="player-meta">No data yet.</p>`}
  </article>`;
}

function gamesPlayedForPlayer(playerId) {
  return state.games.filter((game) => gameLineupPlayerIds(game).includes(playerId) || game.events.some((event) => event.playerId === playerId)).length;
}

function updateSortIndicators() {
  document.querySelectorAll("[data-hit-sort]").forEach((button) => {
    const active = button.dataset.hitSort === hittingSort.key;
    button.classList.toggle("is-sorted", active);
    button.dataset.direction = active ? hittingSort.direction : "";
  });
  document.querySelectorAll("[data-pit-sort]").forEach((button) => {
    const active = button.dataset.pitSort === pitchingSort.key;
    button.classList.toggle("is-sorted", active);
    button.dataset.direction = active ? pitchingSort.direction : "";
  });
}

function compareHittingRows(a, b) {
  const key = hittingSort.key;
  const direction = hittingSort.direction === "asc" ? 1 : -1;
  const valueFor = (row) => {
    if (key === "name") return row.player.name;
    if (key === "gp") return row.gp;
    return row.hit[key] ?? 0;
  };
  const left = valueFor(a);
  const right = valueFor(b);
  if (typeof left === "string") return left.localeCompare(right) * direction;
  return (left - right) * direction;
}

function comparePitchingRows(a, b) {
  const key = pitchingSort.key;
  const direction = pitchingSort.direction === "asc" ? 1 : -1;
  const valueFor = (row) => key === "name" ? row.player.name : row.pit[key] ?? 0;
  const left = valueFor(a);
  const right = valueFor(b);
  if (typeof left === "string") return left.localeCompare(right) * direction;
  return (left - right) * direction;
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
    dp: 0,
    tb: 0,
    rbi: 0,
    sb: 0,
    cs: 0,
    roe: 0,
    errors: 0,
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
  if (rule.dp) stats.dp += 1;
  if (rule.sb) stats.sb += 1;
  if (rule.cs) stats.cs += 1;
  if (event.result === "ROE") stats.roe += 1;
  if (event.errorOnPlay) stats.errors += 1;
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
  saveState();
  const blob = new Blob([exportSeasonAsJson(loadGameLibrary())], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `oakmont-lions-season-${todayValue()}.json`;
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

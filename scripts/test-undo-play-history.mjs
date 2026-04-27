import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const stylesCss = readFileSync(join(rootDir, "styles.css"), "utf8");

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeAtBat(overrides = {}) {
  return {
    balls: 1,
    strikes: 2,
    pitches: [{ type: "ball", ballsAfter: 1, strikesAfter: 0 }],
    pendingInPlay: false,
    ...overrides
  };
}

function makeGame(overrides = {}) {
  const game = {
    id: "game-test",
    inning: 1,
    half: "top",
    outs: 1,
    bases: { first: "runner-1", second: false, third: false },
    batterIndex: 2,
    opponentBatterIndex: 0,
    pitcherId: "pitcher-1",
    score: { lions: 0, opponent: 0, away: 0, home: 0 },
    current: {
      inning: 1,
      half: "top",
      outs: 1,
      balls: 1,
      strikes: 2,
      batterId: "batter-3",
      pitcherId: "pitcher-1",
      runners: { first: "runner-1", second: false, third: false }
    },
    atBat: makeAtBat(),
    events: [{ id: "event-before", result: "1B" }],
    plateAppearances: [{ id: "pa-open", result: null }],
    currentPlateAppearanceId: "pa-open",
    playHistory: []
  };
  return { ...game, ...clone(overrides) };
}

function snapshotForHistory(game) {
  const snapshot = clone(game);
  snapshot.playHistory = [];
  return snapshot;
}

function pushHistory(game) {
  game.playHistory.push({
    id: `history-${game.playHistory.length + 1}`,
    game: snapshotForHistory(game),
    pending: { scoringStep: "pitch" }
  });
}

function restoreLastPlay(game) {
  const history = game.playHistory;
  const entry = history[history.length - 1];
  assert.ok(entry, "history entry should exist");
  const restored = clone(entry.game);
  restored.playHistory = history.slice(0, -1);
  return restored;
}

function applyCompletedPlay(game, { runs = 0, outs = 0, basesAfter = game.bases, result = "GO" } = {}) {
  pushHistory(game);
  game.score.lions += runs;
  game.events.push({ id: `event-${game.events.length + 1}`, result, runs });
  game.current.outs += outs;
  game.outs = game.current.outs;
  game.bases = clone(basesAfter);
  game.current.runners = clone(basesAfter);
  game.atBat = { balls: 0, strikes: 0, pitches: [], pendingInPlay: false };
  game.current.balls = 0;
  game.current.strikes = 0;
  game.currentPlateAppearanceId = "";
  if (game.outs >= 3) {
    game.half = "bottom";
    game.current.half = "bottom";
    game.outs = 0;
    game.current.outs = 0;
    game.bases = { first: false, second: false, third: false };
    game.current.runners = clone(game.bases);
  }
  return game;
}

function undoPitch(game) {
  const pitch = game.atBat.pitches.pop();
  if (!pitch) return null;
  const previous = game.atBat.pitches[game.atBat.pitches.length - 1];
  game.atBat.balls = previous?.ballsAfter || 0;
  game.atBat.strikes = previous?.strikesAfter || 0;
  game.current.balls = game.atBat.balls;
  game.current.strikes = game.atBat.strikes;
  return pitch;
}

const finalizeBody = functionBody(appJs, "finalizePlateAppearance");
assert.ok(
  finalizeBody.indexOf("pushPlayHistorySnapshot") < finalizeBody.indexOf("applyRunnerAdvancements"),
  "plate appearance history snapshot should be pushed before play state mutates"
);
assert.match(functionBody(appJs, "recordSteal"), /pushPlayHistorySnapshot\(game, \{ reason: "runnerAction"/, "steal/caught stealing should push play history");
assert.match(functionBody(appJs, "recordPickoff"), /pushPlayHistorySnapshot\(game, \{ reason: "runnerAction"/, "pickoff should push play history");
assert.match(functionBody(appJs, "recordTagUp"), /pushPlayHistorySnapshot\(game, \{ reason: "runnerAction"/, "tag up should push play history");
assert.match(functionBody(appJs, "undoLastPlay"), /restorePlayHistorySnapshot\(game, historyEntry, history\.slice\(0, -1\)\)/, "Undo Play should restore from playHistory");
assert.doesNotMatch(functionBody(appJs, "undoLastPlay"), /events\.pop\(/, "Undo Play should not reverse-calculate by popping events");
assert.doesNotMatch(functionBody(appJs, "undoPitch"), /playHistory/, "Undo Pitch should remain independent from play history");
assert.match(appJs, /dockUndoLastPlayBtn\.disabled = !canScore \|\| !hasPlayHistory\(game\)/, "Undo Play should disable without play history");
assert.match(appJs, /pitchSecondaryIconMarkup\("history"\)|pitchSecondaryIconMarkup\(iconType\)/, "Undo Play should use a history-style secondary icon");
assert.match(stylesCss, /pitch-choice-secondary-row[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/, "Pitch Mode secondary row should align three actions");

{
  const before = makeGame();
  const game = clone(before);
  applyCompletedPlay(game, { outs: 1, result: "GO" });
  const restored = restoreLastPlay(game);
  assert.deepEqual(restored.score, before.score, "non-inning undo restores score");
  assert.equal(restored.inning, before.inning, "non-inning undo restores inning");
  assert.equal(restored.half, before.half, "non-inning undo restores half");
  assert.equal(restored.outs, before.outs, "non-inning undo restores outs");
  assert.deepEqual(restored.bases, before.bases, "non-inning undo restores bases");
  assert.deepEqual(restored.atBat, before.atBat, "non-inning undo restores count and pitch state");
  assert.equal(restored.batterIndex, before.batterIndex, "non-inning undo restores current batter");
  assert.equal(restored.events.length, before.events.length, "non-inning undo restores play history/events");
}

{
  const before = makeGame({ outs: 2, current: { ...makeGame().current, outs: 2 } });
  const game = clone(before);
  applyCompletedPlay(game, { outs: 1, result: "GO" });
  assert.equal(game.half, "bottom", "test setup should switch half innings");
  const restored = restoreLastPlay(game);
  assert.equal(restored.half, "top", "half-inning undo restores previous half");
  assert.equal(restored.outs, 2, "half-inning undo restores previous outs");
  assert.deepEqual(restored.bases, before.bases, "half-inning undo restores previous runners");
  assert.deepEqual(restored.atBat, before.atBat, "half-inning undo restores previous count and pitches");
}

{
  const before = makeGame({
    bases: { first: "runner-1", second: "runner-2", third: "runner-3" },
    current: {
      ...makeGame().current,
      runners: { first: "runner-1", second: "runner-2", third: "runner-3" }
    }
  });
  const game = clone(before);
  applyCompletedPlay(game, {
    runs: 4,
    basesAfter: { first: false, second: false, third: false },
    result: "HR"
  });
  assert.equal(game.score.lions, 4, "test setup should score runs");
  const restored = restoreLastPlay(game);
  assert.deepEqual(restored.score, before.score, "scoring play undo restores score");
  assert.deepEqual(restored.bases, before.bases, "scoring play undo restores bases");
  assert.equal(restored.events.length, before.events.length, "scoring play undo restores play history/events");
}

{
  const game = makeGame({ playHistory: [{ id: "history-keep", game: snapshotForHistory(makeGame()), pending: {} }] });
  const eventsBefore = game.events.length;
  const historyBefore = game.playHistory.length;
  undoPitch(game);
  assert.equal(game.events.length, eventsBefore, "Undo Pitch does not remove completed play events");
  assert.equal(game.playHistory.length, historyBefore, "Undo Pitch does not consume Undo Play history");
  assert.equal(game.atBat.balls, 0, "Undo Pitch only changes pitch/count state");
}

console.log("Undo Play history regression checks passed.");

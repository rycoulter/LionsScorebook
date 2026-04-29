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

assert.match(appJs, /let scoreCompleteSummaryGameId = ""/, "Score Game should track a final game summary focus");
assert.match(
  functionBody(appJs, "scoreCompleteSummaryGame"),
  /gameIsFinal\(game\)[\s\S]*return game/,
  "Final score summary focus should only resolve completed games"
);
assert.match(
  functionBody(appJs, "activeGame"),
  /currentView === "score" \? scoreCompleteSummaryGame\(\) : null[\s\S]*if \(completedScoreGame\) return completedScoreGame/,
  "Score Game should keep the completed game in focus for the summary screen"
);
assert.match(
  functionBody(appJs, "activeScoreGame"),
  /currentView === "score" \? scoreCompleteSummaryGame\(\) : null[\s\S]*if \(completedScoreGame\) return completedScoreGame/,
  "Score Game empty-state logic should treat the completed summary game as the score game"
);
assert.match(
  appJs,
  /gameId !== scoreCompleteSummaryGameId[\s\S]*clearGameCompleteSummary\(\)/,
  "Opening a different active game should clear stale final-summary focus"
);
assert.match(
  functionBody(appJs, "advanceHalfInning"),
  /if \(gameIsFinal\(game\)\) \{[\s\S]*markGameSyncPending\(game\);[\s\S]*showGameCompleteSummary\(game\);[\s\S]*moveActiveGameOffFinal\(game\.id\);[\s\S]*\}/,
  "A scoring play that completes the game should open the score-game summary before moving off active scoring"
);
assert.match(
  functionBody(appJs, "finishGame"),
  /showGameCompleteSummary\(current\)[\s\S]*moveActiveGameOffFinal\(current\.id\)/,
  "Manual complete should use the same score-game summary transition"
);
assert.match(
  functionBody(appJs, "renderScoringStepPanel"),
  /gameIsFinal\(game\)[\s\S]*renderGameCompleteSummary\(game\)/,
  "Final score games should render the dedicated Game Complete summary"
);
assert.match(
  functionBody(appJs, "renderGameCompleteSummary"),
  /data-game-complete-action="boxscore"[\s\S]*data-game-complete-action="sync"[\s\S]*data-game-complete-action="leave"[\s\S]*data-game-complete-action="undo"/,
  "Game Complete summary should expose box score, sync, leave, and undo actions"
);
assert.match(
  functionBody(appJs, "setScoreGameLocked"),
  /control\.matches\("\[data-game-complete-action\]"\)[\s\S]*return/,
  "Final score-game lock should not disable the Game Complete summary actions"
);
assert.match(
  functionBody(appJs, "handleGameCompleteAction"),
  /action === "leave"[\s\S]*clearGameCompleteSummary\(game\.id\)[\s\S]*switchView\("games"\)/,
  "Leave Score Game should only exit the score screen and clear the final summary focus"
);
assert.match(
  functionBody(appJs, "handleGameCompleteAction"),
  /action === "undo"[\s\S]*undoLastPlay\(\{ allowFinal: true \}\)/,
  "Final summary should allow correcting the final play through Undo Last Play"
);
assert.match(
  functionBody(appJs, "undoLastPlay"),
  /allowFinal[\s\S]*if \(!allowFinal && gameIsScoreLocked\(game\)\) return/,
  "Undo Last Play should remain locked normally but allow final-summary correction"
);
assert.match(
  appJs,
  /SCORING_PANEL_POINTERUP_ACTION_SELECTOR = \[[\s\S]*button\[data-game-complete-action\]/,
  "Game Complete action buttons should use the iPad pointerup action path"
);

assert.match(stylesCss, /#scoreView \.score-complete-summary[\s\S]*display: grid/, "Game Complete summary should have dedicated layout styles");
assert.match(stylesCss, /#scoreView \.score-complete-actions[\s\S]*flex-wrap: wrap/, "Game Complete actions should stay compact and responsive");

console.log("Game complete summary checks passed.");

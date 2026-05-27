import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const supabaseStorageJs = readFileSync(join(rootDir, "supabase-storage.js"), "utf8");

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

const configureDatesBody = functionBody(appJs, "configureGameDateInputs");
assert.match(configureDatesBody, /removeAttribute\("min"\)/, "Game date inputs should not enforce today as the minimum date");
assert.doesNotMatch(functionBody(appJs, "scheduleGame"), /isPastGameDate|future date/, "Creating a game should allow past dates");
assert.doesNotMatch(functionBody(appJs, "saveGameEdits"), /isPastGameDate|future date/, "Editing a game should allow past dates");

assert.match(indexHtml, /id="quickScoreModal"/, "Quick Score modal should be present in the HTML");
assert.match(indexHtml, /id="quickScoreLionsInput"/, "Quick Score modal should collect Lions score");
assert.match(indexHtml, /id="quickScoreOpponentInput"/, "Quick Score modal should collect opponent score");

const quickActionBody = functionBody(appJs, "renderQuickScoreAction");
assert.match(quickActionBody, /data-game-action="quick-score"/, "Schedule cards should render a Quick Score action");
assert.match(quickActionBody, /gameIsFinal\(game\)/, "Quick Score should not be shown for final games");

assert.match(functionBody(appJs, "renderScheduleFeaturedGameCard"), /renderQuickScoreAction\(game, "schedule-quick-score-feature"\)/, "Featured schedule card should include Quick Score");
assert.match(functionBody(appJs, "renderScheduleUpcomingRow"), /renderQuickScoreAction\(game, "schedule-quick-score-row"\)/, "Upcoming schedule rows should include Quick Score");
assert.match(functionBody(appJs, "renderScheduleGameCard"), /renderQuickScoreAction\(game, "schedule-quick-score-card"\)/, "Full schedule game cards should include Quick Score");

const handleActionBody = functionBody(appJs, "handleGameActionClick");
assert.match(handleActionBody, /gameAction === "quick-score"[\s\S]*openQuickScoreModal\(gameId\)/, "Quick Score card actions should open the modal");

const saveQuickScoreBody = functionBody(appJs, "saveQuickScoreResult");
assert.match(saveQuickScoreBody, /syncScoreBySide\(game\)/, "Quick Score should keep side scores in sync");
assert.match(saveQuickScoreBody, /completeGameLocally\(game, \{ scoringSource: "quick-score", quickScored: true \}\)/, "Quick Score should finalize through the shared completion helper");
assert.match(saveQuickScoreBody, /requestSharedSnapshotSync\("quick-score"\)/, "Quick Score should publish the schedule score update");

const completeGameBody = functionBody(appJs, "completeGameLocally");
assert.match(completeGameBody, /game\.status = "completed"/, "Completion helper should mark the game completed");
assert.match(completeGameBody, /game\.quickScored = true/, "Completion helper should preserve the quick-score final marker");
assert.match(completeGameBody, /markSharedGamesDirty\(game\.id\)/, "Completion helper should mark the game dirty for shared schedule sync");
assert.match(completeGameBody, /markGameSyncPending\(game\)/, "Completion helper should mark the completed game for sync");
assert.match(completeGameBody, /clearLiveGameSnapshotSyncTimer\(\)/, "Completion helper should cancel stale live checkpoint timers");

const gameIsFinalBody = functionBody(appJs, "gameIsFinal");
assert.match(gameIsFinalBody, /game\.quickScored === true/, "Quick-scored games should be final even if a stale status is loaded");

const normalizeGameBody = functionBody(appJs, "normalizeGame");
assert.match(normalizeGameBody, /game\.quickScored === true \? "completed"/, "Normalization should recover stale quick-scored games as completed");

const completeScheduledBody = functionBody(appJs, "completeScheduledGame");
assert.match(completeScheduledBody, /completeGameLocally\(game\)/, "Manual Mark Final should use the shared completion helper");
assert.match(completeScheduledBody, /requestSharedSnapshotSync\("complete-game"\)/, "Manual Mark Final should publish the completed schedule state");

const storageFinalBody = functionBody(supabaseStorageJs, "isFinalGameData");
assert.match(storageFinalBody, /game\.quickScored === true/, "Supabase game rows should treat quick-scored games as final");

const buildGameRowBody = functionBody(supabaseStorageJs, "buildGameRow");
assert.match(buildGameRowBody, /status: isFinalGameData\(game\) \? "completed" : game\.status \|\| "scheduled"/, "Supabase game rows should publish quick-scored status as completed");

console.log("Quick score schedule checks passed.");

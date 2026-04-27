import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const supabaseStorageJs = readFileSync(join(rootDir, "supabase-storage.js"), "utf8");

function mustMatch(source, pattern, label) {
  assert.match(source, pattern, label);
}

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

const saveStateBody = functionBody(appJs, "saveState");
mustMatch(saveStateBody, /liveGameBeforeNormalize[\s\S]*pendingScoringSnapshot\(\)/, "saveState should capture active scoring checkpoint before local persistence");
mustMatch(saveStateBody, /options\.capturePendingScoring !== false/, "saveState should allow remote refreshes to avoid overwriting restored pending scoring");
mustMatch(saveStateBody, /queueLiveGameSnapshotSync\(activeGameObject,[\s\S]*live-game-save/, "saveState should queue live-game cloud checkpoint syncs by default");
mustMatch(saveStateBody, /options\.markLiveGamesDirty !== false/, "saveState should allow internal sync paths to suppress live-game dirty marking");

const cloudSyncBody = functionBody(appJs, "isCloudSyncedGame");
mustMatch(cloudSyncBody, /Boolean\(game\?\.id\)/, "cloud snapshot eligibility should include active games");
assert.equal(/status !== "active"/.test(cloudSyncBody), false, "active games should not be excluded from Supabase snapshots");

const sharedSnapshotBody = functionBody(appJs, "buildSharedSnapshot");
mustMatch(sharedSnapshotBody, /activeSharedGame[\s\S]*status === "active"/, "shared snapshots should identify the current active game");
mustMatch(sharedSnapshotBody, /activeGameId: activeSharedGame\?\.id \|\| ""/, "shared app_state should publish active_game_id for live resume");

const queueLiveBody = functionBody(appJs, "queueLiveGameSnapshotSync");
mustMatch(queueLiveBody, /markSharedGamesDirty\(game\.id\)/, "live-game sync queue should mark the active game dirty before syncing");
mustMatch(queueLiveBody, /LIVE_GAME_SYNC_DEBOUNCE_MS/, "live-game sync should be debounced");
mustMatch(queueLiveBody, /requestLiveGameSnapshotSync\(reason\)/, "debounced live-game sync should publish through the shared snapshot path");

const requestLiveBody = functionBody(appJs, "requestLiveGameSnapshotSync");
mustMatch(requestLiveBody, /activeLiveGameForState\(state\)/, "live-game sync should target the current active game");
mustMatch(requestLiveBody, /requestSharedSnapshotSync\(reason\)/, "live-game sync should reuse the existing Supabase snapshot writer");

const overlaySharedBody = functionBody(appJs, "overlaySessionSharedChanges");
mustMatch(overlaySharedBody, /pendingSharedGameIds\.forEach[\s\S]*mergedGamesById\.set\(gameId, deepClone\(localGame\)\)/, "dirty in-session game changes should overlay remote snapshots");
assert.equal(
  /localGame\.status === "active"/.test(overlaySharedBody),
  false,
  "dirty active games should not be skipped while merging a fresh Supabase baseline"
);

const refreshBody = functionBody(appJs, "refreshSupabaseState");
mustMatch(refreshBody, /restoreActiveGamePendingScoringState\(\)/, "remote active games should restore pending scoring UI state after bootstrap");
mustMatch(refreshBody, /saveState\(\{ markLiveGamesDirty: false, capturePendingScoring: false \}\)/, "remote refresh should not immediately dirty or overwrite live checkpoints");

const restorePendingBody = functionBody(appJs, "restoreActiveGamePendingScoringState");
mustMatch(restorePendingBody, /restorePendingScoringSnapshot\(game\.pendingScoring\)/, "active game pending scoring checkpoint should be restored into UI state");
mustMatch(restorePendingBody, /syncGameCurrent\(game\)/, "restored active game should sync current inning/count/bases fields");

const inProgressBody = functionBody(appJs, "inProgressGames");
mustMatch(inProgressBody, /left\.id === state\.activeGameId/, "home live game ordering should prefer the selected active game");

const adminBody = functionBody(appJs, "applySupabaseAdminState");
mustMatch(adminBody, /requestLiveGameSnapshotSync\("admin-ready-live-game"\)/, "admin sign-in should flush any pending live-game checkpoint");

mustMatch(appJs, /requestLiveGameSnapshotSync\("online-live-game"\)/, "coming back online should flush live-game checkpoints");

const liveSyncStatusBody = functionBody(appJs, "renderLiveSyncStatus");
mustMatch(liveSyncStatusBody, /Live scoring checkpoint synced/, "active-game sync status should mention live resume checkpoints");
mustMatch(liveSyncStatusBody, /auto-syncing for resume/, "active-game sync status should explain live autosave behavior");

const appStateRowBody = functionBody(supabaseStorageJs, "buildAppStateRow");
mustMatch(appStateRowBody, /active_game_id: state\?\.activeGameId \|\| ""/, "Supabase app_state should store active_game_id for live resume");

console.log("Live game resume sync checks passed.");

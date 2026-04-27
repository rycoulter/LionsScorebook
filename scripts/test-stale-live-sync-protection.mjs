import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const supabaseStorageJs = readFileSync(join(rootDir, "supabase-storage.js"), "utf8");

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

const appFinalGuardBody = functionBody(appJs, "remoteFinalGameBlocksLocalSync");
assert.match(appFinalGuardBody, /gameIsFinal\(remoteGame\)[\s\S]*!gameIsFinal\(localGame\)/, "remote final games should block stale local active checkpoints");

const overlayBody = functionBody(appJs, "overlaySessionSharedChanges");
assert.match(overlayBody, /const remoteGame = mergedGamesById\.get\(gameId\)/, "overlay should inspect the remote/baseline game before applying dirty local games");
assert.match(overlayBody, /remoteFinalGameBlocksLocalSync\(remoteGame, localGame\)[\s\S]*pendingSharedGameIds\.delete\(gameId\)[\s\S]*return/, "dirty stale active games should be cleared instead of overlaying completed remote games");

const buildGameRowBody = functionBody(supabaseStorageJs, "buildGameRow");
assert.match(buildGameRowBody, /is_final: isFinalGameData\(game\)/, "completed games should set Supabase is_final even when status is completed");

const mergeRemoteBody = functionBody(supabaseStorageJs, "mergeRemoteSnapshot");
assert.match(mergeRemoteBody, /remoteGame && isFinalGameData\(remoteGame\) && !isFinalGameData\(game\)[\s\S]*mergedGames\.push\(remoteGame\)/, "remote completed games should win over local stale active games while merging");
assert.match(mergeRemoteBody, /remoteGame && isFinalGameData\(game\) && !isFinalGameData\(remoteGame\)[\s\S]*mergedGames\.push\(game\)/, "local completed games should still win over stale remote active games while merging");

const upsertGamesBody = functionBody(supabaseStorageJs, "upsertGames");
assert.match(upsertGamesBody, /\.select\("id,status,is_final,game_data"\)/, "game upserts should inspect existing remote rows before writing");
assert.match(upsertGamesBody, /rowRepresentsFinalGame/, "game upserts should detect final remote rows");
assert.match(upsertGamesBody, /finalRemoteIds\.has\(row\.id\) && !isFinalGameData\(row\.game_data\)/, "active snapshots should not overwrite final remote games");
assert.match(upsertGamesBody, /skippedFinalGameIds/, "skipped stale live upserts should be reported as non-fatal skips");

console.log("Stale live sync protection checks passed.");

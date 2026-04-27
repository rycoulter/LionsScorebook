import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

assert.match(
  indexHtml,
  /id="subTypeSelect"[\s\S]*value="append"[\s\S]*Add hitter to end/,
  "Lions live lineup controls should expose Add hitter to end"
);
assert.match(
  indexHtml,
  /id="subMoveHint"/,
  "Lions live lineup controls should include a hint for append/substitution mode"
);

assert.match(
  appJs,
  /subTypeSelect\?\.addEventListener\("change", renderSubControls\)/,
  "Changing the Lions move type should rerender the live lineup controls"
);

const appendBody = functionBody(appJs, "appendLionsLineupHitter");
assert.match(appendBody, /currentEntries\.some\(\(entry\) => entry\.playerId === incomingPlayerId\)/, "Lions append should not add a hitter already in the active order");
assert.match(appendBody, /const lineupIndex = currentEntries\.length/, "Lions append should add the hitter after the current final spot");
assert.match(appendBody, /game\.lineupEntries = \[\.\.\.currentEntries, entry\]/, "Lions append should extend the current game lineup");
assert.match(appendBody, /game\.lineups\.away = deepClone\(game\.lineupEntries\)/, "Lions append should sync the game away lineup");
assert.match(appendBody, /result: "ADD"/, "Lions append should create an ADD lineup event");
assert.match(appendBody, /snapshotBefore: liveGameSnapshot\(game, \{[\s\S]*lineupEntries: deepClone\(currentEntries\)/, "Lions append should preserve the pre-move lineup snapshot");

const renderSubControlsBody = functionBody(appJs, "renderSubControls");
assert.match(renderSubControlsBody, /const appendMode = moveType === "append"/, "Lions sub controls should detect append mode");
assert.match(renderSubControlsBody, /els\.subSpotSelect\.disabled = appendMode/, "Lions append should disable lineup spot selection");
assert.match(renderSubControlsBody, /This hitter will be added as spot/, "Lions append should explain the new order spot");
assert.match(renderSubControlsBody, /els\.applySubBtn\.textContent = appendMode \? "Add Lions Hitter" : "Apply"/, "Lions append should change the action label");

const applyBody = functionBody(appJs, "applySubstitution");
assert.match(applyBody, /if \(type === "append"\) \{[\s\S]*appendLionsLineupHitter/, "Apply should route append mode to the Lions append helper");
assert.match(applyBody, /if \(!entryId\) return;[\s\S]*addSubstitution/, "Standard substitutions should still require an existing lineup spot");

console.log("Lions lineup append checks passed.");

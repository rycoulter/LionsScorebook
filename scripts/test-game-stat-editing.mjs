import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const stylesCss = readFileSync(join(rootDir, "styles.css"), "utf8");

function mustMatch(source, pattern, label) {
  assert.match(source, pattern, label);
}

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

mustMatch(indexHtml, /<th>Edit<\/th>/, "Hitting stats table should include an Edit column");
mustMatch(appJs, /statsEditButtonMarkup\(player\)/, "Hitting stats rows should render edit buttons");
mustMatch(appJs, /data-edit-hitting-player="\$\{escapeHtml\(player\.id\)\}"/, "Edit buttons should target a specific player");
mustMatch(appJs, /colspan="24" class="stats-empty-row"/, "Empty hitting stats row should span the added edit column");
mustMatch(stylesCss, /\.stats-row-edit-button[\s\S]*place-items: center/, "Edit button should have compact icon styling");

mustMatch(indexHtml, /id="statEditGameSelectModal"[\s\S]*Select Game to Edit/, "Select Game to Edit modal should exist");
mustMatch(indexHtml, /id="statEditGameModal"[\s\S]*Edit Game Stats/, "Edit Game Stats modal should exist");
["Ab", "H", "Singles", "Doubles", "Triples", "Hr", "Bb", "Hbp", "K", "Rbi", "Runs"].forEach((field) => {
  mustMatch(indexHtml, new RegExp(`id="statEdit${field}"`), `${field} input should exist`);
});
assert.equal(/id="statEdit(?:Avg|Obp|Slg|Ops|Total|Pa)"/i.test(indexHtml), false, "Derived or aggregate stats should not be directly editable");

mustMatch(appJs, /hittingStatEditMap\(game\)/, "Game-level hitting edit storage should exist");
mustMatch(appJs, /normalizeManualHittingStats/, "Manual game stat edits should be normalized before save");
mustMatch(appJs, /manualHittingStatEvents/, "Manual game stat lines should become stat-source events");
mustMatch(appJs, /sprayEventsForGame/, "Spray chart should read through the game-aware spray event helper");

const offenseBody = functionBody(appJs, "offensiveEventsForStatsGame");
mustMatch(offenseBody, /editedPlayerIds/, "Edited players should be handled specially");
mustMatch(offenseBody, /!\(eventRules\[event\.result\]\?\.pa\)/, "Editing a hitting line should replace PA events while preserving non-PA events");
mustMatch(offenseBody, /manualHittingStatEvents\(game, playerId, edit\)/, "Edited stat lines should feed season stat calculations");

const sprayBody = functionBody(appJs, "sprayEventsForGame");
mustMatch(sprayBody, /manualSprayEventsForGame\(game, playerId, edit\)/, "Edited spray dots should feed spray chart calculations");
mustMatch(sprayBody, /!editedPlayerIds\.has\(event\.playerId\)/, "Edited spray dots should replace original dots for that player/game");

const saveBody = functionBody(appJs, "saveStatEditGameStats");
mustMatch(saveBody, /hittingStatEditMap\(game\)\[player\.id\] = edit/, "Saving should write the edit to the selected game");
mustMatch(saveBody, /saveStateWithOptions\(\{ liveSyncReason: "game-stat-edit" \}\)/, "Saving should persist the game edit");
mustMatch(saveBody, /render\(\)/, "Saving should rerender stats and spray chart views immediately");
mustMatch(saveBody, /markSharedGamesDirty\(game\.id\)/, "Saving should mark the game dirty for shared sync");

mustMatch(stylesCss, /\.stat-edit-grid[\s\S]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/, "Game stat editor inputs should use a compact grid");
mustMatch(stylesCss, /\.stat-edit-spray-chart[\s\S]*min-height: 0 !important[\s\S]*aspect-ratio: 4 \/ 3/, "Game stat editor field should override the large generic spray chart height");
mustMatch(stylesCss, /\.stat-edit-spray-chart \.field-background-art[\s\S]*object-fit: contain/, "Game stat editor field art should fit inside the visible mini field");
mustMatch(stylesCss, /\.stat-edit-spray-chart[\s\S]*cursor: crosshair/, "Spray chart editor should be visibly interactive");
mustMatch(stylesCss, /\.stat-edit-spray-row[\s\S]*justify-content: space-between/, "Spray locations should render removable rows");

console.log("Game stat editing checks passed.");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const stylesCss = readFileSync(join(rootDir, "styles.css"), "utf8");

function mustMatch(source, pattern, label) {
  assert.match(source, pattern, label);
}

mustMatch(
  stylesCss,
  /select:not\(\.schedule-season-select\):not\(\.schedule-calendar-month-select\)\s*\{[\s\S]*color-scheme: dark;/,
  "Native dropdowns should inherit a dark app theme"
);
mustMatch(
  stylesCss,
  /select:not\(\[multiple\]\):not\(\.schedule-season-select\):not\(\.schedule-calendar-month-select\)\s*\{[\s\S]*appearance: none;[\s\S]*padding-right: 38px;[\s\S]*rgba\(245, 189, 33, 0\.94\)/,
  "Single-select dropdowns should use the branded gold caret"
);
mustMatch(
  stylesCss,
  /select option,\s*select optgroup\s*\{[\s\S]*background: #151a2d;[\s\S]*color: var\(--white\);/,
  "Dropdown option menus should be dark with white text"
);
mustMatch(
  stylesCss,
  /\.schedule-season-select option,\s*\.schedule-calendar-month-select option\s*\{[\s\S]*background: #151a2d;[\s\S]*color: var\(--white\);/,
  "Schedule chip dropdown option menus should stay dark"
);
mustMatch(
  stylesCss,
  /#scoreView \.spray-panel select\s*\{[\s\S]*rgba\(3, 10, 36, 0\.9\)[\s\S]*color: var\(--white\);[\s\S]*color-scheme: dark;/,
  "Score spray chart dropdown should not fall back to the old light theme"
);
mustMatch(
  stylesCss,
  /#scoreView \.game-pitcher-card select\s*\{[\s\S]*rgba\(245, 189, 33, 0\.94\)[\s\S]*rgba\(3, 10, 36, 0\.82\)[\s\S]*color: var\(--white\);/,
  "Mobile game pitcher dropdown override should keep the themed caret and dark background"
);

assert.doesNotMatch(
  stylesCss,
  /schedule-(?:season|calendar-month)-select option[\s\S]{0,120}color: #101722/,
  "Schedule dropdown options should not use the old light text color"
);
assert.doesNotMatch(
  stylesCss,
  /#scoreView \.spray-panel select\s*\{[\s\S]{0,180}background: rgba\(255, 255, 255, 0\.9\)/,
  "Score spray chart dropdown should not use a white background"
);
assert.doesNotMatch(
  stylesCss,
  /#scoreView \.game-pitcher-card select\s*\{[\s\S]{0,180}background: rgba\(255, 255, 255, 0\.08\)/,
  "Mobile game pitcher dropdown should not strip the themed caret with a plain light background"
);

for (const id of [
  "newsEditorGameSelect",
  "newsEditorCategory",
  "highlightsGameSelect",
  "highlightPlayersSelect",
  "scheduleSeasonSelect",
  "rosterFilter",
  "scorebookGameSelect",
  "boxScoreGameSelect",
]) {
  mustMatch(indexHtml, new RegExp(`id="${id}"`), `${id} should exist as a themed dropdown target`);
}

console.log("Themed dropdown checks passed.");

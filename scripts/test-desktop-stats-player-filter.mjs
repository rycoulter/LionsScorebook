import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const stylesCss = readFileSync(join(rootDir, "styles.css"), "utf8");

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

assert.match(indexHtml, /id="statsHittingExportBtn"[\s\S]*Export/, "Hitting export button should still exist");
assert.match(indexHtml, /id="desktopHitPlayerSelect"/, "Hitting stats should expose a desktop player filter");
assert.match(indexHtml, /id="desktopPitPlayerSelect"/, "Pitching stats should expose a desktop player filter");
assert.match(indexHtml, /class="stats-desktop-player-filter"[\s\S]*id="desktopHitPlayerSelect"[\s\S]*id="statsHittingExportBtn"/, "Hitting player filter should sit next to the export button");
assert.match(indexHtml, /class="stats-desktop-player-filter"[\s\S]*id="desktopPitPlayerSelect"[\s\S]*id="statsPitchingExportBtn"/, "Pitching player filter should sit next to the export button");

assert.match(appJs, /desktopHitPlayerSelect: document\.getElementById\("desktopHitPlayerSelect"\)/, "Desktop hitting filter should be registered");
assert.match(appJs, /desktopPitPlayerSelect: document\.getElementById\("desktopPitPlayerSelect"\)/, "Desktop pitching filter should be registered");
assert.match(appJs, /desktopHitPlayerSelect\?\.addEventListener\("change"[\s\S]*desktopHitPlayerFilter = els\.desktopHitPlayerSelect\.value \|\| "all"[\s\S]*renderSeasonStats\(\)/, "Desktop hitting filter should rerender stats on change");
assert.match(appJs, /desktopPitPlayerSelect\?\.addEventListener\("change"[\s\S]*desktopPitPlayerFilter = els\.desktopPitPlayerSelect\.value \|\| "all"[\s\S]*renderSeasonStats\(\)/, "Desktop pitching filter should rerender stats on change");

const renderBody = functionBody(appJs, "renderSeasonStats");
assert.match(renderBody, /renderDesktopStatsFilters\(allHittingRows, allPitchingRows\)/, "Season stats should populate desktop filter options before rendering tables");
assert.match(renderBody, /const hittingPlayerFilter = focusedPlayerId \|\| \(desktopHitPlayerFilter !== "all" \? desktopHitPlayerFilter : ""\)/, "Hitting rows should use the desktop player filter");
assert.match(renderBody, /const pitchingPlayerFilter = focusedPlayerId \|\| \(desktopPitPlayerFilter !== "all" \? desktopPitPlayerFilter : ""\)/, "Pitching rows should use the desktop player filter");

const exportBody = functionBody(appJs, "exportStatsTable");
assert.match(exportBody, /const playerFilter = statsFocusedPlayerId\(\) \|\| \(isPitching \? desktopPitPlayerFilter : desktopHitPlayerFilter\)/, "Stats export should respect the active desktop player filter");
assert.match(exportBody, /\.filter\(\(\{ player \}\) => playerFilter === "all" \|\| player\.id === playerFilter\)/, "Stats export should only include the selected player when filtered");

assert.match(stylesCss, /\.stats-desktop-player-filter \{[\s\S]*min-width: 220px/, "Desktop player filter should have compact table-header styling");
assert.match(stylesCss, /#statsView \.stats-table-actions \{[\s\S]*display: none;/, "Desktop filter should stay hidden with the table actions on mobile");

console.log("Desktop stats player filter checks passed.");

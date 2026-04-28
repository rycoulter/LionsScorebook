import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const stylesCss = readFileSync(join(rootDir, "styles.css"), "utf8");

assert.doesNotMatch(indexHtml, /Swipe for Pitching/, "Team Stats Snapshot should not need a swipe text hint");
assert.doesNotMatch(indexHtml, /Swipe to view more/, "Stats leader carousel should not need a swipe text hint");
assert.doesNotMatch(indexHtml, /stats-snapshot-swipe-note|stats-leaders-swipe-note/, "Removed swipe note markup should stay out of the stats page");
assert.doesNotMatch(stylesCss, /stats-snapshot-swipe-note|stats-leaders-swipe-note/, "Removed swipe note classes should not be reintroduced");

assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*#statsView \.stats-snapshot-grid \{[\s\S]*display: flex;[\s\S]*gap: 12px;[\s\S]*padding: 8px 18px 14px;[\s\S]*scroll-snap-type: x mandatory;[\s\S]*scroll-padding-inline: 18px;/, "Mobile snapshot grid should use the same carousel rhythm as the leader cards");
assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*#statsView \.stats-snapshot-slide \{[\s\S]*flex: 0 0 calc\(100% - 64px\);[\s\S]*width: calc\(100% - 64px\);[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*scroll-snap-align: start;[\s\S]*scroll-snap-stop: always;/, "Mobile snapshot slides should leave the next card visibly peeking on screen");
assert.match(stylesCss, /#statsView \.stats-leader-card \{[\s\S]*flex: 0 0 calc\(100% - 64px\);[\s\S]*width: calc\(100% - 64px\);/, "Leader cards should continue using the visible-next-card mobile pattern");

console.log("Mobile stats carousel checks passed.");

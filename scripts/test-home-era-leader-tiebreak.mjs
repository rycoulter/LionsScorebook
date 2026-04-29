import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

assert.match(
  appJs,
  /renderHomeLeaderFeatureCard\("ERA", pitcherRows, \(row\) => row\.stats\.era, formatEra, \{ lowWins: true, includeZero: true, tieBreaker: \(row\) => row\.stats\.outs \}\)/,
  "Home ERA leader should use pitcher outs as the tie-breaker"
);

const compareBody = functionBody(appJs, "compareLeaderRows");
assert.match(compareBody, /Math\.abs\(valueA - valueB\) > 0\.0000001/, "Leader compare should detect primary stat ties");
assert.match(compareBody, /tieBreaker\(a\)[\s\S]*tieBreaker\(b\)[\s\S]*return tieB - tieA/, "Tie-breaker should rank the larger tie-break value first");

const compareLeaderRows = (a, b, scorer, options = {}) => {
  const { lowWins = false, tieBreaker = null } = options;
  const valueA = Number(scorer(a));
  const valueB = Number(scorer(b));
  if (Math.abs(valueA - valueB) > 0.0000001) {
    return lowWins ? valueA - valueB : valueB - valueA;
  }
  if (typeof tieBreaker === "function") {
    const tieA = Number(tieBreaker(a)) || 0;
    const tieB = Number(tieBreaker(b)) || 0;
    if (tieA !== tieB) return tieB - tieA;
  }
  return String(a?.player?.name || "").localeCompare(String(b?.player?.name || ""));
};

const rows = [
  { player: { name: "Devin" }, stats: { era: 0, outs: 6 } },
  { player: { name: "Zach" }, stats: { era: 0, outs: 15 } }
];

const [leader] = rows.sort((a, b) => compareLeaderRows(a, b, (row) => row.stats.era, { lowWins: true, tieBreaker: (row) => row.stats.outs }));
assert.equal(leader.player.name, "Zach", "Tied ERA should prefer the pitcher with more innings pitched");

console.log("Home ERA leader tie-break checks passed.");

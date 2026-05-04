import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");

assert.match(appJs, /const ERA_GAME_INNINGS = 7;/, "ERA should use the 7-inning game baseline");

const eraFormulaMatches = [...appJs.matchAll(/stats\.era = stats\.ip \? \(stats\.earnedRuns \* ERA_GAME_INNINGS\) \/ stats\.ip : Number\.NaN;/g)];
assert.equal(eraFormulaMatches.length, 2, "Player and team pitching ERA should both use the 7-inning baseline");

const eraForSevenInningGame = (earnedRuns, outs) => {
  const ip = outs / 3;
  return ip ? (earnedRuns * 7) / ip : Number.NaN;
};

assert.equal(eraForSevenInningGame(2, 21).toFixed(2), "2.00", "2 ER over 7 IP should be a 2.00 ERA");
assert.equal(eraForSevenInningGame(1, 3).toFixed(2), "7.00", "1 ER over 1 IP should be a 7.00 ERA");

console.log("Seven-inning ERA checks passed.");

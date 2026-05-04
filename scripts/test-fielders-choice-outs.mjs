import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

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
  /FC:\s*\{\s*label:\s*"Fielder's choice",\s*pa:\s*true,\s*ab:\s*true,\s*bip:\s*true\s*\}/,
  "Fielder's choice should not add an automatic batter out"
);

const runtimeSource = [
  functionBody(appJs, "getDefaultRunnerAdvances"),
  functionBody(appJs, "summarizeRunnerAdvancements")
].join("\n\n");

const result = JSON.parse(runInNewContext(`
  const eventRules = {
    FC: { label: "Fielder's choice", pa: true, ab: true, bip: true }
  };
  function deepClone(value) { return JSON.parse(JSON.stringify(value)); }
  function emptyBases() { return { first: false, second: false, third: false }; }
  function isOccupied(value) { return Boolean(value); }
  function normalizeBallInPlayOutcome(value) { return value; }

  ${runtimeSource}

  const defaults = getDefaultRunnerAdvances("FC", {
    first: "runner-on-first",
    second: false,
    third: false,
    batter: "batter"
  });
  const movement = summarizeRunnerAdvancements(defaults.advancements);
  const outsRecorded = (eventRules.FC.out ? 1 : 0) + movement.outsRecorded;

  JSON.stringify({ defaults, movement, outsRecorded });
`, {}));

assert.equal(result.outsRecorded, 1, "FC with a runner forced out should record one total out");
assert.equal(result.movement.outsRecorded, 1, "FC should get its out from the runner advancement");
assert.deepEqual(
  result.defaults.advancements,
  [
    { runnerId: "runner-on-first", from: "first", out: true },
    { runnerId: "batter", from: "batter", to: "first" }
  ],
  "Default FC should remove the lead forced runner and put the batter on first"
);

console.log("Fielder's choice out-count checks passed.");

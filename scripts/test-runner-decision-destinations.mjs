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
  functionBody(appJs, "runnerOverrideOptions"),
  /runnerDestinationsAheadOf\(card\.start\)/,
  "Runner decision options should include every legal destination ahead of the runner"
);
assert.match(
  functionBody(appJs, "runnerOverrideLabel"),
  /return baseLabel\(option\)/,
  "Runner decision buttons should show explicit base labels"
);
assert.match(
  functionBody(appJs, "applyEvent"),
  /validateRunnerDecisionChoices\(game, result\)/,
  "Confirm Play should validate duplicate runner destinations before finalizing"
);

const runtimeSource = [
  functionBody(appJs, "baseLabel"),
  functionBody(appJs, "runnerOptionsForBase"),
  functionBody(appJs, "runnerDestinationsAheadOf"),
  functionBody(appJs, "runnerOverrideOptions"),
  functionBody(appJs, "runnerOverrideLabel"),
  functionBody(appJs, "defaultBatterDestination"),
  functionBody(appJs, "runnerChoiceDestination"),
  functionBody(appJs, "validateRunnerDecisionChoices")
].join("\n\n");

const runtimeResult = JSON.parse(runInNewContext(`
  let pendingRunnerChoices = {};
  const els = { resultSelect: { value: "1B" } };
  function activeGame() { return {}; }
  function emptyBases() { return { first: false, second: false, third: false }; }
  function isOccupied(value) { return Boolean(value); }
  function runnerName(value) {
    return { runnerFromFirst: "Ray Arch", runnerFromSecond: "Cory Reilly" }[value] || "";
  }
  function currentBatterLabel() { return "#66 Roy Butko"; }

  ${runtimeSource}

  const firstBaseCard = {
    base: "first",
    start: "1B",
    to: "second",
    automaticTo: "second",
    options: runnerOptionsForBase("first")
  };
  const secondBaseCard = {
    base: "second",
    start: "2B",
    to: "third",
    automaticTo: "third",
    options: runnerOptionsForBase("second")
  };
  const batterCard = {
    base: "batter",
    start: "Batter",
    to: "first",
    automaticTo: "first",
    options: runnerOptionsForBase("batter")
  };
  const game = {
    current: {
      runners: {
        first: "runnerFromFirst",
        second: "runnerFromSecond",
        third: false
      }
    },
    bases: {
      first: "runnerFromFirst",
      second: "runnerFromSecond",
      third: false
    }
  };

  pendingRunnerChoices = {
    second: { to: "home" },
    first: { to: "third" },
    batter: { to: "first" }
  };
  const validFirstToThird = validateRunnerDecisionChoices(game, "1B");

  pendingRunnerChoices = {
    second: { to: "third" },
    first: { to: "third" },
    batter: { to: "first" }
  };
  const duplicateThird = validateRunnerDecisionChoices(game, "1B");

  pendingRunnerChoices = {
    second: { to: "home" },
    first: { to: "hold" },
    batter: { to: "first" }
  };
  const duplicateFirst = validateRunnerDecisionChoices(game, "1B");

  JSON.stringify({
    firstBaseOptions: runnerOverrideOptions(firstBaseCard),
    secondBaseOptions: runnerOverrideOptions(secondBaseCard),
    batterOptions: runnerOverrideOptions(batterCard),
    firstBaseLabels: runnerOverrideOptions(firstBaseCard).map((option) => runnerOverrideLabel(firstBaseCard, option)),
    validFirstToThird,
    duplicateThird,
    duplicateFirst
  });
`, {}));

assert.deepEqual(
  runtimeResult.firstBaseOptions,
  ["hold", "second", "third", "home", "out"],
  "Runner from first should be able to hold, take 2B, take 3B, score, or be out"
);
assert.deepEqual(
  runtimeResult.secondBaseOptions,
  ["hold", "third", "home", "out"],
  "Runner from second should be able to hold, take 3B, score, or be out"
);
assert.deepEqual(
  runtimeResult.batterOptions,
  ["first", "second", "third", "home", "out"],
  "Batter destination options should remain explicit and bounded"
);
assert.deepEqual(
  runtimeResult.firstBaseLabels,
  ["Hold", "2B", "3B", "Score", "Out"],
  "Runner decision labels should be explicit enough for first-to-third scoring"
);
assert.equal(runtimeResult.validFirstToThird.valid, true, "Single with runner from 2B scoring and runner from 1B to 3B should validate");
assert.equal(runtimeResult.duplicateThird.valid, false, "Two runners should not be allowed to end at 3B");
assert.match(runtimeResult.duplicateThird.message, /3B/, "Duplicate-base warning should name the conflicted base");
assert.equal(runtimeResult.duplicateFirst.valid, false, "Runner holding first should conflict with batter ending at first");
assert.match(runtimeResult.duplicateFirst.message, /1B/, "Duplicate-base warning should name first base");

console.log("Runner decision destination checks passed.");

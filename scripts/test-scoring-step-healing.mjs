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
  functionBody(appJs, "renderScoringStepPanel"),
  /healOrphanedScoringStep\(game\)/,
  "Scoring panel render should heal stale in-progress steps before choosing a layout"
);

assert.match(
  functionBody(appJs, "restoreActiveGamePendingScoringState"),
  /healOrphanedScoringStep\(game\)/,
  "Restored live-game pending scoring snapshots should be healed before rendering"
);

const runtimeSource = [
  functionBody(appJs, "clearPendingPlayState"),
  functionBody(appJs, "healOrphanedScoringStep")
].join("\n\n");

const runtimeResult = JSON.parse(runInNewContext(`
  let pendingSpray = null;
  let pendingRunnerOutBases = [];
  let pendingRunnerChoices = {};
  let pendingOutType = "";
  let pendingOutFielder = "";
  let pendingRunnerReplacementBase = "";
  let selectedFieldRunnerBase = "first";
  let bipOutcomeChosen = false;
  let awaitingSprayLocation = false;
  let awaitingRunnerDecision = false;
  let scoringStep = "outcome";

  ${runtimeSource}

  const game = { atBat: { pendingInPlay: false } };
  const healed = healOrphanedScoringStep(game);

  JSON.stringify({
    healed,
    scoringStep,
    selectedFieldRunnerBase,
    pendingInPlay: game.atBat.pendingInPlay,
    awaitingSprayLocation,
    awaitingRunnerDecision
  });
`, {}));

assert.equal(runtimeResult.healed, true, "An orphaned outcome step should be healed");
assert.equal(runtimeResult.scoringStep, "pitch", "Healing should return the scoring panel to Pitch Mode");
assert.equal(runtimeResult.selectedFieldRunnerBase, "", "Healing should clear stale selected runner state");
assert.equal(runtimeResult.pendingInPlay, false, "Healing should leave the completed at-bat non-pending");
assert.equal(runtimeResult.awaitingSprayLocation, false, "Healing should clear stale spray state");
assert.equal(runtimeResult.awaitingRunnerDecision, false, "Healing should clear stale runner decision state");

console.log("Scoring step healing checks passed.");

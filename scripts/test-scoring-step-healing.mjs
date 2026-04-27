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

  const game = { atBat: { pendingInPlay: false }, pendingScoring: { scoringStep: "outcome" } };
  const healed = healOrphanedScoringStep(game);

  JSON.stringify({
    healed,
    scoringStep,
    selectedFieldRunnerBase,
    pendingInPlay: game.atBat.pendingInPlay,
    pendingScoring: game.pendingScoring,
    awaitingSprayLocation,
    awaitingRunnerDecision
  });
`, {}));

assert.equal(runtimeResult.healed, true, "An orphaned outcome step should be healed");
assert.equal(runtimeResult.scoringStep, "pitch", "Healing should return the scoring panel to Pitch Mode");
assert.equal(runtimeResult.selectedFieldRunnerBase, "", "Healing should clear stale selected runner state");
assert.equal(runtimeResult.pendingInPlay, false, "Healing should leave the completed at-bat non-pending");
assert.equal(runtimeResult.pendingScoring, null, "Healing should clear persisted pending scoring snapshots");
assert.equal(runtimeResult.awaitingSprayLocation, false, "Healing should clear stale spray state");
assert.equal(runtimeResult.awaitingRunnerDecision, false, "Healing should clear stale runner decision state");

const staleRunnersResult = JSON.parse(runInNewContext(`
  let pendingSpray = { x: 35, y: 42, zone: "Left field" };
  let pendingRunnerOutBases = [];
  let pendingRunnerChoices = { first: { runnerId: "runner-1", from: "first", to: "second" } };
  let pendingOutType = "";
  let pendingOutFielder = "";
  let pendingRunnerReplacementBase = "";
  let selectedFieldRunnerBase = "";
  let bipOutcomeChosen = true;
  let awaitingSprayLocation = false;
  let awaitingRunnerDecision = true;
  let scoringStep = "runners";

  ${runtimeSource}

  const completedGame = {
    currentPlateAppearanceId: "",
    atBat: { pendingInPlay: false, pitches: [] }
  };
  const healedCompleted = healOrphanedScoringStep(completedGame);
  const completedStep = scoringStep;
  const completedAwaitingRunnerDecision = awaitingRunnerDecision;

  let activePendingRunnerChoices = { first: { runnerId: "runner-1", from: "first", to: "second" } };
  pendingRunnerChoices = activePendingRunnerChoices;
  pendingSpray = { x: 35, y: 42, zone: "Left field" };
  bipOutcomeChosen = true;
  awaitingRunnerDecision = true;
  scoringStep = "runners";
  const activeGame = {
    currentPlateAppearanceId: "pa-live",
    atBat: { pendingInPlay: false, pitches: [{ type: "in_play", inPlay: true }] },
    plateAppearances: [{ id: "pa-live", result: null }]
  };
  const healedActive = healOrphanedScoringStep(activeGame);

  JSON.stringify({
    healedCompleted,
    completedStep,
    completedAwaitingRunnerDecision,
    healedActive,
    activeStep: scoringStep,
    activeAwaitingRunnerDecision: awaitingRunnerDecision,
    activeRunnerChoices: Object.keys(pendingRunnerChoices).length
  });
`, {}));

assert.equal(staleRunnersResult.healedCompleted, true, "Completed at-bat shell should heal stale Set Advancements state");
assert.equal(staleRunnersResult.completedStep, "pitch", "Completed at-bat shell should return to Pitch Mode");
assert.equal(staleRunnersResult.completedAwaitingRunnerDecision, false, "Completed at-bat shell should clear runner decision mode");
assert.equal(staleRunnersResult.healedActive, false, "Active in-play at-bat should not be healed away");
assert.equal(staleRunnersResult.activeStep, "runners", "Active in-play runner decisions should remain visible");
assert.equal(staleRunnersResult.activeAwaitingRunnerDecision, true, "Active in-play runner decisions should remain pending");
assert.equal(staleRunnersResult.activeRunnerChoices, 1, "Active runner choices should be preserved");

const abandonedInPlayResult = JSON.parse(runInNewContext(`
  let pendingSpray = null;
  let pendingRunnerOutBases = [];
  let pendingRunnerChoices = {};
  let pendingOutType = "";
  let pendingOutFielder = "";
  let pendingRunnerReplacementBase = "";
  let selectedFieldRunnerBase = "";
  let bipOutcomeChosen = true;
  let awaitingSprayLocation = false;
  let awaitingRunnerDecision = false;
  let scoringStep = "outcome";

  ${runtimeSource}

  const abandonedGame = {
    currentPlateAppearanceId: "",
    pendingScoring: { scoringStep: "outcome" },
    atBat: { pendingInPlay: true, pitches: [{ type: "in_play", inPlay: true }] },
    plateAppearances: [{ id: "pa-complete", result: { type: "FO" } }]
  };
  const healed = healOrphanedScoringStep(abandonedGame);

  JSON.stringify({
    healed,
    scoringStep,
    pendingInPlay: abandonedGame.atBat.pendingInPlay,
    pendingScoring: abandonedGame.pendingScoring
  });
`, {}));

assert.equal(abandonedInPlayResult.healed, true, "Abandoned in-play state without an active plate appearance should be healed");
assert.equal(abandonedInPlayResult.scoringStep, "pitch", "Abandoned in-play state should return to Pitch Mode");
assert.equal(abandonedInPlayResult.pendingInPlay, false, "Abandoned in-play state should clear pendingInPlay");
assert.equal(abandonedInPlayResult.pendingScoring, null, "Abandoned in-play state should clear stale pending scoring snapshots");

assert.match(
  functionBody(appJs, "finalizePlateAppearance"),
  /clearPendingPlayState\(game, true\)/,
  "Completed plate appearances should centrally clear pending scoring UI state"
);

const logPlayBody = functionBody(appJs, "logPlay");
assert.match(logPlayBody, /const inningBeforePlay = game\.inning;/, "logPlay should remember the inning before finalizing the play");
assert.match(logPlayBody, /const halfBeforePlay = game\.half;/, "logPlay should remember the half before finalizing the play");
assert.match(logPlayBody, /const halfInningChanged = game\.inning !== inningBeforePlay \|\| game\.half !== halfBeforePlay;/, "logPlay should detect half-inning transitions");
assert.match(logPlayBody, /resetBipChoiceControls\(\);/, "logPlay should only reset batted-ball form controls after a completed play");
assert.match(logPlayBody, /if \(halfInningChanged\) clearPendingPlayState\(game, true\);/, "logPlay should force a full pending-state clear after half-inning transitions");
assert.doesNotMatch(logPlayBody, /resetBipChoices\(\);/, "logPlay should not run the generic in-play reset against the new half inning");

assert.match(
  functionBody(appJs, "advanceHalfInning"),
  /game\.half = game\.current\.half;[\s\S]*game\.current\.batterId = currentBatterModelId\(game\);/,
  "advanceHalfInning should update legacy half before deriving the next current batter"
);

console.log("Scoring step healing checks passed.");

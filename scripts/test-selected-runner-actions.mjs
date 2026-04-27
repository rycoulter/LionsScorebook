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

const selectedRunnerBody = functionBody(appJs, "selectedRunnerActionConfig");
assert.match(
  selectedRunnerBody,
  /data-special-action="steal" data-special-source="\$\{escapeHtml\(base\)\}" data-special-target="\$\{escapeHtml\(stealTarget\)\}"/,
  "Selected runner steal buttons should carry source and target bases"
);
assert.match(
  selectedRunnerBody,
  /data-special-action="caught_stealing" data-special-source="\$\{escapeHtml\(base\)\}" data-special-target="\$\{escapeHtml\(stealTarget\)\}"/,
  "Selected runner caught-stealing buttons should carry source and target bases"
);
assert.match(
  selectedRunnerBody,
  /data-special-action="pickoff" data-special-source="\$\{escapeHtml\(base\)\}" data-special-target="\$\{escapeHtml\(base\)\}"/,
  "Selected runner pickoff buttons should carry the selected source base"
);

const scoringClickBody = functionBody(appJs, "handleScoringPanelClick");
assert.match(
  scoringClickBody,
  /handleSpecialActionButton\(button\)/,
  "Selected runner actions should pass the selected source base into applyEvent"
);
assert.match(
  scoringClickBody,
  /closestFromEventTarget\(event\.target, "button"\)/,
  "Scoring panel clicks should resolve buttons safely from text-node tap targets"
);

const closestTargetBody = functionBody(appJs, "closestFromEventTarget");
assert.match(
  closestTargetBody,
  /target\.parentElement \|\| target\.parentNode/,
  "Tap target helper should fall back from text nodes to their parent element"
);

const specialActionBody = functionBody(appJs, "handleSpecialActionButton");
assert.match(
  specialActionBody,
  /source: button\.dataset\.specialSource \|\| selectedFieldRunnerBase/,
  "Special action helper should preserve the selected source base"
);
assert.match(
  functionBody(appJs, "handleScoringPanelPointerUpAction"),
  /closestFromEventTarget\(event\.target, SCORING_PANEL_POINTERUP_ACTION_SELECTOR\)/,
  "Scoring action buttons should execute from pointerup for iPad/Safari reliability"
);
assert.match(
  appJs,
  /SCORING_PANEL_POINTERUP_ACTION_SELECTOR = \[[\s\S]*button\[data-step-pitch\]/,
  "Pitch buttons should be covered by the pointerup action path"
);
assert.match(
  appJs,
  /SCORING_PANEL_POINTERUP_ACTION_SELECTOR = \[[\s\S]*button\[data-step-outcome\]/,
  "Outcome buttons should be covered by the pointerup action path"
);
assert.match(
  appJs,
  /SCORING_PANEL_POINTERUP_ACTION_SELECTOR = \[[\s\S]*button\[data-special-action\]/,
  "Runner action buttons should be covered by the pointerup action path"
);
assert.match(
  appJs,
  /SCORING_PANEL_POINTERUP_ACTION_SELECTOR = \[[\s\S]*button\[data-confirm-play\]/,
  "Confirm Play should be covered by the pointerup action path"
);
assert.match(
  functionBody(appJs, "handleScoringPanelPointerUpAction"),
  /handleScoringPanelClick\(\{ target: button \}\)/,
  "Pointerup should commit through the same scoring action handler used by click"
);
assert.match(
  appJs,
  /scoringStepPanel\.addEventListener\("pointerup", handleScoringPanelPointerUpAction\)/,
  "Scoring panel should bind the pointerup special-action fallback"
);
assert.match(
  scoringClickBody,
  /button === scoringStepPointerActionButton/,
  "Click handling should ignore the synthetic click after a pointerup special action"
);
assert.match(
  scoringClickBody,
  /POINTER_ACTION_CLICK_SUPPRESS_MS \|\| !button\.isConnected/,
  "Click handling should suppress delayed synthetic clicks from buttons removed by a render"
);

assert.match(
  functionBody(appJs, "clearPendingPlayState"),
  /selectedFieldRunnerBase = ""/,
  "Completed play cleanup should clear any selected runner action state"
);

const applyEventBody = functionBody(appJs, "applyEvent");
assert.match(
  applyEventBody,
  /recordSteal\(event\.target, "safe", event\.source\)/,
  "Safe steals should preserve the selected source base"
);
assert.match(
  applyEventBody,
  /recordSteal\(event\.target, "out", event\.source\)/,
  "Caught stealing should preserve the selected source base"
);

const recordStealBody = functionBody(appJs, "recordSteal");
assert.match(recordStealBody, /function recordSteal\(target, outcome, sourceBase = ""\)/, "recordSteal should accept an explicit source base");
assert.match(recordStealBody, /const steal = baseKeyForSteal\(target, sourceBase\)/, "recordSteal should use the explicit source base");
assert.match(recordStealBody, /sameRunnerValue\(targetRunner, runner\)/, "recordSteal should tolerate duplicate same-runner target state");
assert.match(recordStealBody, /const runnerId = runnerIdentity\(runner\) \|\| runner/, "recordSteal should normalize object-shaped runner values");
assert.match(recordStealBody, /commitCurrentToLegacy\(game\)/, "Safe runner actions should commit current base movement back to legacy game state");

const applyRunnerBody = functionBody(appJs, "applyRunnerAdvancements");
assert.match(
  applyRunnerBody,
  /applyAdvancementsToBaseState\(game\.current\.runners \|\| emptyBases\(false\), runnerAdvancements\)/,
  "Runner advancement should use the shared base-state advancement helper"
);
assert.match(
  functionBody(appJs, "applyAdvancementsToBaseState"),
  /sameRunnerValue\(runners\[from\], runnerId\)/,
  "Base-state advancement should clear the selected source base by stable runner identity"
);

assert.match(functionBody(appJs, "runnerIdentity"), /value\.runnerId \|\| value\.playerId \|\| value\.id/, "Runner identity should support object-shaped runner values");
assert.match(functionBody(appJs, "runnerName"), /runnerIdentity\(runner\)/, "Runner names should use stable runner identity");
assert.match(functionBody(appJs, "recordPickoff"), /const runnerId = runnerIdentity\(runner\) \|\| runner/, "Pickoff should normalize object-shaped runner values");
assert.match(functionBody(appJs, "recordPickoff"), /runnerAdvancements: \[\{ runnerId, from: base, out: true \}\]/, "Pickoff events should record the runner advancement");

console.log("Selected runner action checks passed.");

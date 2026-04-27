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

const applyRunnerBody = functionBody(appJs, "applyRunnerAdvancements");
assert.match(
  applyRunnerBody,
  /applyAdvancementsToBaseState\(game\.current\.runners \|\| emptyBases\(false\), runnerAdvancements\)/,
  "Runner advancement should use the shared base-state advancement helper"
);
assert.match(
  applyRunnerBody,
  /summarizeRunnerAdvancements\(runnerAdvancements\)/,
  "Runner advancement should calculate scoring and outs separately from base mutation"
);

const applyBaseStateBody = functionBody(appJs, "applyAdvancementsToBaseState");
assert.match(
  applyBaseStateBody,
  /sameRunnerValue\(runners\[from\], runnerId\)/,
  "Base-state advancement should clear source bases by stable runner identity"
);
assert.match(
  applyBaseStateBody,
  /advancement\.remove \|\| advancement\.out \|\| to === "home"/,
  "Base-state advancement should remove scored and out runners"
);

const eventDerivedBody = functionBody(appJs, "eventDerivedBasesAfter");
assert.match(
  eventDerivedBody,
  /applyAdvancementsToBaseState\(event\.basesBefore, event\.runnerAdvancements\)/,
  "Event-derived base state should rebuild bases from runner advancements"
);

const reconcileBody = functionBody(appJs, "reconcileGameBasesFromEvents");
assert.match(
  reconcileBody,
  /eventDerivedBasesAfter\(event\)/,
  "Reconcile should derive the authoritative base state from the latest event"
);
assert.match(
  reconcileBody,
  /game\.bases = deepClone\(derivedBases\)/,
  "Reconcile should repair the legacy bases mirror"
);
assert.match(
  reconcileBody,
  /game\.current\.runners = deepClone\(derivedBases\)/,
  "Reconcile should repair current runner state"
);

assert.match(
  functionBody(appJs, "recordSteal"),
  /reconcileGameBasesFromEvents\(game\)/,
  "Steal actions should repair stale base state before validating the target base"
);
assert.match(
  functionBody(appJs, "renderRunnerTracker"),
  /reconcileGameBasesFromEvents\(game\)/,
  "Runner rendering should repair stale base state before enabling runner actions"
);
assert.match(
  functionBody(appJs, "selectedRunnerActionConfig"),
  /reconcileGameBasesFromEvents\(game\)/,
  "Selected-runner panel should repair stale base state before deciding whether SB is available"
);

const runtimeSource = [
  "deepClone",
  "emptyBases",
  "isOccupied",
  "runnerIdentity",
  "sameRunnerValue",
  "normalizeBaseState",
  "baseStatesEqual",
  "applyAdvancementsToBaseState",
  "eventDerivedBasesAfter",
  "reconcileGameBasesFromEvents"
].map((name) => functionBody(appJs, name)).join("\n\n");

const runtimeResult = JSON.parse(runInNewContext(`
  ${runtimeSource}

  const staleGame = {
    inning: 1,
    half: "top",
    bases: { first: "batter-after-single", second: "runner-who-scored", third: false },
    current: {
      inning: 1,
      half: "top",
      runners: { first: "batter-after-single", second: "runner-who-scored", third: false }
    },
    events: [{
      inning: 1,
      half: "top",
      basesBefore: { first: false, second: "runner-who-scored", third: false },
      basesAfter: { first: "batter-after-single", second: "runner-who-scored", third: false },
      runnerAdvancements: [
        { runnerId: "runner-who-scored", from: "second", to: "home" },
        { runnerId: "batter-after-single", from: "batter", to: "first" }
      ]
    }]
  };

  const repaired = reconcileGameBasesFromEvents(staleGame);
  const afterSteal = applyAdvancementsToBaseState(staleGame.bases, [
    { runnerId: "batter-after-single", from: "first", to: "second" }
  ]);

  JSON.stringify({ repaired, bases: staleGame.bases, current: staleGame.current.runners, afterSteal });
`, { structuredClone }));

assert.equal(runtimeResult.repaired, true, "Stale second-base state should be repaired from runner advancements");
assert.deepEqual(
  runtimeResult.bases,
  { first: "batter-after-single", second: false, third: false },
  "Runner who scored from second should be cleared while batter remains on first"
);
assert.deepEqual(
  runtimeResult.current,
  runtimeResult.bases,
  "Current runners and legacy bases should be reconciled together"
);
assert.deepEqual(
  runtimeResult.afterSteal,
  { first: false, second: "batter-after-single", third: false },
  "A subsequent SB 2B should advance the batter-runner after reconciliation"
);

console.log("Runner base reconciliation checks passed.");

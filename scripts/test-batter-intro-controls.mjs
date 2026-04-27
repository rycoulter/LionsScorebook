import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const stylesCss = readFileSync(join(rootDir, "styles.css"), "utf8");

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

assert.match(
  functionBody(appJs, "syncBatterIntroLockState"),
  /is-batter-intro-locked/,
  "Batter intro should still mark the scoring panel for dimmed visual treatment"
);

assert.match(
  stylesCss,
  /#scoreView \.scoring-step-panel\.is-batter-intro-locked\s*\{[^}]*pointer-events:\s*auto;/s,
  "Batter intro should not block Pitch Mode controls from receiving taps"
);

assert.doesNotMatch(
  stylesCss,
  /#scoreView \.scoring-step-panel\.is-batter-intro-locked\s*\{[^}]*pointer-events:\s*none;/s,
  "Batter intro lock must not swallow scoring button taps"
);

assert.match(
  functionBody(appJs, "applyEvent"),
  /dismissBatterIntro\(game\)/,
  "Starting a scoring action should dismiss the batter intro"
);

console.log("Batter intro control checks passed.");

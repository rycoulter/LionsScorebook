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

const saveStateBody = functionBody(appJs, "saveState");
assert.match(
  saveStateBody,
  /scheduleScoreGameRenderFlush\(options\.liveSyncReason \|\| "live-game-save"\)/,
  "live game saves should schedule a score render flush"
);

const scheduleBody = functionBody(appJs, "scheduleScoreGameRenderFlush");
assert.match(scheduleBody, /currentView !== "score"/, "render flush should be scoped to Score Game");
assert.match(scheduleBody, /requestAnimationFrame\?\.\(\(\) => renderScoreGameSurfacesForFlush/, "render flush should rerender on the next animation frame");
assert.match(scheduleBody, /setTimeout\(\(\) =>[\s\S]*renderScoreGameSurfacesForFlush/, "render flush should include a delayed fallback for iOS PWA repaint stalls");

const flushBody = functionBody(appJs, "renderScoreGameSurfacesForFlush");
for (const renderer of ["renderScoreboard", "renderAtBat", "renderScoringStepPanel", "renderRunnerTracker", "renderSprayChart", "renderPlayFeed"]) {
  assert.match(flushBody, new RegExp(`${renderer}\\(\\)`), `${renderer} should be refreshed during the score render flush`);
}
assert.match(flushBody, /forceScoreGamePaintFlush\(\)/, "score render flush should force a paint pass after DOM updates");

const paintBody = functionBody(appJs, "forceScoreGamePaintFlush");
assert.match(paintBody, /node\.dataset\.paintFlush/, "paint flush should mutate the score view dataset");
assert.match(paintBody, /node\.classList\.add\("is-score-paint-flush"\)/, "paint flush should toggle a compositor class");
assert.match(paintBody, /void node\.offsetHeight/, "paint flush should force layout before releasing the compositor class");

assert.match(
  appJs,
  /window\.addEventListener\("focus", \(\) => \{[\s\S]*scheduleScoreGameRenderFlush\("focus"\)/,
  "focus should refresh the score surface"
);
assert.match(
  appJs,
  /window\.addEventListener\("pageshow", \(\) => \{[\s\S]*scheduleScoreGameRenderFlush\("pageshow"\)/,
  "pageshow should refresh the score surface"
);
assert.match(
  appJs,
  /document\.addEventListener\("visibilitychange", \(\) => \{[\s\S]*scheduleScoreGameRenderFlush\("visibility"\)/,
  "visibility return should refresh the score surface"
);
assert.match(
  stylesCss,
  /#scoreView\.is-score-paint-flush[\s\S]*transform: translateZ\(0\)/,
  "score view should have a compositor-only paint flush class"
);

console.log("Score render flush checks passed.");

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

const sprayEventsBody = functionBody(appJs, "sprayEvents");
assert.match(
  sprayEventsBody,
  /const currentScope = isLionsAtBat\(game\) \? "offense" : "defense"/,
  "Score Game spray chart should choose markers for the current batting side"
);
assert.match(
  sprayEventsBody,
  /currentScope === "offense"[\s\S]*sprayEventsForGame\(game\)[\s\S]*Array\.isArray\(game\.events\)/,
  "Lions offense should use the normal offense spray source, while opponent half should read defensive events"
);
assert.match(
  sprayEventsBody,
  /\(event\.scope \|\| "offense"\) !== currentScope/,
  "Score Game spray chart should filter old markers from the non-batting side"
);
assert.match(
  sprayEventsBody,
  /filter === "hitter" && currentScope === "defense" && event\.opponentBatter !== currentOpponentHitter/,
  "Opponent half Current hitter filter should use the opponent batter name"
);

const renderSprayDotBody = functionBody(appJs, "renderSprayDot");
assert.match(
  renderSprayDotBody,
  /event\.scope === "defense" \? event\.opponentBatter \|\| "Opponent batter"/,
  "Opponent spray dots should label the opponent batter instead of an unknown Lions player"
);

console.log("Score spray current-side checks passed.");

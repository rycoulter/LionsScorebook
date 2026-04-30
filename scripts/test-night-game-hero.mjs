import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const matchupImagesJs = readFileSync(join(rootDir, "matchup-images.js"), "utf8");
const serviceWorker = readFileSync(join(rootDir, "service-worker.js"), "utf8");

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

assert.match(appJs, /const NIGHT_GAME_START_MINUTES = 20 \* 60;/, "Night games should start at 8:00 PM");
assert.match(functionBody(appJs, "gameStartMinutes"), /meridian === "pm" && hours < 12/, "Game time parser should support PM times");
assert.match(functionBody(appJs, "isNightGame"), /minutes >= NIGHT_GAME_START_MINUTES/, "Night game helper should use the 8:00 PM threshold");
assert.match(functionBody(appJs, "setHomeMatchupImage"), /els\.homeMatchupImage\.src = matchupImageForGame\(game\)/, "Home hero should use the shared matchup image helper");
assert.match(functionBody(appJs, "matchupImageForGame"), /isNightGame\(game\)[\s\S]*getNightMatchupImage/, "Shared matchup helper should try night images for night games");
assert.match(functionBody(appJs, "matchupImageForGame"), /nightImage \|\| window\.MatchupImages\?\.getMatchupImage/, "Night matchup helper should fall back to the daytime matchup");

for (const imageKey of ["lions@d2", "lions@devils", "lions@ducks", "lions@eagles"]) {
  assert.match(matchupImagesJs, new RegExp(`"${imageKey}"`), `${imageKey} should be registered as a night matchup`);
  assert.equal(existsSync(join(rootDir, "assets", "matchups", "night", `${imageKey}.png`)), true, `${imageKey} night image should exist`);
  assert.match(serviceWorker, new RegExp(`\\.\\/assets\\/matchups\\/night\\/${imageKey.replace("@", "@")}\\.png`), `${imageKey} night image should be cached`);
}

assert.match(functionBody(matchupImagesJs, "getNightMatchupImage"), /return NIGHT_MATCHUP_IMAGES\.has\(imageKey\) \? `assets\/matchups\/night\/\$\{imageKey\}\.png` : "";/, "Night matchup lookup should return only exact registered night assets");

console.log("Night game hero checks passed.");

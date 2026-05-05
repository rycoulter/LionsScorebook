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

const postponedBody = functionBody(appJs, "gameIsPostponed");
assert.match(postponedBody, /timestampValue\(game\.postponedAt\)/, "postponed lifecycle should honor postponedAt, not only status");
assert.match(postponedBody, /timestampValue\(game\.resumedFromPostponedAt\)/, "postponed lifecycle should allow resumed games back into schedule flow");
assert.match(postponedBody, /resumedAt > postponedAt/, "games resumed after a postponement should not remain postponed");
assert.match(postponedBody, /game\.status === "postponed" \|\| Boolean\(postponedAt\)/, "status or postponedAt should classify a game as postponed");

const liveWindowBody = functionBody(appJs, "isGameInScheduledLiveWindow");
assert.match(liveWindowBody, /gameIsPostponed\(game\)/, "postponed games should not be promoted into the scheduled live window");

const lifecycleBody = functionBody(appJs, "gameLifecycle");
assert.match(lifecycleBody, /gameIsPostponed\(game\)\) return "postponed"/, "game lifecycle should classify postponed games before future games");

const gamesForLifecycleBody = functionBody(appJs, "gamesForLifecycle");
assert.match(gamesForLifecycleBody, /gameLifecycle\(game\) !== lifecycle/, "schedule filters should rely on the shared lifecycle helper");

const upcomingBody = functionBody(appJs, "upcomingScheduledGames");
assert.match(upcomingBody, /gameLifecycle\(game\) === "future"/, "home next-game lookup should use the shared future lifecycle");

const scoreableBody = functionBody(appJs, "scoreableGames");
assert.match(scoreableBody, /!gameIsPostponed\(game\)/, "postponed games should not be considered scoreable live games");

function timestampValue(value) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? time : 0;
}

function gameIsFinal(game) {
  return Boolean(game && (game.status === "completed" || game.status === "final"));
}

function localGameIsPostponed(game) {
  if (!game || gameIsFinal(game)) return false;
  const postponedAt = timestampValue(game.postponedAt);
  const resumedAt = timestampValue(game.resumedFromPostponedAt);
  if (postponedAt && resumedAt > postponedAt) return false;
  return game.status === "postponed" || Boolean(postponedAt);
}

function localGameLifecycle(game) {
  if (gameIsFinal(game)) return "completed";
  if (localGameIsPostponed(game)) return "postponed";
  if (game?.status === "active") return "active";
  return "future";
}

const futureGame = {
  id: "future-game",
  status: "scheduled",
  date: "2026-05-10",
  time: "20:00"
};

const staleScheduledPostponedGame = {
  id: "postponed-stale-scheduled",
  status: "scheduled",
  postponedAt: "2026-05-05T01:30:00.000Z",
  date: "2026-05-06",
  time: "20:00"
};

const staleActivePostponedGame = {
  id: "postponed-stale-active",
  status: "active",
  postponedAt: "2026-05-05T01:30:00.000Z",
  date: "2026-05-06",
  time: "20:00"
};

const resumedPostponedGame = {
  id: "resumed-postponed",
  status: "scheduled",
  postponedAt: "2026-05-05T01:30:00.000Z",
  resumedFromPostponedAt: "2026-05-05T02:00:00.000Z",
  date: "2026-05-06",
  time: "20:00"
};

const games = [
  futureGame,
  staleScheduledPostponedGame,
  staleActivePostponedGame,
  resumedPostponedGame
];

assert.equal(localGameIsPostponed(staleScheduledPostponedGame), true, "scheduled games with postponedAt should be postponed");
assert.equal(localGameIsPostponed(staleActivePostponedGame), true, "active stale games with postponedAt should be postponed");
assert.equal(localGameIsPostponed(resumedPostponedGame), false, "resumed postponed games should return to schedule flow");

assert.deepEqual(
  games.filter((game) => localGameLifecycle(game) === "postponed").map((game) => game.id),
  ["postponed-stale-scheduled", "postponed-stale-active"],
  "postponed filter should include stale schedule records with postponedAt"
);

assert.deepEqual(
  games.filter((game) => localGameLifecycle(game) === "future").map((game) => game.id),
  ["future-game", "resumed-postponed"],
  "next/future schedule should exclude postponed records"
);

console.log("Postponed schedule lifecycle checks passed.");

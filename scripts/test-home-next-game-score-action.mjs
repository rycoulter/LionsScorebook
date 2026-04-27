import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const appJs = readFileSync(join(rootDir, "app.js"), "utf8");
const stylesCss = readFileSync(join(rootDir, "styles.css"), "utf8");

function mustMatch(source, pattern, label) {
  assert.match(source, pattern, label);
}

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

mustMatch(indexHtml, /id="homeNextGameScoreBtn"[\s\S]*hidden/, "Home next-game card should include a hidden score/start button");
mustMatch(appJs, /homeNextGameScoreBtn: document\.getElementById\("homeNextGameScoreBtn"\)/, "Home score/start button should be registered");
mustMatch(appJs, /homeNextGameScoreBtn\?\.addEventListener\("click", handleHomeNextGameScoreAction\)/, "Home score/start button should handle clicks");

const renderHomeBody = functionBody(appJs, "renderHome");
mustMatch(renderHomeBody, /const liveGame = inProgressGames\(\)\[0\] \|\| null/, "Home should prefer live games for the next-game card");
mustMatch(renderHomeBody, /els\.homeNextGameScoreBtn\.hidden = !showScoreAction/, "Home action should only show when scoring is available");
mustMatch(renderHomeBody, /els\.homeNextGameScoreBtn\.dataset\.gameId = next\.id/, "Home action should target the displayed game");
mustMatch(renderHomeBody, /homeNextGameScoreButtonLabel\(next\)/, "Home action should render Start Game or Score Game label");

const labelBody = functionBody(appJs, "homeNextGameScoreButtonLabel");
mustMatch(labelBody, /game\?\.status === "active"[\s\S]*\? "Score Game" : "Start Game"/, "Live games should label the action Score Game");

const resumeBody = functionBody(appJs, "openActiveGameForScoring");
mustMatch(resumeBody, /setActiveGame\(game\.id\)/, "Resume helper should set the active game");
mustMatch(resumeBody, /switchView\("score"\)/, "Resume helper should open Score Game");
assert.equal(resumeBody.includes("clearPendingPlayState"), false, "Resuming a live game should not clear pending scoring state");

const homeActionBody = functionBody(appJs, "handleHomeNextGameScoreAction");
mustMatch(homeActionBody, /requireAdminAccess\("Admin sign-in required to score games\."\)/, "Home scoring action should require admin");
mustMatch(homeActionBody, /game\.status === "active"[\s\S]*openActiveGameForScoring\(game\)/, "Live home action should resume scoring");
mustMatch(homeActionBody, /openLineupBuilder\(game\.id, "home"\)/, "Scheduled home action should start lineup setup");

const scoreScheduledBody = functionBody(appJs, "scoreScheduledGame");
mustMatch(scoreScheduledBody, /game\.status === "active"[\s\S]*openActiveGameForScoring\(game\)/, "Existing active game actions should use the same resume helper");

mustMatch(stylesCss, /\.home-next-game-footer[\s\S]*gap: 10px/, "Home next-game footer should support two actions with spacing");
mustMatch(stylesCss, /\.home-next-game-link\[hidden\][\s\S]*display: none !important/, "Hidden home action should stay hidden despite link display styles");
mustMatch(stylesCss, /\.home-next-game-score-link[\s\S]*linear-gradient/, "Score/start action should be visually primary");

console.log("Home next-game score action checks passed.");

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
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} should exist`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

mustMatch(indexHtml, /id="opponentLineupPanel"[\s\S]*id="addOpponentHitterBtn"[\s\S]*Add Hitter/, "Opponent lineup setup should expose Add Hitter");
mustMatch(appJs, /addOpponentHitterBtn: document\.getElementById\("addOpponentHitterBtn"\)/, "Add Hitter button should be registered");
mustMatch(appJs, /addOpponentHitterBtn\?\.addEventListener\("click", addPregameOpponentLineupHitter\)/, "Add Hitter button should append a pregame opponent hitter");

const entriesBody = functionBody(appJs, "pregameOpponentLineupEntries");
mustMatch(entriesBody, /const existing = Array\.isArray\(game\.lineups\.home\) \? game\.lineups\.home : \[\]/, "Pregame opponent lineup should keep all existing home lineup entries");
mustMatch(entriesBody, /const totalSpots = Math\.max\(9, existing\.length, names\.length\)/, "Pregame opponent lineup should expand beyond nine hitters");
mustMatch(entriesBody, /for \(let index = 0; index < totalSpots; index \+= 1\)/, "Pregame opponent lineup rows should render through the dynamic total");
mustMatch(entriesBody, /normalizeOpponentLineupEntry\(entry, index, \{ preserveBlank: true \}\)/, "Pregame opponent lineup should preserve blank rows instead of storing Batter placeholders");
mustMatch(entriesBody, /const hasEntryData = pregameOpponentEntryHasData\(entry, index\)/, "Pregame opponent lineup should treat Batter N placeholders as empty setup rows");
mustMatch(entriesBody, /opponentLineupSnapshot\(entries, \{ preserveBlank: true \}\)/, "Pregame opponent lineup snapshots should preserve blank rows");
assert.equal(/slice\(0,\s*9\)/.test(entriesBody), false, "Pregame opponent lineup should not cap existing hitters at nine");

const addBody = functionBody(appJs, "addPregameOpponentLineupHitter");
mustMatch(addBody, /savePregameOpponentLineup\(\)/, "Add Hitter should preserve current typed edits first");
mustMatch(addBody, /let game = state\.games\.find/, "Add Hitter should use a mutable game reference");
mustMatch(addBody, /savePregameOpponentLineup\(\)[\s\S]*game = state\.games\.find/, "Add Hitter should reacquire the game after saveState normalizes state");
mustMatch(addBody, /const index = entries\.length/, "Add Hitter should append after the current final spot");
mustMatch(addBody, /entries\.push\(\{[\s\S]*name: ""[\s\S]*number: ""[\s\S]*order: index \+ 1[\s\S]*active: true[\s\S]*\}\)/, "Add Hitter should create a blank active hitter row");
mustMatch(addBody, /renderOpponentLineupStep\(\{ focusIndex: index \}\)/, "Add Hitter should focus the new row after rerendering");

const renderBody = functionBody(appJs, "renderOpponentLineupStep");
mustMatch(renderBody, /function renderOpponentLineupStep\(options = \{\}\)/, "Opponent lineup step should accept render options");
mustMatch(renderBody, /const focusIndex = Math\.max\(0, Math\.min\(requestedFocusIndex \|\| 0, Math\.max\(entries\.length - 1, 0\)\)\)/, "Opponent lineup render should clamp the active focus row");
mustMatch(renderBody, /opponentLineupActiveIndex = focusIndex/, "Opponent lineup render should remember the active focus row");
mustMatch(renderBody, /renderOpponentLineupSetupRow\(entry, index, index === focusIndex\)/, "Opponent lineup render should highlight the active row");
mustMatch(renderBody, /data-opponent-pregame-index="\$\{focusIndex\}"\]\[data-opponent-pregame-field="name"\]/, "Opponent lineup render should focus the requested hitter name field");
mustMatch(functionBody(appJs, "setOpponentLineupActiveRow"), /classList\.toggle\("is-active"/, "Opponent lineup focus should update the highlighted row without a rerender");
mustMatch(functionBody(appJs, "renderOpponentLineupSetupRow"), /opponent-lineup-setup-row\$\{isActive \? " is-active" : ""\}/, "Opponent lineup rows should render an active class");

const normalizeEntryBody = functionBody(appJs, "normalizeOpponentLineupEntry");
mustMatch(normalizeEntryBody, /preserveBlank = options\.preserveBlank === true/, "Opponent lineup normalization should support preserving blanks");
mustMatch(normalizeEntryBody, /name: name \|\| \(preserveBlank \? "" : `Batter \$\{index \+ 1\}`\)/, "Object lineup entries should keep blank names when requested");

mustMatch(functionBody(appJs, "isOpponentLineupPlaceholderName"), /\^batter\\s\+\\d\+\$/, "Opponent placeholder detection should recognize Batter N names");
mustMatch(functionBody(appJs, "pregameOpponentEntryHasData"), /normalized\.number \|\| \(normalized\.name && !isOpponentLineupPlaceholderName\(normalized\.name\)\)/, "Pregame opponent data detection should ignore Batter N names without a number");

const normalizeGameBody = functionBody(appJs, "normalizeGame");
mustMatch(normalizeGameBody, /normalizeOpponentLineupEntry\(entry, index, \{ preserveBlank: true \}\)/, "Game normalization should not turn pregame blank opponent rows into placeholders");

mustMatch(stylesCss, /\.opponent-lineup-add-btn[\s\S]*white-space: nowrap/, "Add Hitter button should stay compact in the setup header");
mustMatch(stylesCss, /\.opponent-lineup-setup-row\.is-active[\s\S]*border-color: rgba\(245, 189, 33, 0\.62\)/, "Active opponent lineup row should be visibly highlighted");

console.log("Opponent lineup setup checks passed.");
